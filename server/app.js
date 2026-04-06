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

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/admin', adminRoutes);

export default app;
