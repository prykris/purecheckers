import { getOrCreateSession, getSession, setPhase, forceIdle, handleDisconnect, handleReconnect, removeSession, setDisconnectCallbacks, setMatchmakingDeadline } from '../server/domain/sessions.js';
import { createSessionDispatcher, CommandRejected } from '../server/domain/sessionCommands.js';
import { createQuickPlayRoom } from '../server/domain/rooms.js';
import { quickPlayPool } from '../server/services/quickPlay.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { enqueueSessionWork } from '../server/domain/sessionWork.js';

describe('disconnect grace periods', () => {
  let gameTimeout;
  beforeEach(() => {
    vi.useFakeTimers();
    gameTimeout = vi.fn();
    setDisconnectCallbacks({ onGameTimeout: gameTimeout });
    getOrCreateSession(90001, 'Grace test', false);
  });
  afterEach(() => { removeSession(90001); vi.useRealTimers(); });
  it('forfeits only after the full game grace period', () => {
    setPhase(90001, 'in-game', { gameId: 71, gameColor: 'red' });
    handleDisconnect(90001);
    const deadline = getSession(90001).disconnectDeadline;
    expect(deadline).toBe(Date.now() + 30000);
    vi.advanceTimersByTime(1000); handleDisconnect(90001);
    expect(getSession(90001).disconnectDeadline).toBe(deadline);
    vi.advanceTimersByTime(28999); expect(gameTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(gameTimeout).toHaveBeenCalledOnce();
    expect(gameTimeout.mock.calls[0].slice(0, 2)).toEqual([90001, 71]);
  });
  it('cancels the old timeout on reconnect and gives a new disconnect its own deadline', () => {
    setPhase(90001, 'in-game', { gameId: 71, gameColor: 'red' });
    handleDisconnect(90001); vi.advanceTimersByTime(29000);
    handleReconnect(90001, 'replacement');
    expect(getSession(90001).disconnectDeadline).toBeNull();
    vi.advanceTimersByTime(60000); expect(gameTimeout).not.toHaveBeenCalled();
    expect(getSession(90001).connectionId).toBe('replacement');
    handleDisconnect(90001); vi.advanceTimersByTime(30000);
    expect(gameTimeout).toHaveBeenCalledOnce();
  });
  it('leaves waiting-room expiry to its durable room owner', () => {
    setPhase(90001, 'in-room', { roomId: 13 }); handleDisconnect(90001);
    expect(getSession(90001)).toMatchObject({ disconnectDeadline: null, disconnectTimer: null });
    vi.advanceTimersByTime(120000);
    expect(getSession(90001).phase).toBe('in-room');
    expect(gameTimeout).not.toHaveBeenCalled();
  });
  it('clears deadlines and timers on leaving their context', () => {
    setPhase(90001, 'in-room', { roomId: 13 }); handleDisconnect(90001);
    forceIdle(90001);
    expect(getSession(90001)).toMatchObject({ disconnectDeadline: null, disconnectTimer: null });
    vi.advanceTimersByTime(120000); expect(gameTimeout).not.toHaveBeenCalled();
  });
});

describe('search fallback deadline', () => {
  let onDeadline;
  beforeEach(() => {
    vi.useFakeTimers();
    onDeadline = vi.fn();
    const session = getOrCreateSession(90002, 'Searcher', false);
    session.connectionId = 'c1';
  });
  afterEach(() => { removeSession(90002); vi.useRealTimers(); });
  it('records the deadline on the session and fires once at the deadline while still searching', () => {
    setPhase(90002, 'matchmaking');
    const joinedAt = Date.now();
    expect(setMatchmakingDeadline(90002, joinedAt, joinedAt + 20000, onDeadline)).toBe(true);
    expect(getSession(90002)).toMatchObject({ matchmakingJoinedAt: joinedAt, matchmakingFallbackAt: joinedAt + 20000 });
    vi.advanceTimersByTime(19999); expect(onDeadline).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(onDeadline).toHaveBeenCalledWith(90002);
    expect(getSession(90002).fallbackTimer).toBeNull();
  });
  it('is cancelled by any phase change and never fires for a previous search', () => {
    setPhase(90002, 'matchmaking');
    setMatchmakingDeadline(90002, Date.now(), Date.now() + 20000, onDeadline);
    setPhase(90002, 'in-game', { gameId: 5, gameColor: 'black' });
    expect(getSession(90002)).toMatchObject({ matchmakingJoinedAt: null, matchmakingFallbackAt: null, fallbackTimer: null });
    vi.advanceTimersByTime(30000); expect(onDeadline).not.toHaveBeenCalled();
    forceIdle(90002); setPhase(90002, 'matchmaking');
    setMatchmakingDeadline(90002, Date.now(), Date.now() + 20000, onDeadline);
    forceIdle(90002);
    vi.advanceTimersByTime(30000); expect(onDeadline).not.toHaveBeenCalled();
  });
  it('arms no timer for a deadline that is already open, and refuses outside the search', () => {
    setPhase(90002, 'matchmaking');
    const joinedAt = Date.now();
    expect(setMatchmakingDeadline(90002, joinedAt, joinedAt, onDeadline)).toBe(true);
    expect(getSession(90002).fallbackTimer).toBeNull();
    expect(getSession(90002).matchmakingFallbackAt).toBe(joinedAt);
    forceIdle(90002);
    expect(setMatchmakingDeadline(90002, joinedAt, joinedAt + 1000, onDeadline)).toBe(false);
  });
});

describe('quick-play pairing against occupied sessions', () => {
  function pair() {
    quickPlayPool.add(90003, 1000, false); quickPlayPool.add(90004, 1000, false);
    return quickPlayPool.tryMatch()[0];
  }
  afterEach(() => { removeSession(90003); removeSession(90004); quickPlayPool.remove(90003); quickPlayPool.remove(90004); });
  it('a stale pool entry can no longer force-idle a player who is already in a game', async () => {
    await startGameplayOwnership();
    const playing = getOrCreateSession(90003, 'Playing', false); playing.connectionId = 'a';
    const searching = getOrCreateSession(90004, 'Searching', false); searching.connectionId = 'b';
    setPhase(90003, 'in-game', { gameId: 9, gameColor: 'red' });
    setPhase(90004, 'matchmaking');
    const { a, b } = pair();
    await createQuickPlayRoom(a, b);
    expect(getSession(90003)).toMatchObject({ phase: 'in-game', gameId: 9 });
    expect(getSession(90004).phase).toBe('matchmaking');
    expect(quickPlayPool.has(90004)).toBe(true);
  });
  it('leaving the search for a bot removes the pool entry so the pool never yields the pair', () => {
    quickPlayPool.add(90003, 1000, false);
    quickPlayPool.add(90004, 1000, false);
    quickPlayPool.remove(90003); // what bot:play does from the matchmaking phase
    expect(quickPlayPool.tryMatch()).toEqual([]);
    expect(quickPlayPool.has(90004)).toBe(true);
  });
  it('does not strand a replacement connection in the consumed search while its pair waits', async () => {
    await startGameplayOwnership();
    const a = getOrCreateSession(90003, 'Replaced', false), b = getOrCreateSession(90004, 'Partner', false);
    a.connectionId = 'old'; b.connectionId = 'partner';
    setPhase(a.userId, 'matchmaking'); setPhase(b.userId, 'matchmaking');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const earlier = enqueueSessionWork([a], () => gate);
    const entries = pair();
    const pairing = createQuickPlayRoom(entries.a, entries.b);
    handleReconnect(a.userId, 'replacement');
    release(); await earlier; await pairing;
    expect(a).toMatchObject({ phase: 'matchmaking', connectionId: 'replacement' });
    expect(b.phase).toBe('matchmaking');
    expect(quickPlayPool.players).toEqual([entries.a, entries.b]);
  });
  it('leaves a newer search untouched when cancelled pairing work finally runs', async () => {
    await startGameplayOwnership();
    const a = getOrCreateSession(90003, 'Rejoined', false), b = getOrCreateSession(90004, 'Partner', false);
    a.connectionId = 'a'; b.connectionId = 'b';
    setPhase(a.userId, 'matchmaking'); setPhase(b.userId, 'matchmaking');
    const entries = pair();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const previous = enqueueSessionWork([a], async () => {
      await gate;
      quickPlayPool.remove(a.userId); forceIdle(a.userId); setPhase(a.userId, 'matchmaking');
      quickPlayPool.add(a.userId, 1200, false);
    });
    const pairing = createQuickPlayRoom(entries.a, entries.b);
    release(); await previous; await pairing;
    expect(a.phase).toBe('matchmaking'); expect(b.phase).toBe('matchmaking');
    expect(quickPlayPool.players.map(p => p.userId)).toEqual([b.userId, a.userId]);
    expect(quickPlayPool.players[1].elo).toBe(1200);
    expect(quickPlayPool.ownsClaim(entries.a)).toBe(false);
  });
});

describe('finished-game dispatcher rule', () => {
  const context = session => ({ gameId: session.gameId, roomId: session.roomId, spectatingRoomId: session.spectatingRoomId });
  let session, actions, release;
  beforeEach(() => {
    session = getOrCreateSession(90005, 'Done', false);
    setPhase(90005, 'in-game', { gameId: 42, gameColor: 'red' });
    actions = { 'bot:play': vi.fn(), 'room:ready': vi.fn(), 'game:leave': vi.fn() };
    release = vi.fn(() => forceIdle(90005));
  });
  afterEach(() => removeSession(90005));
  it('accepts an idle command from a finished game after releasing it, in that order', async () => {
    const dispatch = createSessionDispatcher(session, actions, { finishedGame: gameId => gameId === 42, release });
    await dispatch({ type: 'bot:play', context: context(session), data: { difficulty: 'easy' } });
    expect(release).toHaveBeenCalledOnce();
    expect(actions['bot:play']).toHaveBeenCalledWith({ difficulty: 'easy' }, expect.objectContaining({ type: 'bot:play', data: { difficulty: 'easy' } }));
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(actions['bot:play'].mock.invocationCallOrder[0]);
    expect(session.phase).toBe('idle');
  });
  it('keeps live games, non-idle commands and stale contexts bound to the phase', async () => {
    const live = createSessionDispatcher(session, actions, { finishedGame: () => false, release });
    await expect(live({ type: 'bot:play', context: context(session), data: {} })).rejects.toBeInstanceOf(CommandRejected);
    const done = createSessionDispatcher(session, actions, { finishedGame: () => true, release });
    await expect(done({ type: 'room:ready', context: context(session), data: {} })).rejects.toBeInstanceOf(CommandRejected);
    await expect(done({ type: 'bot:play', context: { gameId: 41, roomId: null, spectatingRoomId: null }, data: {} })).rejects.toThrow(/previous room or game/);
    expect(release).not.toHaveBeenCalled();
    expect(session.phase).toBe('in-game');
    await done({ type: 'game:leave', context: context(session), data: { gameId: 42 } });
    expect(release).not.toHaveBeenCalled(); // an in-game command needs no release
  });
});
