import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../server/db.js';
import { gameplayOwner, startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { encodeCheckpoint, decodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { settleQueuedGame } from '../server/services/settlementRecovery.js';
import { CheckersGame } from '../shared/game.js';

beforeAll(() => startGameplayOwnership());
let red, black, run, checkpoint;
beforeEach(async () => {
  [red, black] = await Promise.all(['r', 'b'].map(c => prisma.user.create({ data: {
    username: `transition-${c}-${randomUUID()}`, friendCode: randomUUID()
  } })));
  run = await createGameRun({ key: randomUUID(), redPlayerId: red.id, blackPlayerId: black.id, mode: 'FRIENDLY', turnTime: 0 });
  checkpoint = encodeCheckpoint({ game: new CheckersGame(0), started: true, startedAt: new Date(), endedAt: null,
    endReason: null, revealAcks: new Set([red.id, black.id]), revealDeadline: Date.now(), pendingDrawOffer: null, lastDrawOffer: {} });
});
afterEach(async () => {
  await prisma.gameSettlementJob.deleteMany({ where: { key: run.key } });
  await prisma.gameRun.delete({ where: { key: run.key } });
  await prisma.game.deleteMany({ where: { settlementKey: run.key } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: [red.id, black.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [red.id, black.id] } } });
});
function command(changes = {}) {
  return { userId: red.id, key: randomUUID(), payload: { type: 'game:move', data: { gameId: run.id, expectedPly: 0 } }, ...changes };
}
function advance(state) {
  const draft = decodeCheckpoint(state);
  const move = draft.game.getAllValidMoves()[0];
  draft.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
  return encodeCheckpoint(draft);
}

it('commits a checkpoint with its command receipt and deduplicates before running the transition again', async () => {
  const request = command(); checkpoint = advance(checkpoint);
  const options = { key: run.key, expectedRevision: 0, command: request };
  const first = await commitGameTransition(options, () => checkpoint);
  const forbidden = vi.fn(() => { throw Error('must not execute'); });
  const duplicate = await commitGameTransition(options, forbidden);
  expect(duplicate).toMatchObject({ duplicate: true, revision: 1, checkpoint });
  expect(forbidden).not.toHaveBeenCalled();
  expect(first.revision).toBe(1);
  expect(await prisma.gameCommandReceipt.count({ where: { gameRunId: run.id } })).toBe(1);
  await expect(commitGameTransition({ ...options, command: { ...request, payload: { type: 'resign' } } }, forbidden)).rejects.toThrow('identity conflict');
});

it('permits only one competing revision and preserves the committed state', async () => {
  const results = await Promise.allSettled([
    commitGameTransition({ key: run.key, expectedRevision: 0 }, () => checkpoint),
    commitGameTransition({ key: run.key, expectedRevision: 0 }, () => advance(checkpoint))
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const current = await prisma.gameRun.findUnique({ where: { key: run.key } });
  expect(current.revision).toBe(1);
  expect(current.checkpoint).toEqual(results.find(result => result.status === 'fulfilled').value.checkpoint);
});

it('rolls back checkpoint, receipt and terminal job together', async () => {
  checkpoint.engine.gameOver = true; checkpoint.engine.winner = 'red'; checkpoint.endedAt = Date.now(); checkpoint.endReason = 'resign';
  const options = { key: run.key, expectedRevision: 0, command: command() };
  await expect(prisma.$transaction(async tx => { await commitGameTransition(options, () => checkpoint, tx); throw Error('commit interrupted'); })).rejects.toThrow('commit interrupted');
  expect(await prisma.gameRun.findUnique({ where: { key: run.key } })).toMatchObject({ revision: 0, checkpoint: null });
  expect(await prisma.gameCommandReceipt.count({ where: { gameRunId: run.id } })).toBe(0);
  expect(await prisma.gameSettlementJob.findUnique({ where: { key: run.key } })).toBeNull();
  const saved = await commitGameTransition(options, () => checkpoint);
  expect(saved.terminalIntent).toMatchObject({ key: run.key, winner: 'red', endReason: 'resign' });
  const receipt = await settleQueuedGame(run.key);
  expect(receipt.result).toBe('RED_WIN');
});

it('recovers the exact accepted transition and command after abrupt process exit', async () => {
  checkpoint = advance(checkpoint);
  const options = { key: run.key, expectedRevision: 0, command: command() };
  await expect(promisify(execFile)(process.execPath, ['tests/fixtures/game-transition-worker.js', JSON.stringify({ options, checkpoint, owner: gameplayOwner() })], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, windowsHide: true, timeout: 15_000
  })).rejects.toMatchObject({ code: 26 });
  const saved = await prisma.gameRun.findUnique({ where: { key: run.key } });
  expect(saved.checkpoint).toEqual(checkpoint);
  const restored = decodeCheckpoint(saved.checkpoint);
  expect(restored.game.moveHistory).toHaveLength(1);
  expect(restored.game.getAllValidMoves().length).toBeGreaterThan(0);
  expect((await commitGameTransition(options, () => { throw Error('duplicate executed'); })).duplicate).toBe(true);
});

it('preserves an interrupted capture chain, draw history and pending offer through the codec', async () => {
  const state = decodeCheckpoint(checkpoint);
  state.game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  state.game.board[5][0] = { color: 'red', queen: false };
  for (const [r, c] of [[4, 1], [2, 3], [0, 7]]) state.game.board[r][c] = { color: 'black', queen: false };
  state.game.positionHistory = [state.game._boardHash()];
  state.game.makeMove(5, 0, 3, 2);
  state.pendingDrawOffer = black.id; state.lastDrawOffer[black.id] = Date.now();
  const encoded = encodeCheckpoint(state);
  await commitGameTransition({ key: run.key, expectedRevision: 0 }, () => encoded);
  const restored = decodeCheckpoint((await prisma.gameRun.findUnique({ where: { key: run.key } })).checkpoint);
  expect(restored.game.chainPiece).toEqual({ row: 3, col: 2 });
  expect(restored.game.positionHistory).toEqual(state.game.positionHistory);
  expect(restored.lastDrawOffer).toEqual(state.lastDrawOffer);
  expect(restored.pendingDrawOffer).toBe(black.id);
  expect(restored.game.makeMove(3, 2, 1, 4)).toBeTruthy();
});

it('rejects a nonparticipant and never aborts a durably started game as a failed start', async () => {
  await expect(commitGameTransition({ key: run.key, expectedRevision: 0, command: command({ userId: 2_147_483_647 }) }, () => checkpoint)).rejects.toThrow('not a participant');
  await commitGameTransition({ key: run.key, expectedRevision: 0 }, () => checkpoint);
  await expect(abortGameStart(run.key)).rejects.toThrow('started game');
});
