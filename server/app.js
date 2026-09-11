import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import leaderboardRoutes from './routes/leaderboard.js';
import shopRoutes from './routes/shop.js';
import friendsRoutes from './routes/friends.js';
import coinsRoutes from './routes/coins.js';
import guestRoutes from './routes/guest.js';
import treasuryRoutes from './routes/treasury.js';
import adminRoutes from './routes/admin.js';
import roomsRoutes from './routes/rooms.js';
import botsRoutes from './routes/bots.js';
import sitemapRoutes from './routes/sitemap.js';
import puzzleRoutes from './routes/puzzle.js';
import ogRoutes from './routes/og.js';
import { getStats } from './socket/presenceHandler.js';

const app = express();

app.use(cors());
app.use(sitemapRoutes);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Live counts for the landing page and the lobby: { online, humansOnline, searching }.
// Sessions belong to humans only, so bots never inflate the numbers.
app.get('/api/presence', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getStats());
});

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/og', ogRoutes);

export default app;
