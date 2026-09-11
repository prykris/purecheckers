import { enqueueSessionWork } from '../server/domain/sessionWork.js';
import { attachCommandTransport } from '../server/socket/commandRouter.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';
import { EventEmitter } from 'node:events';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

it('orders overlapping pairs and commands without blocking unrelated players', async () => {
  const a = {}, b = {}, c = {}, d = {}, gate = deferred(), events = [];
  const first = enqueueSessionWork([a], () => gate.promise);
  const pair = enqueueSessionWork([a, b], () => events.push('a+b'));
  const nextPair = enqueueSessionWork([b, c], () => events.push('b+c'));
  const cancel = enqueueSessionWork([a], () => events.push('cancel'));
  await enqueueSessionWork([d], () => events.push('unrelated'));
  expect(events).toEqual(['unrelated']);
  gate.resolve();
  await Promise.all([first, pair, nextPair, cancel]);
  expect(events.indexOf('a+b')).toBeLessThan(events.indexOf('b+c'));
  expect(events.indexOf('a+b')).toBeLessThan(events.indexOf('cancel'));
});

it('allows recovery after failed work and keeps the original failure observable', async () => {
  const session = {}, gate = deferred(), restored = vi.fn();
  const failed = enqueueSessionWork([session], () => gate.promise);
  const failure = expect(failed).rejects.toThrow('unavailable');
  const recovery = enqueueSessionWork([session, session, null], restored);
  gate.reject(Error('unavailable'));
  await failure; await recovery;
  expect(restored).toHaveBeenCalledOnce();
});

it('does not start reconnect recovery until the preceding command has settled', async () => {
  const session = {}, gate = deferred(), events = [];
  const command = enqueueSessionWork([session], async () => {
    events.push('command'); await gate.promise; events.push('committed');
  });
  const recovery = enqueueSessionWork([session], () => events.push('restored'));
  await enqueueSessionWork([{}], () => {});
  expect(events).toEqual(['command']);
  gate.resolve(); await Promise.all([command, recovery]);
  expect(events).toEqual(['command', 'committed', 'restored']);
});

it('does not dispatch through an incompletely restored connection after recovery fails', async () => {
  const socket = Object.assign(new EventEmitter(), { id: 'connection', userId: 1 });
  const session = { connectionId: socket.id, reconcilingConnectionId: socket.id };
  const dispatch = vi.fn(), publish = vi.fn();
  const restore = enqueueSessionWork([session], () => { throw Error('database unavailable'); });
  const failure = expect(restore).rejects.toThrow('database unavailable');
  attachCommandTransport(socket, session, { serverId: 'server', dispatch, publish });
  const result = await new Promise(ack => socket.emit('session:command', {
    id: 'command', type: 'room:create', protocolVersion: PROTOCOL_VERSION, serverId: 'server', createdAt: Date.now()
  }, ack));
  await failure;
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining('recovery is incomplete') });
  expect(dispatch).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});
