import { GameAnalytics } from '../src/lib/gameAnalytics.js';
import { CheckersGame } from '../shared/game.js';
import { SessionClient } from '../src/lib/sessionClient.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';

const idle = () => ({ phase: 'idle' });
function playing(overrides = {}) {
  return { phase: 'in-game', game: { gameId: 'one', yourColor: 'red', origin: 'bot', mode: 'FRIENDLY',
    started: false, gameOver: false, moveHistory: [], board: new CheckersGame().board, ...overrides } };
}
function history(plies = 1) {
  const game = new CheckersGame();
  for (let i = 0; i < plies; i++) {
    const move = game.getAllValidMoves()[0];
    game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
  }
  return game.moveHistory;
}
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
};
let analytics, track, storage;
const accept = snapshot => analytics.observe({ status: 'ready', snapshot });
beforeEach(() => {
  track = vi.fn(); storage = memoryStorage();
  analytics = new GameAnalytics({ track, storage: () => storage }); analytics.bind(1);
});

it('reports start after the colour reveal, first accepted own move, and result once', () => {
  accept(idle()); accept(playing()); expect(track).not.toHaveBeenCalled();
  accept(playing({ started: true }));
  accept(playing({ started: true, moveHistory: history() }));
  accept(playing({ started: true, moveHistory: history(), gameOver: true, winner: 'red' }));
  accept(playing({ started: true, moveHistory: history(), gameOver: true, winner: 'red', persistStatus: 'saved' }));
  expect(track.mock.calls.map(([name]) => name)).toEqual(['game_start', 'first_move', 'game_end']);
  expect(track.mock.calls.at(-1)[1].result).toBe('win');
});

it('does not call the opponent first move the player first move', () => {
  accept(idle()); accept(playing({ yourColor: 'black', started: true, moveHistory: history() }));
  expect(track.mock.calls.map(([name]) => name)).toEqual(['game_start']);
  accept(playing({ yourColor: 'black', started: true, moveHistory: history(2) }));
  expect(track.mock.calls.map(([name]) => name)).toEqual(['game_start', 'first_move']);
});

it('baselines an unknown restored game without replaying historical events', () => {
  accept(playing({ started: true, moveHistory: history(), gameOver: true, winner: 'red' }));
  expect(track).not.toHaveBeenCalled();
  accept(playing({ gameId: 'two', started: true }));
  expect(track).toHaveBeenCalledWith('game_start', expect.any(Object));
});

it('retains game flags across reconnect, browsing, and observer recreation in the tab', () => {
  accept(idle()); accept(playing({ started: true, moveHistory: history() }));
  analytics.bind(1); accept(playing({ started: true, moveHistory: history() }));
  accept(idle()); accept(playing({ started: true, moveHistory: history() }));
  analytics = new GameAnalytics({ track, storage: () => storage }); analytics.bind(1);
  accept(playing({ started: true, moveHistory: history(), gameOver: true, winner: null }));
  expect(track.mock.calls.map(([name]) => name)).toEqual(['game_start', 'first_move', 'game_end']);
  expect(track.mock.calls.at(-1)[1]).toMatchObject({ result: 'draw', recovered: true });
});

it('uses confirmed search-to-room-to-bot transitions for fallback, clearing cancelled journeys', () => {
  accept({ phase: 'matchmaking' });
  accept({ phase: 'in-room', room: { id: 'bot-room' } });
  accept({ phase: 'in-room', room: { id: 'bot-room', status: 'starting' } });
  accept(playing()); accept(playing({ started: true }));
  expect(track.mock.calls[0][1].source).toBe('fallback');
  accept({ phase: 'matchmaking' }); accept(idle());
  accept(playing({ gameId: 'two', started: true }));
  expect(track.mock.calls[1][1].source).toBe('bot');
});

it('does not attribute a human match to a rejected fallback click', () => {
  accept({ phase: 'matchmaking' });
  analytics.observe({ status: 'ready', snapshot: analytics.previous, error: 'Cannot play bot' });
  accept(playing({ origin: 'quickplay', started: true }));
  expect(track.mock.calls[0][1].source).toBe('quickplay');
});

it('scopes flags to participants and clears journey attribution on account change', () => {
  accept(idle()); accept(playing({ started: true }));
  accept({ phase: 'matchmaking' }); analytics.bind(2);
  accept(idle()); accept(playing({ started: true }));
  expect(track.mock.calls.map(([, params]) => params.source)).toEqual(['bot', 'bot']);
});

it('does not count spectators or unconfirmed/replaced session states', () => {
  accept({ phase: 'spectating', spectate: { gameState: playing().game } });
  for (const status of ['syncing', 'reconnecting', 'replaced', 'disconnected']) {
    analytics.observe({ status, snapshot: playing({ started: true }) });
  }
  expect(track).not.toHaveBeenCalled();
});

it('baselines a different game after a recovery gap without retaining stale search attribution', () => {
  analytics.observe({ status: 'ready', snapshot: { phase: 'matchmaking' }, recovery: 1 });
  analytics.observe({ status: 'ready', snapshot: playing({ started: true, moveHistory: history() }), recovery: 2 });
  expect(track).not.toHaveBeenCalled();
  analytics.observe({ status: 'ready', snapshot: playing({ started: true, gameOver: true, winner: 'black' }), recovery: 2 });
  expect(track).toHaveBeenCalledWith('game_end', expect.objectContaining({ result: 'loss' }));
});

it('reports new evidence for a known game after reconnect as recovered', () => {
  analytics.observe({ status: 'ready', snapshot: idle(), recovery: 1 });
  analytics.observe({ status: 'ready', snapshot: playing({ started: true }), recovery: 1 });
  analytics.observe({ status: 'ready', snapshot: playing({ started: true, moveHistory: history() }), recovery: 2 });
  expect(track).toHaveBeenLastCalledWith('first_move', expect.objectContaining({ recovered: true }));
});

it('does not claim a link conversion from room origin alone and shares cancelled-result policy', () => {
  accept(idle()); accept(playing({ origin: 'room', started: true }));
  accept(playing({ origin: 'room', started: true, gameOver: true, endReason: 'restart-abandoned' }));
  expect(track.mock.calls[0][1].source).toBe('room');
  expect(track.mock.calls[1][1].result).toBe('aborted');
});

it('reports accepted invitation entry and preserves its confirmed source across observer recreation', () => {
  accept(idle()); accept(playing({ origin: 'room', enteredViaInvite: true }));
  analytics = new GameAnalytics({ track, storage: () => storage }); analytics.bind(1);
  accept(playing({ origin: 'room', enteredViaInvite: true, started: true }));
  expect(track).toHaveBeenCalledWith('game_start', expect.objectContaining({ source: 'invite', recovered: true }));
  accept(playing({ origin: 'room', enteredViaInvite: true, started: true }));
  expect(track).toHaveBeenCalledTimes(1);
  accept(playing({ gameId: 'rematch', origin: 'room', enteredViaInvite: false, started: true }));
  expect(track).toHaveBeenLastCalledWith('game_start', expect.objectContaining({ source: 'room' }));
});

it('never attributes an invitation from spectating or a rejected join', () => {
  accept(idle());
  analytics.observe({ status: 'ready', snapshot: analytics.previous, error: 'Room no longer available' });
  accept({ phase: 'spectating', spectate: { gameState: playing({ enteredViaInvite: true }).game } });
  expect(track).not.toHaveBeenCalled();
  accept(idle()); accept(playing({ started: true }));
  expect(track).toHaveBeenCalledWith('game_start', expect.objectContaining({ source: 'bot' }));
});

it('requires participant entry evidence even if an origin is named invite', () => {
  accept(idle()); accept(playing({ origin: 'invite', enteredViaInvite: false, started: true }));
  expect(track).toHaveBeenCalledWith('game_start', expect.objectContaining({ source: 'unknown' }));
});

it.each(['denied', 'corrupt', 'throwing transport'])('keeps analytics optional with %s', failure => {
  if (failure === 'denied') analytics.storage = () => { throw new Error('Denied'); };
  if (failure === 'corrupt') storage.setItem('checkers_game_events_v1', '{');
  if (failure === 'throwing transport') track.mockImplementation(() => { throw new Error('No analytics'); });
  expect(() => { accept(idle()); accept(playing({ started: true })); accept(playing({ started: true })); }).not.toThrow();
  expect(track).toHaveBeenCalledTimes(1);
});

it('bounds stored history and does not rewrite it on every clock snapshot', () => {
  const write = vi.spyOn(storage, 'setItem');
  accept(idle()); accept(playing({ started: true }));
  accept(playing({ started: true, redTime: 10 }));
  expect(write).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 140; i++) accept(playing({ gameId: `game-${i}`, started: true }));
  expect(JSON.parse(storage.getItem('checkers_game_events_v1'))).toHaveLength(128);
});

it('normalizes old room-as-invite journals without replaying completed events', () => {
  storage.setItem('checkers_game_events_v1', JSON.stringify([
    [JSON.stringify([1, 'one']), { source: 'invite', start: false, move: false, end: false }]
  ]));
  accept(idle()); accept(playing({ origin: 'room', started: true }));
  expect(track).toHaveBeenCalledWith('game_start', expect.objectContaining({ source: 'room' }));
  analytics.bind(1); accept(playing({ origin: 'room', started: true }));
  expect(track).toHaveBeenCalledTimes(1);
});

it('reports a committed first move with lost acknowledgements and ignores stale transport snapshots', async () => {
  const listeners = new Map(), sent = [];
  const socket = { id: 'c1', connected: true, on: (name, fn) => listeners.set(name, fn), off() {},
    emit: (name, data, ack) => sent.push({ name, data, ack }) };
  const client = new SessionClient({ publish: value => analytics.observe(value), id: () => 'cmd' });
  const packet = (sequence, state) => ({ protocolVersion: PROTOCOL_VERSION, serverId: 's1', connectionId: socket.id,
    sequence, serverTime: Date.now(), context: {}, ...state });
  client.bind(socket);
  try {
    client.accept(packet(1, idle())); client.accept(packet(2, playing({ started: true })));
    const pending = client.send('game:move', {});
    client.accept(packet(3, playing({ started: true, moveHistory: history() })));
    client.accept(packet(2, playing({ started: true })));
    client.recover(); client.accept(packet(4, playing({ started: true, moveHistory: history() })));
    expect(track.mock.calls.map(([name]) => name)).toEqual(['game_start', 'first_move']);
    sent.find(call => call.name === 'session:command').ack({ ok: true, snapshot: packet(3, playing({ started: true, moveHistory: history() })) });
    await pending;
    expect(track).toHaveBeenCalledTimes(2);
  } finally { client.unbind(); }
});
