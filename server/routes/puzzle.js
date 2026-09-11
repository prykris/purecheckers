import { Router } from 'express';
import prisma from '../db.js';
import { optionalToken, verifyToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { getClientAddress } from '../middleware/clientAddress.js';
import { todayUtc, parsePuzzleDate, isoDate, puzzleCacheSeconds } from '../../shared/puzzleDates.js';
import { recordPuzzleAttempt, puzzleHistory, puzzleAttemptStats } from '../services/puzzles.js';
import { puzzleSource } from '../services/puzzleSources.js';

const dateError = res => res.status(400).json({ error: 'Use a valid YYYY-MM-DD date' });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createPuzzleRouter({ db = prisma, now = () => new Date() } = {}) {
  const router = Router();
  router.get('/history', verifyToken, async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await puzzleHistory(db, req.userId, now())); } catch (err) { next(err); }
  });
  router.get('/', async (req, res, next) => {
    try {
      const before = req.query.before === undefined ? null : parsePuzzleDate(req.query.before);
      if (req.query.before !== undefined && !before) return dateError(res);
      const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'Limit must be from 1 to 100' });
      const day = todayUtc(now());
      const puzzles = await db.puzzle.findMany({ where: { date: { lte: day, ...(before ? { lt: before } : {}) } }, orderBy: { date: 'desc' }, take: limit,
        select: { id: true, date: true, theme: true, difficulty: true, sideToMove: true } });
      const stats = await puzzleAttemptStats(db, puzzles.map(p => p.id));
      res.set('Cache-Control', `public, max-age=${puzzleCacheSeconds(day, now())}`);
      res.json({ puzzles: puzzles.map(({ id, date, ...p }) => {
        const { attempts, solves } = stats.get(id);
        return { ...p, date: isoDate(date), attempts, solves, solveRate: attempts ? solves / attempts : 0 };
      }) });
    } catch (err) { next(err); }
  });
  router.get('/:date', async (req, res, next) => {
    try {
      const current = now(), day = todayUtc(current);
      const date = req.params.date === 'today' ? day : parsePuzzleDate(req.params.date);
      if (!date) return dateError(res);
      if (date > day) return res.status(404).json({ error: 'Puzzle not published' });
      const puzzle = await db.puzzle.findUnique({ where: { date } });
      if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
      const [prev, nextPuzzle, counts, source] = await Promise.all([
        db.puzzle.findFirst({ where: { date: { lt: date } }, orderBy: { date: 'desc' }, select: { date: true } }),
        db.puzzle.findFirst({ where: { date: { gt: date, lte: day } }, orderBy: { date: 'asc' }, select: { date: true } }),
        puzzleAttemptStats(db, [puzzle.id]),
        puzzleSource(db, puzzle),
      ]);
      const { attempts, solves, firstTry } = counts.get(puzzle.id);
      // Source eligibility and participant names can change after publication.
      res.set('Cache-Control', puzzle.sourceGameId != null ? 'no-store' : `public, max-age=${puzzleCacheSeconds(date, current)}`);
      res.json({ puzzle: { date: isoDate(date), position: puzzle.position, solution: puzzle.solution,
        sideToMove: puzzle.sideToMove, difficulty: puzzle.difficulty, theme: puzzle.theme, themes: puzzle.themes,
        commentary: puzzle.commentary, solutionPlies: puzzle.solutionPlies, source },
        prev: prev ? isoDate(prev.date) : null, next: nextPuzzle ? isoDate(nextPuzzle.date) : null,
        archived: date < day, stats: { attempts, solves, firstTryRate: attempts ? firstTry / attempts : 0 } });
    } catch (err) { next(err); }
  });
  router.post('/:date/attempt', optionalToken, createRateLimiter({ limit: 120, keyOf: req => req.userId ?? getClientAddress(req) }), async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const date = parsePuzzleDate(req.params.date), current = now();
      if (!date) return dateError(res);
      if (date > todayUtc(current)) return res.status(404).json({ error: 'Puzzle not published' });
      const body = req.body ?? {};
      if (typeof body.solved !== 'boolean' || typeof body.hintUsed !== 'boolean' || typeof body.revealed !== 'boolean'
        || !Number.isInteger(body.attempts) || body.attempts < 1 || body.attempts > 10000
        || (body.timeMs != null && (!Number.isInteger(body.timeMs) || body.timeMs < 0 || body.timeMs > 86400000))
        || (!req.userId && !uuid.test(body.visitorId ?? ''))) return res.status(400).json({ error: 'Invalid puzzle attempt' });
      const puzzle = await db.puzzle.findUnique({ where: { date } });
      if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
      res.json(await recordPuzzleAttempt(db, { puzzle, userId: req.userId, body, now: current }));
    } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
  });
  return router;
}

export default createPuzzleRouter();
