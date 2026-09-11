import { todayUtc, isoDate } from '../../shared/puzzleDates.js';
import { validatePuzzleSolve, puzzleStreak } from '../../shared/puzzleProgress.js';
import { lockEconomyUsers } from './economy.js';
import { assertActiveAccount } from './accounts.js';

import { PUZZLE_SOLVE_COINS } from '../../shared/constants.js';

export async function puzzleAttemptStats(db, puzzleIds) {
  const stats = new Map(puzzleIds.map(id => [id, { attempts: 0, solves: 0, firstTry: 0 }]));
  if (!puzzleIds.length) return stats;
  // One aggregate query keeps the numerator and denominator consistent.
  const groups = await db.puzzleAttempt.groupBy({ by: ['puzzleId', 'solved', 'attempts', 'hintUsed'],
    where: { puzzleId: { in: puzzleIds } }, _count: { _all: true } });
  for (const group of groups) {
    const entry = stats.get(group.puzzleId), count = group._count._all;
    entry.attempts += count;
    if (group.solved) { entry.solves += count; if (group.attempts === 1 && !group.hintUsed) entry.firstTry += count; }
  }
  return stats;
}

export async function recordPuzzleAttempt(db, { puzzle, userId, body, now = new Date() }) {
  if (body.solved && !validatePuzzleSolve(puzzle, body.turns)) throw Object.assign(new Error('Solution does not match this puzzle'), { status: 400 });
  for (let retry = 0; ; retry++) {
    try {
      return await db.$transaction(async tx => {
        // Use the same account lock as upgrade, retirement and wallet changes.
        if (userId) await lockEconomyUsers(tx, [userId]);
        // Serialize this identity's retries before reading its cumulative state.
        // Anonymous ids are for statistics, never eligibility for coins.
        const identity = userId ? `user:${userId}` : `visitor:${body.visitorId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${puzzle.id}::integer, hashtext(${identity}))`;
        const user = userId ? assertActiveAccount(await tx.user.findUnique({ where: { id: userId } })) : null;
        const where = user ? { puzzleId_userId: { puzzleId: puzzle.id, userId } }
          : { puzzleId_visitorId: { puzzleId: puzzle.id, visitorId: body.visitorId } };
        const previous = await tx.puzzleAttempt.findUnique({ where });
        const revealed = previous?.solved ? previous.revealed : !!(previous?.revealed || body.revealed);
        const solved = !!(previous?.solved || (body.solved && !revealed));
        const data = { solved, revealed, attempts: Math.max(previous?.attempts ?? 0, body.attempts),
          hintUsed: !!(previous?.hintUsed || body.hintUsed), timeMs: Math.max(previous?.timeMs ?? 0, body.timeMs ?? 0) };
        let attempt = await tx.puzzleAttempt.upsert({ where, update: data,
          create: { ...data, puzzleId: puzzle.id, userId: user?.id ?? null, visitorId: user ? null : body.visitorId } });
        let coinsAwarded = 0;
        if (user && !user.isGuest && !user.isBot && solved && !revealed && !attempt.rewarded && isoDate(puzzle.date) === isoDate(todayUtc(now))) {
          await tx.user.update({ where: { id: user.id }, data: { coins: { increment: PUZZLE_SOLVE_COINS } } });
          await tx.coinTransaction.create({ data: { receiverId: user.id, amount: PUZZLE_SOLVE_COINS, reason: 'PUZZLE_SOLVE' } });
          attempt = await tx.puzzleAttempt.update({ where: { id: attempt.id }, data: { rewarded: true } });
          coinsAwarded = PUZZLE_SOLVE_COINS;
        }
        return { attempt: { solved: attempt.solved, attempts: attempt.attempts, hintUsed: attempt.hintUsed, revealed: attempt.revealed, rewarded: attempt.rewarded }, coinsAwarded };
      });
    } catch (err) {
      if (retry < 4 && ['P2034', 'P2002'].includes(err.code)) continue;
      throw err;
    }
  }
}

export async function puzzleHistory(db, userId, now = new Date()) {
  const attempts = await db.puzzleAttempt.findMany({ where: { userId, puzzle: { date: { lte: todayUtc(now) } } },
    select: { solved: true, attempts: true, hintUsed: true, revealed: true, rewarded: true, puzzle: { select: { date: true } } } });
  const history = Object.fromEntries(attempts.map(({ puzzle, ...attempt }) => [isoDate(puzzle.date), attempt]));
  return { history, streak: puzzleStreak(history, now) };
}
