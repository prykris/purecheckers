import { Router } from 'express';
import { findRoomByCode, JOIN_CODE_PATTERN } from '../domain/rooms.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { publicUsername } from '../services/publicName.js';

const router = Router();

// Invite pre-check, read by the SSR /join/CODE page and by the app before it creates a
// guest for a scanned link. In-memory rooms only; no player ids, no code echo, no auth.
export const inviteRateLimit = createRateLimiter({ limit: 60, windowMs: 60_000 });

router.get('/invite/:code', inviteRateLimit, (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!JOIN_CODE_PATTERN.test(code)) return res.status(400).json({ error: 'Invalid invite code' });
  const room = findRoomByCode(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.set('Cache-Control', 'no-store');
  res.json({
    hostName: publicUsername(room.hostName),
    status: room.status,
    playerCount: room.players.length,
    buyIn: room.settings.buyIn,
    turnTimer: room.settings.turnTimer,
    autoReady: !!room.settings.autoReady,
  });
});

export default router;
