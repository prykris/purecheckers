import { withDeadline } from '../actions/deadline.js';
import { writable } from 'svelte/store';
import { user, captureSession } from '../stores/user.js';
import { api, refreshSession } from '../api.js';
import { AdminJournal } from './journal.js';

export const adminState = writable({ pending: null, busy: false, blocked: false, error: '' });
let journal;
function getJournal() {
  if (!journal) {
    journal = new AdminJournal({
      storage: {
        getItem: key => window.sessionStorage.getItem(key),
        setItem: (key, value) => window.sessionStorage.setItem(key, value),
        removeItem: key => window.sessionStorage.removeItem(key)
      },
      uuid: () => crypto.randomUUID(), publish: adminState.set,
      send: (kind, body) => withDeadline(signal => api.post('/admin/' + kind, body, { signal })),
      confirm: () => withDeadline(signal => refreshSession({ signal }))
    });
    user.subscribe(value => journal.setIdentity(value?.id ?? null, captureSession().generation));
  }
  return journal;
}
export const initializeAdminActions = () => getJournal();
export const performAdminAction = (kind, payload) => getJournal().start(kind, payload);
export const retryAdminAction = () => getJournal().retry();
