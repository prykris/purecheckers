import { getOrCreateSession, getSession, setPhase, handleDisconnect, handleReconnect, removeSession, setDisconnectCallbacks } from '../server/domain/sessions.js';

describe('disconnect grace periods', () => {
  let gameTimeout, roomTimeout;
  beforeEach(() => {
    vi.useFakeTimers();
    gameTimeout = vi.fn(); roomTimeout = vi.fn();
    setDisconnectCallbacks({ onGameTimeout: gameTimeout, onRoomTimeout: roomTimeout });
    getOrCreateSession(90001, 'Grace test', false);
  });
  afterEach(() => { removeSession(90001); vi.useRealTimers(); });
  it('forfeits only after the full game grace period', () => {
    setPhase(90001, 'in-game', { gameId: 71, gameColor: 'red' });
    handleDisconnect(90001);
    vi.advanceTimersByTime(29999); expect(gameTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(gameTimeout).toHaveBeenCalledOnce();
    expect(gameTimeout.mock.calls[0].slice(0, 2)).toEqual([90001, 71]);
  });
  it('cancels the old timeout on reconnect and gives a new disconnect its own deadline', () => {
    setPhase(90001, 'in-game', { gameId: 71, gameColor: 'red' });
    handleDisconnect(90001); vi.advanceTimersByTime(29000);
    handleReconnect(90001, 'replacement');
    vi.advanceTimersByTime(60000); expect(gameTimeout).not.toHaveBeenCalled();
    expect(getSession(90001).connectionId).toBe('replacement');
    handleDisconnect(90001); vi.advanceTimersByTime(30000);
    expect(gameTimeout).toHaveBeenCalledOnce();
  });
  it('uses a separate two-minute grace period for waiting rooms', () => {
    setPhase(90001, 'in-room', { roomId: 13 }); handleDisconnect(90001);
    vi.advanceTimersByTime(119999); expect(roomTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(roomTimeout).toHaveBeenCalledOnce();
    expect(gameTimeout).not.toHaveBeenCalled();
  });
});
