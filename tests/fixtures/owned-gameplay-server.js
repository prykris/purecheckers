// Exercise the actual bootstrap and ownership-loss shutdown on an ephemeral port.
const { io } = await import('../../server/index.js');
if (!io.httpServer.listening) await new Promise(resolve => io.httpServer.once('listening', resolve));
process.send({ port: io.httpServer.address().port });
// IPC must not keep a correctly shut-down server process alive.
process.disconnect();
