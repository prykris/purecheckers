import { createServer } from 'http';
import { Server } from 'socket.io';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { PORT } from './config.js';
import app from './app.js';
import { setupSocket } from './socket/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: isProduction ? {} : { origin: '*' }
});

setupSocket(io);

// In production, serve the built client from /dist
if (isProduction) {
  const distPath = resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(resolve(distPath, 'index.html'));
    }
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${isProduction ? 'production' : 'development'}]`);
});

export { io };
