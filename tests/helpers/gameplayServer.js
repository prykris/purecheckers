import { fork } from 'node:child_process';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Real bootstrap on an isolated test database and ephemeral port. This helper
// never selects a database; tests/setup.js supplies the test-only connection.
export async function startGameplayServer() {
  const child = fork(new URL('../fixtures/owned-gameplay-server.js', import.meta.url), [], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '0', SITE_URL: 'http://127.0.0.1' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let output = ''; const sockets = [];
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-4000); });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const close = async () => {
    sockets.forEach(socket => socket.disconnect());
    if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
  };
  let port;
  try {
    ({ port } = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(`Startup timeout: ${output}`)), 7000);
      child.once('message', result => { clearTimeout(timer); resolve(result); });
      child.once('exit', () => { clearTimeout(timer); reject(Error(`Startup failed: ${output}`)); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    }));
  } catch (error) { await close(); throw error; }
  return { exited, close, async connect(player) {
    const socket = ioClient(`http://127.0.0.1:${port}`, { autoConnect: false, transports: ['websocket'], reconnection: false,
      auth: { token: jwt.sign({ userId: player.id, username: player.username }, process.env.JWT_SECRET) } });
    sockets.push(socket);
    socket.on('sync:state', snapshot => { socket.snapshot = snapshot; });
    const initial = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(`Snapshot timeout: ${output}`)), 5000);
      socket.once('sync:state', snapshot => { clearTimeout(timer); resolve(snapshot); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    socket.connect();
    return { socket, snapshot: await initial };
  } };
}
