import { pushState, replaceState } from '$app/navigation';
import { navigationController } from './stores/navigation.js';
import { session } from './stores/session.js';
import { user } from './stores/user.js';

// The only History API adapter. SvelteKit retains ownership of its history metadata.
export function attachBrowserNavigation() {
  const unsubscribeUser = user.subscribe(value => navigationController.setIdentity(value?.id ?? null));
  const unsubscribeSession = session.subscribe(value => navigationController.setSession(value));
  const read = () => window.location.href;
  const onLocation = () => navigationController.locationChanged(read());
  const onPopState = () => queueMicrotask(onLocation);
  window.addEventListener('popstate', onPopState);
  navigationController.start({ read, write: (url, mode) => (mode === 'push' ? pushState : replaceState)(url, {}) });
  return () => { window.removeEventListener('popstate', onPopState); unsubscribeUser(); unsubscribeSession(); navigationController.stop(); };
}
