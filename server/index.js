import { createServer } from 'http';
import { Server } from 'socket.io';
import { PORT } from './config.js';
import app from './app.js';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
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
