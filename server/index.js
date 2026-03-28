import { createServer } from 'http';
import { Server } from 'socket.io';
import { PORT } from './config.js';
import app from './app.js';
import { setupSocket } from './socket/index.js';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

setupSocket(io);

// In production, serve the built client
if (process.env.NODE_ENV === 'production') {
  const { resolve } = await import('path');
  const { default: express } = await import('express');
  app.use(express.static(resolve('dist')));
  app.get('*', (req, res) => {
    res.sendFile(resolve('dist', 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { io };
