import { createServer } from 'http';
import { Server } from 'socket.io';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import express from 'express';
import { PORT } from './config.js';
import app from './app.js';
import { setupSocket } from './socket/index.js';
import { startGuestCleanup } from './services/guestCleanup.js';
import { createSettlementRecovery } from './services/settlementRecovery.js';
import { publishRecoveredSettlement, restoreActiveGames, restoreFinishedGames, stopGameRuntime, stopMatchmaking } from './domain/games.js';
import { getAllSessions, removeSession } from './domain/sessions.js';
import { stopRoomRuntime } from './domain/rooms.js';
import { restoreRooms } from './domain/roomRestoration.js';
import { startGameplayOwnership, onGameplayOwnershipLost, watchGameplayOwnership } from './services/gameplayOwnership.js';
import prisma from './db.js';
import { connectedUsers } from './socket/connections.js';
import { createProfileReconciliation } from './services/profileReconciliation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: isProduction ? {} : { origin: '*' }
});

// In production, serve the SvelteKit build
if (isProduction) {
  const buildPath = resolve(__dirname, '..', 'build');

  // Serve prerendered pages (static HTML for /en/, /es/, etc.)
  app.use(express.static(resolve(buildPath, 'prerendered')));

  // Serve client assets (JS, CSS, images from /_app/)
  app.use(express.static(resolve(buildPath, 'client')));

  // SvelteKit handler for everything else
  const { handler } = await import(pathToFileURL(resolve(buildPath, 'handler.js')).href);
  app.use(handler);
}

await startGameplayOwnership();
try {
  const restored = await restoreActiveGames();
  console.log('Startup game recovery:', restored);
  console.log('Startup room recovery:', await restoreRooms());
  console.log('Startup result recovery:', await restoreFinishedGames());
} catch (error) {
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  for (const id of getAllSessions().keys()) removeSession(id);
  await prisma.$disconnect();
  throw error; // never advertise readiness with missing/ambiguous live games
}
setupSocket(io);
const profileReconciliation = createProfileReconciliation({ db: prisma, connections: connectedUsers });
profileReconciliation.start();
const settlementRecovery = createSettlementRecovery({
  onSettled: publishRecoveredSettlement
});
settlementRecovery.start();
httpServer.on('close', () => { void settlementRecovery.stop(); void profileReconciliation.stop(); });
const stopGuestCleanup = startGuestCleanup();
let stopping = false;
let stopOwnershipWatch = () => {};
function shutdownGameplayServer() {
  if (stopping) return;
  stopping = true;
  stopOwnershipWatch(); const guestsStopped = stopGuestCleanup(); stopMatchmaking();
  const gamesStopped = stopGameRuntime();
  const roomsStopped = stopRoomRuntime();
  const recoveryStopped = settlementRecovery.stop();
  const profilesStopped = profileReconciliation.stop();
  // Closing transports immediately makes clients reconnect to the current owner.
  io.close(() => {
    for (const id of getAllSessions().keys()) removeSession(id);
    void Promise.allSettled([gamesStopped, roomsStopped, guestsStopped, recoveryStopped, profilesStopped]).then(() => prisma.$disconnect());
  });
}
onGameplayOwnershipLost(shutdownGameplayServer);
stopOwnershipWatch = watchGameplayOwnership();
process.once('SIGTERM', shutdownGameplayServer);
process.once('SIGINT', shutdownGameplayServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${isProduction ? 'production' : 'development'}]`);
});

export { io };
