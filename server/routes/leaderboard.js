import { Router } from 'express';
import prisma from '../db.js';
import { publicUsername, publicProfilePath } from '../services/publicName.js';
import { publicPlayerWhere, gameParticipants, isDiscoverableGame, discoverableGames } from '../services/publicGames.js';

import { findPublicPlayer, playerActivity } from '../services/playerStats.js';
import { gameLogEntry } from '../services/gameLog.js';

const router = Router();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: publicPlayerWhere,
      select: {
        id: true,
        username: true,
        elo: true,
        wins: true,
        losses: true,
        gamesPlayed: true,
        profilePublic: true
      },
      orderBy: { elo: 'desc' },
      take: 50
    });
    res.json({ players: players.map(p => ({ ...p, profileUrl: publicProfilePath(p) })) });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/player/:username — public player profile
router.get('/player/:username', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const player = await findPublicPlayer(prisma, req.params.username);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const games = await prisma.game.findMany({
      where: { OR: [{ redPlayerId: player.id }, { blackPlayerId: player.id }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: gameParticipants
    });

    const history = games.map(g => {
      const isRed = g.redPlayerId === player.id;
      return {
        ...gameLogEntry(g),
        opponent: publicUsername(isRed ? g.blackPlayer.username : g.redPlayer.username),
        opponentProfileUrl: publicProfilePath(isRed ? g.blackPlayer : g.redPlayer),
        myColor: isRed ? 'red' : 'black',
        eloChange: isRed ? g.redEloChange : g.blackEloChange,
      };
    });

    const activity = await playerActivity(prisma, player.id);

    res.json({ player, games: history, activity });
  } catch (err) {
    console.error('Player profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/games — global game log (recent games by all players)
router.get('/games', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let games;
    if (req.query.public === '1') {
      games = [];
      for await (const game of discoverableGames(prisma)) {
        games.push(game);
        if (games.length === 50) break;
      }
    } else games = await prisma.game.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: gameParticipants
    });
    const log = games.map(gameLogEntry);
    res.json({ games: log });
  } catch (err) {
    console.error('Game log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/game/:id — single game data for replay
router.get('/game/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid game ID' });
    const game = await prisma.game.findUnique({
      where: { id },
      include: gameParticipants
    });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({
      game: {
        id: game.id,
        indexable: isDiscoverableGame(game),
        redPlayer: publicUsername(game.redPlayer.username),
        blackPlayer: publicUsername(game.blackPlayer.username),
        redProfileUrl: publicProfilePath(game.redPlayer),
        blackProfileUrl: publicProfilePath(game.blackPlayer),
        result: game.result,
        endReason: game.endReason,
        mode: game.mode,
        isBotGame: game.redPlayer.isBot || game.blackPlayer.isBot,
        redEloChange: game.redEloChange,
        blackEloChange: game.blackEloChange,
        moveHistory: game.moveHistory,
        date: game.startedAt,
        endedAt: game.endedAt,
      }
    });
  } catch (err) {
    console.error('Game replay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
