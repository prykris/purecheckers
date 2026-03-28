import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PORT } from './config.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// API routes (added in Phase 2+)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io (wired in Phase 3)
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// In production, serve the built client
if (process.env.NODE_ENV === 'production') {
  const { resolve } = await import('path');
  app.use(express.static(resolve('dist')));
  app.get('*', (req, res) => {
    res.sendFile(resolve('dist', 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { io };
