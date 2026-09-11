import { withDeadline } from '../actions/deadline.js';
import { writable } from 'svelte/store';
import { user, captureSession, isCurrentSession } from '../stores/user.js';
import { api, refreshSession } from '../api.js';
import { WalletJournal } from './journal.js';
import { refreshAppearance } from '../stores/appearance.js';

export const walletState = writable({ pending: null, busy: false, blocked: false, error: '' });
let journal;

function getJournal() {
  if (!journal) {
    // Resolve storage inside the adapter: browsers may throw while accessing it.
    const storage = {
      getItem: key => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: key => window.sessionStorage.removeItem(key)
    };
    journal = new WalletJournal({ storage, uuid: () => crypto.randomUUID(), publish: walletState.set,
      send: (kind, body) => withDeadline(signal => kind === 'equip' ? api.patch('/shop/equip', body, { signal })
        : api.post(kind === 'purchase' ? '/shop/purchase' : '/coins/tip', body, { signal })),
      // A receipt's balance is historical; fetch the current account while the
      // journal still prevents a second action from racing this reconciliation.
      confirm: async receipt => {
        const scope = captureSession();
        // Equipment is a separate read projection; historical selection receipts
        // must never install a palette over a newer selection.
        if (typeof receipt.equipped === 'boolean') await refreshAppearance();
        if (!isCurrentSession(scope)) return;
        await withDeadline(signal => refreshSession({ signal }));
      } });
    // This is an application-lifetime service, shared across both screens.
    user.subscribe(value => journal.setIdentity(value?.id ?? null, captureSession().generation));
  }
  return journal;
}

export function initializeWalletActions() { getJournal(); }


export const performWalletAction = (kind, payload) => getJournal().start(kind, payload);
export const retryWalletAction = () => getJournal().retry();
