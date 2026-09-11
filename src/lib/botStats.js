import { ReadResource } from './readResource.js';
import { BOT_DIFFICULTIES } from '../../shared/bots.js';

function parseStats(value) {
  if (!Array.isArray(value?.stats) || value.stats.length !== BOT_DIFFICULTIES.length) throw Error('Invalid bot stats');
  return BOT_DIFFICULTIES.map(difficulty => {
    const rows = value.stats.filter(row => row?.difficulty === difficulty);
    if (rows.length !== 1 || !['wins', 'draws', 'losses'].every(key => Number.isSafeInteger(rows[0][key]) && rows[0][key] >= 0)) throw Error('Invalid bot stats');
    return rows[0];
  });
}

export function createBotStats({ request, readScope, isCurrent, publish }) {
  return new ReadResource({ readScope, isCurrent, publish,
    load: async ({ scope, signal }) => parseStats(await request('/bots/me/stats', { signal, authToken: scope.token })),
  });
}

// Clear immediately on account replacement, refresh on mount/reconnect/focus.
// Returning from a game mounts a fresh picker and reads the committed result.
export function bindBotStats({ resource, user, session, capture, onFocus }) {
  let generation, accountId, recovery;
  const refresh = () => { if (capture().token) void resource.refresh(); };
  const offUser = user.subscribe(value => {
    const next = capture().generation;
    if (generation === next && accountId === value?.id) return;
    generation = next; accountId = value?.id; resource.reset();
    if (value) refresh();
  });
  const offSession = session.subscribe(value => {
    if (value.status !== 'ready' || recovery === value.recovery) return;
    recovery = value.recovery;
    if (resource.state.status !== 'loading') refresh();
  });
  const offFocus = onFocus(refresh);
  return () => { offUser(); offSession(); offFocus(); resource.reset(); resource.dispose(); };
}
