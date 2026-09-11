import { randomUUID } from 'node:crypto';
import { execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../server/db.js';
import { startGameplayOwnership, claimGameplayOwnership, gameplayOwner, inGameplayTransaction,
  onGameplayOwnershipLost, watchGameplayOwnership, GameplayOwnershipLost } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { enqueueSettlement, settleQueuedGame } from '../server/services/settlementRecovery.js';
import { encodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { CheckersGame } from '../shared/game.js';

let red, black, owner, keys;
beforeEach(async () => {
  owner = await startGameplayOwnership(); keys = [];
  [red, black] = await Promise.all(['r', 'b'].map(c => prisma.user.create({ data: {
    username: `ownership-${c}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
});
afterEach(async () => {
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: [red.id, black.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [red.id, black.id] } } });
});
function input() {
  const value = { key: randomUUID(), redPlayerId: red.id, blackPlayerId: black.id, mode: 'RANKED', buyIn: 20 };
  keys.push(value.key); return value;
}
function checkpoint() {
  return encodeCheckpoint({ game: new CheckersGame(60), started: true, startedAt: new Date(), endedAt: null, endReason: null,
    revealAcks: new Set([red.id, black.id]), revealDeadline: Date.now(), pendingDrawOffer: null, lastDrawOffer: {} });
}

it('fences an older process from creation, abort and transitions even after it reads the newest revision', async () => {
  const creation = input(); const run = await createGameRun(creation);
  const { stdout } = await promisify(execFile)(process.execPath, ['tests/fixtures/gameplay-owner-worker.js'], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, windowsHide: true, timeout: 15_000
  });
  const replacement = JSON.parse(stdout);
  expect(replacement.generation).toBeGreaterThan(owner.generation);
  await expect(createGameRun(input(), null, owner)).rejects.toBeInstanceOf(GameplayOwnershipLost);
  await expect(abortGameStart(run.key, null, owner)).rejects.toBeInstanceOf(GameplayOwnershipLost);
  await commitGameTransition({ key: run.key, expectedRevision: 0 }, checkpoint, null, replacement);
  const latest = await prisma.gameRun.findUnique({ where: { key: run.key } });
  await expect(commitGameTransition({ key: run.key, expectedRevision: latest.revision }, checkpoint, null, owner)).rejects.toBeInstanceOf(GameplayOwnershipLost);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(80);
  expect((await prisma.gameRun.findUnique({ where: { key: run.key } })).revision).toBe(1);
});

it('makes takeover wait for the old writer transaction, then rejects every subsequent old write', async () => {
  let entered, release;
  const inside = new Promise(resolve => { entered = resolve; });
  const creation = input();
  const writing = inGameplayTransaction(owner, null, async tx => {
    const run = await createGameRun(creation, tx, owner);
    entered(); await new Promise(resolve => { release = resolve; });
    return run;
  });
  await inside;
  const takeover = claimGameplayOwnership();
  try {
    // Inspect the actual blocked PostgreSQL operation rather than inferring a
    // lock from how quickly a Promise happened to resolve on this machine.
    await vi.waitFor(async () => {
      const [row] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE ${'%GameplayOwner%'} AND pid <> pg_backend_pid()`;
      expect(row.count).toBeGreaterThan(0);
    });
  } finally { release(); }
  const run = await writing;
  const replacement = await takeover;
  expect(run.status).toBe('OPEN');
  await expect(abortGameStart(run.key, null, owner)).rejects.toBeInstanceOf(GameplayOwnershipLost);
  expect((await abortGameStart(run.key, null, replacement)).status).toBe('ABORTED');
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(100);
});

it('releases the fence on rollback so takeover can proceed without retaining a partial reservation', async () => {
  const creation = input();
  await expect(inGameplayTransaction(owner, null, async tx => {
    await createGameRun(creation, tx, owner); throw Error('interrupted write');
  })).rejects.toThrow('interrupted write');
  const replacement = await claimGameplayOwnership();
  expect((await createGameRun(creation, null, replacement)).status).toBe('OPEN');
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(80);
});

it('notifies the idle runtime once when a watcher discovers takeover', async () => {
  const listener = vi.fn(); const unsubscribe = onGameplayOwnershipLost(listener);
  const stop = watchGameplayOwnership({ intervalMs: 10 });
  try {
    await claimGameplayOwnership();
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(() => gameplayOwner()).toThrow(GameplayOwnershipLost);
    await expect(inGameplayTransaction(owner, null, async () => {})).rejects.toBeInstanceOf(GameplayOwnershipLost);
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { stop(); unsubscribe(); }
});

it('allows immutable terminal jobs to settle after writer ownership changes', async () => {
  const creation = input(); await createGameRun(creation);
  await enqueueSettlement({ key: creation.key, redUserId: red.id, blackUserId: black.id, mode: 'RANKED', buyIn: 20,
    winner: null, moveHistory: [], startedAt: new Date(), endedAt: new Date(), endReason: 'draw-agreement' });
  await claimGameplayOwnership();
  const receipt = await settleQueuedGame(creation.key);
  expect(receipt.result).toBe('DRAW');
  expect((await prisma.gameRun.findUnique({ where: { key: creation.key } })).status).toBe('SETTLED');
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(102);
});

it('closes the actual server listener and exits when its idle ownership watcher detects takeover', async () => {
  const server = fork('tests/fixtures/owned-gameplay-server.js', [], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'test', PORT: '0', SITE_URL: 'http://127.0.0.1' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  // Drain bounded fixture output; it is only needed if bootstrap fails.
  let output = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { output = (output + data).slice(-4000); });
  const exited = new Promise(resolve => server.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error(`Server did not become ready: ${output}`)), 5000);
      server.once('message', message => { clearTimeout(timeout); resolve(message); });
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', () => { clearTimeout(timeout); reject(Error(`Server exited during startup: ${output}`)); });
    });
    expect((await fetch(`http://127.0.0.1:${ready.port}/api/treasury`)).status).toBe(200);
    await claimGameplayOwnership();
    await vi.waitFor(() => expect(server.exitCode).toBe(0), { timeout: 5000 });
    expect(await exited).toEqual({ code: 0, signal: null });
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await exited;
  }
});
