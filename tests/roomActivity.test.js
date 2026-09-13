import { roomActivity } from '../src/lib/roomActivity.js';
import { canInviteToRoom, canReceiveRoomInvite } from '../shared/roomInvitations.js';
const room = (changes = {}) => ({ id: 9, hostId: 1, status: 'waiting', settings: { buyIn: 0, autoReady: false },
  players: [{ userId: 1, ready: false, online: true }, { userId: 2, ready: true, online: true }], ...changes });
it('offers Play when the opponent is ready and the local player has not confirmed yet', () => {
  expect(roomActivity(room(), 1)).toMatchObject({ label: 'Opponent ready', action: 'Play', quickPlay: true, ready: true });
});
it('distinguishes local readiness from opponent readiness', () => {
  expect(roomActivity(room(), 2)).toMatchObject({ label: "You're ready · waiting", action: 'Open room', quickPlay: false });
});
it.each(['updating', 'starting', 'playing'])('never quick-readies during %s', status => {
  expect(roomActivity(room({ status }), 1).quickPlay).toBe(false);
});
it('requires review for a wager and never offers spectator consent', () => {
  expect(roomActivity(room({ settings: { buyIn: 10 } }), 1)).toMatchObject({ action: 'Review room', quickPlay: false });
  expect(roomActivity(room(), 3)).toMatchObject({ label: 'Watching a room', quickPlay: false });
});
it('does not treat a disconnected opponent as ready', () => {
  const current = room(); current.players[1].online = false;
  expect(roomActivity(current, 1)).toMatchObject({ label: 'Opponent disconnected', quickPlay: false, ready: false });
});
it('can retry starting a free room when both players are ready', () => {
  const current = room(); current.players[0].ready = true;
  expect(roomActivity(current, 1)).toMatchObject({ label: 'Both players ready', quickPlay: true });
});
it('allows only the host of a waiting open seat to invite from a profile', () => {
  const current = room(); current.players.pop();
  expect(canInviteToRoom(current, 1)).toBe(true);
  expect(canInviteToRoom(current, 2)).toBe(false);
  expect(canInviteToRoom({ ...current, challenge: {} }, 1)).toBe(false);
  expect(canInviteToRoom({ ...current, status: 'starting' }, 1)).toBe(false);
  expect(canInviteToRoom(room(), 1)).toBe(false);
});
it('uses the same eligible recipient rules for profiles and the friends picker', () => {
  const player = { id: 2, profilePublic: true, isGuest: false, isBot: false };
  expect(canReceiveRoomInvite(player, 1)).toBe(true);
  expect(canReceiveRoomInvite(player, 2)).toBe(false);
  expect(canReceiveRoomInvite({ ...player, profilePublic: false }, 1)).toBe(false);
  expect(canReceiveRoomInvite({ ...player, isGuest: true }, 1)).toBe(false);
  expect(canReceiveRoomInvite({ ...player, profilePublic: false, isGuest: true }, 1, true)).toBe(true);
  expect(canReceiveRoomInvite({ ...player, isBot: true }, 1, true)).toBe(false);
});
