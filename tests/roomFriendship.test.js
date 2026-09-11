import { suggestRoomFriendship, friendshipWith } from '../shared/roomFriendship.js';

it('suggests friendship for the shared room when either human joined by invitation', () => {
  const host = { userId: 1 }, guest = { userId: 2, isGuest: true, joinedViaInvite: true };
  expect(suggestRoomFriendship({ players: [host, guest] })).toBe(true);
  expect(suggestRoomFriendship({ players: [guest, host] })).toBe(true);
  expect(suggestRoomFriendship({ players: [host] })).toBe(false);
  expect(suggestRoomFriendship({ players: [host, { userId: 2 }] })).toBe(false);
  expect(suggestRoomFriendship({ players: [host, { ...guest, isBot: true }] })).toBe(false);
});

it('projects Add, incoming Accept, outgoing and already-friends states from the existing friends response', () => {
  const data = { friends: [{ id: 2, friendshipId: 10 }], requests: [{ id: 11, requester: { id: 3 } }], outgoing: [{ id: 12, receiver: { id: 4 } }] };
  expect(friendshipWith(null, 2)).toEqual({ kind: 'unknown' });
  expect(friendshipWith(data, 2)).toEqual({ kind: 'friends', id: 10 });
  expect(friendshipWith(data, 3)).toEqual({ kind: 'incoming', id: 11 });
  expect(friendshipWith(data, 4)).toEqual({ kind: 'outgoing', id: 12 });
  expect(friendshipWith(data, 5)).toEqual({ kind: 'none' });
});
