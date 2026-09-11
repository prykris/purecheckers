import { AUTH_PATHS } from './siteNavigation.js';
import { page } from '$app/state';
import { pushState, replaceState, goto } from '$app/navigation';
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
  function write(url, mode) {
    if (Object.values(AUTH_PATHS).includes(new URL(url, read()).pathname)) {
      return goto(url, { replaceState: mode !== 'push' });
    }
    const current = new URL(read());
    const state = mode === 'push' ? { returnTo: current.pathname + current.search } : page.state;
    (mode === 'push' ? pushState : replaceState)(url, state);
  }
  navigationController.start({ read, write });
  return () => { window.removeEventListener('popstate', onPopState); unsubscribeUser(); unsubscribeSession(); navigationController.stop(); };
}
