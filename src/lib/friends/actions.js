import { writable } from 'svelte/store';
import { user, captureSession } from '../stores/user.js';
import { api } from '../api.js';
import { withDeadline } from '../actions/deadline.js';
import { FriendshipJournal } from './journal.js';

export const friendshipState = writable({ pending: null, busy: false, blocked: false, error: '' });
let journal;
function getJournal() {
  if (!journal) {
    journal = new FriendshipJournal({ uuid: () => crypto.randomUUID(), publish: friendshipState.set,
      storage: { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: key => window.sessionStorage.removeItem(key) },
      send: (kind, body) => withDeadline(signal => kind === 'remove'
        ? api.del('/friends/' + body.friendshipId, { requestId: body.requestId }, { signal })
        : api.post('/friends/' + kind, body, { signal }))
    });
    user.subscribe(value => journal.setIdentity(value?.id ?? null, captureSession().generation));
  }
  return journal;
}
export const initializeFriendshipActions = () => getJournal();
export const performFriendshipAction = (kind, payload) => getJournal().start(kind, payload);
export const retryFriendshipAction = () => getJournal().retry();
