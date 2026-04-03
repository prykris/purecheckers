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

// In production, serve the SvelteKit build
if (isProduction) {
  const buildPath = resolve(__dirname, '..', 'build');

  // Serve prerendered pages (static HTML for /en/, /es/, etc.)
  app.use(express.static(resolve(buildPath, 'prerendered')));

  // Serve client assets (JS, CSS, images from /_app/)
  app.use(express.static(resolve(buildPath, 'client')));

  // SvelteKit handler for everything else
  const { handler } = await import(resolve(buildPath, 'handler.js'));
  app.use(handler);
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${isProduction ? 'production' : 'development'}]`);
});

export { io };
