import { createGameEmoteAction } from '../server/domain/gameEmotes.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  const actor = { userId: 1, username: 'Player', connectionId: 'current' };
  const session = { phase: 'in-game', gameId: 7, connectionId: 'current' };
  let room = { started: true, game: { gameOver: false }, getPlayerColor: id => id === 1 ? 'red' : null };
  let current = true, time = 1000;
  const resolve = vi.fn().mockResolvedValue({ id: 3, name: 'GG', emoji: '🤝', label: 'GG' }), publish = vi.fn();
  const action = createGameEmoteAction(actor, { getGame: id => id === 7 ? room : null, getSession: () => session, resolve, publish, now: () => time });
  return { actor, session, room, resolve, publish, send: data => action(data, null, { isCurrent: () => current }),
    replace: () => { room = { ...room }; }, stopOwner: () => { current = false; }, advance: n => { time += n; } };
}

it('publishes only the resolved catalogue content and bounds repeats using server time', async () => {
  const h = fixture();
  expect(await h.send({ gameId: 7, itemId: 3, emote: { emoji: 'forged' } })).toEqual({ ok: true });
  expect(h.publish).toHaveBeenCalledWith(7, { gameId: 7, userId: 1, username: 'Player', spectator: false, emote: { id: 3, name: 'GG', emoji: '🤝', label: 'GG' } });
  expect(await h.send({ gameId: 7, itemId: 3 })).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
  expect(h.resolve).toHaveBeenCalledTimes(1);
  h.advance(2000); expect(await h.send({ gameId: 7, itemId: 3 })).toEqual({ ok: true });
});

it('allows at most one lookup per player, recovers lookup failure and does not broadcast denied content', async () => {
  const h = fixture(), pending = deferred(); h.resolve.mockReturnValueOnce(pending.promise);
  const first = h.send({ gameId: 7, itemId: 3 });
  expect(await h.send({ gameId: 7, itemId: 3 })).toMatchObject({ code: 'RATE_LIMITED' });
  pending.reject(Error('database unavailable')); await expect(first).rejects.toThrow('database unavailable');
  expect(await h.send({ gameId: 7, itemId: 3 })).toMatchObject({ code: 'RATE_LIMITED' });
  h.advance(2000);
  h.resolve.mockResolvedValueOnce(null);
  expect(await h.send({ gameId: 7, itemId: 3 })).toMatchObject({ code: 'EMOTE_UNAVAILABLE' });
  expect(h.publish).not.toHaveBeenCalled();
  h.advance(2000);
  expect(await h.send({ gameId: 7, itemId: 3 })).toEqual({ ok: true });
});

it.each(['depart', 'connection', 'terminal', 'recovery', 'runtime', 'replace', 'owner'])('discards a lookup completed after %s', async change => {
  const h = fixture(), pending = deferred(); h.resolve.mockReturnValue(pending.promise);
  const first = h.send({ gameId: 7, itemId: 3 });
  if (change === 'depart') h.session.gameId = null;
  if (change === 'connection') h.session.connectionId = 'new';
  if (change === 'terminal') h.room.game.gameOver = true;
  if (change === 'recovery') h.room.recovery = {};
  if (change === 'runtime') h.room.runtimeStopped = true;
  if (change === 'replace') h.replace();
  if (change === 'owner') h.stopOwner();
  pending.resolve({ id: 3, emoji: '🤝', label: 'GG' });
  expect(await first).toMatchObject({ code: 'GAME_UNAVAILABLE' }); expect(h.publish).not.toHaveBeenCalled();
});

it('rejects malformed, legacy and out-of-context sends before looking up inventory', async () => {
  const h = fixture();
  for (const data of [{ gameId: 7, emote: { emoji: 'forged' } }, { gameId: 7, itemId: '3' }, { gameId: 7, itemId: -1 }, { gameId: 8, itemId: 3 }]) expect((await h.send(data)).ok).toBe(false);
  h.session.phase = 'idle'; expect((await h.send({ gameId: 7, itemId: 3 })).ok).toBe(false);
  h.session.phase = 'in-game'; h.room.started = false; expect((await h.send({ gameId: 7, itemId: 3 })).ok).toBe(false);
  expect(h.resolve).not.toHaveBeenCalled();
});


it.each([false, true])('allows owned reactions while spectating a game, ended=%s', async ended => {
  const h = fixture(); h.room.game.gameOver = ended; h.room.getPlayerColor = () => null;
  Object.assign(h.session,{phase:'spectating',gameId:null,spectatingGameId:7});
  expect(await h.send({gameId:7,itemId:3})).toEqual({ok:true});
  expect(h.publish.mock.calls[0][1]).toMatchObject({spectator:true,userId:1});
});
it('denies a spectator reaction that finishes resolving after departure', async () => {
  const h=fixture(), pending=deferred(); h.resolve.mockReturnValue(pending.promise);
  Object.assign(h.session,{phase:'spectating',gameId:null,spectatingGameId:7});
  const result=h.send({gameId:7,itemId:3}); h.session.spectatingGameId=8;
  pending.resolve({id:3,emoji:'GG'});
  expect(await result).toMatchObject({ok:false,code:'GAME_UNAVAILABLE'});
  expect(h.publish).not.toHaveBeenCalled();
});
it('allows a new participant reaction after the game ends while they still view it',async()=>{
  const h=fixture(); h.room.game.gameOver=true;
  expect(await h.send({gameId:7,itemId:3})).toEqual({ok:true});
});
