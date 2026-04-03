import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { setupSocket } from '../server/socket/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const PORT = 3099; // unique port for tests

function makeToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET);
}

function connectClient(token) {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${PORT}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Game Socket Integration', () => {
  let httpServer, io, clientA, clientB;

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    setupSocket(io);
    await new Promise(resolve => httpServer.listen(PORT, resolve));

    clientA = await connectClient(makeToken(101, 'Alice'));
    clientB = await connectClient(makeToken(102, 'Bob'));
  });

  afterAll(async () => {
    clientA?.disconnect();
    clientB?.disconnect();
    io?.close();
    await new Promise(resolve => httpServer.close(resolve));
  });

  it('rejects connection without token', async () => {
    const bad = ioClient(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true
    });
    const err = await new Promise((resolve) => {
      bad.on('connect_error', resolve);
      setTimeout(() => resolve(null), 2000);
    });
    expect(err).not.toBeNull();
    bad.disconnect();
  });

  it('matches two players via matchmaking', async () => {
    clientA.emit('matchmaking:join', { elo: 1000 });
    clientB.emit('matchmaking:join', { elo: 1010 });

    // Wait for matchmaking (runs every 2s)
    const [foundA, foundB] = await Promise.all([
      waitFor(clientA, 'matchmaking:found', 6000),
      waitFor(clientB, 'matchmaking:found', 6000)
    ]);

    expect(foundA.gameId).toBe(foundB.gameId);
    expect(foundA.yourColor).not.toBe(foundB.yourColor);
    expect(foundA.opponent.username).toBe('Bob');
    expect(foundB.opponent.username).toBe('Alice');
  });

  it('starts game after match found', async () => {
    // Game start is delayed for wheel animation (4.5s)
    const [startA, startB] = await Promise.all([
      waitFor(clientA, 'game:start', 8000),
      waitFor(clientB, 'game:start', 8000)
    ]);

    expect(startA.board).toBeDefined();
    expect(startA.currentPlayer).toBe('red');
    expect(startA.redTime).toBe(60);
    expect(startB.gameId).toBe(startA.gameId);
  });

  it('validates and broadcasts moves', async () => {
    // Leave previous game first
    clientA.emit('game:leave', {});
    clientB.emit('game:leave', {});
    await new Promise(r => setTimeout(r, 200));

    const startA = await new Promise(resolve => {
      clientA.emit('matchmaking:join', { elo: 1000 });
      clientB.emit('matchmaking:join', { elo: 1010 });
      clientA.once('matchmaking:found', resolve);
    });

    await waitFor(clientA, 'game:start', 8000);

    const gameId = startA.gameId;
    const redClient = startA.yourColor === 'red' ? clientA : clientB;
    const blackClient = startA.yourColor === 'red' ? clientB : clientA;

    // Red makes a valid opening move (5,0) -> (4,1)
    redClient.emit('game:move', { gameId, fromRow: 5, fromCol: 0, toRow: 4, toCol: 1 });

    const moveData = await waitFor(blackClient, 'game:moved');
    expect(moveData.fromRow).toBe(5);
    expect(moveData.toRow).toBe(4);
    expect(moveData.currentPlayer).toBe('black');
  });

  it('rejects invalid moves', async () => {
    clientA.emit('game:leave', {});
    clientB.emit('game:leave', {});
    await new Promise(r => setTimeout(r, 200));

    clientA.emit('matchmaking:join', { elo: 1000 });
    clientB.emit('matchmaking:join', { elo: 1010 });

    const found = await waitFor(clientA, 'matchmaking:found', 6000);
    await waitFor(clientA, 'game:start', 8000);

    const gameId = found.gameId;
    const blackClient = found.yourColor === 'red' ? clientB : clientA;

    // Black tries to move on red's turn
    blackClient.emit('game:move', { gameId, fromRow: 2, fromCol: 1, toRow: 3, toCol: 0 });

    const rejection = await waitFor(blackClient, 'game:move-rejected');
    expect(rejection.reason).toMatch(/Not your turn/);
  });

  it('handles resign', async () => {
    clientA.emit('game:leave', {});
    clientB.emit('game:leave', {});
    await new Promise(r => setTimeout(r, 200));

    clientA.emit('matchmaking:join', { elo: 1000 });
    clientB.emit('matchmaking:join', { elo: 1010 });

    const found = await waitFor(clientA, 'matchmaking:found', 6000);
    await waitFor(clientA, 'game:start', 8000);

    const gameId = found.gameId;
    const resigningColor = found.yourColor;

    clientA.emit('game:resign', { gameId });

    const gameOver = await waitFor(clientB, 'game:over');
    expect(gameOver.winner).toBe(resigningColor === 'red' ? 'black' : 'red');
  });
});
