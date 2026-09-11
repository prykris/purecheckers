import { ReadResource } from './readResource.js';
import { normalizePieceSkin } from '../../shared/pieceSkins.js';
import { normalizeTheme } from '../../shared/themes.js';

export class AppearanceClient extends ReadResource {
  constructor({ load, ...options }) {
    super({ ...options, load: async context => {
      const data = await load(context);
      const read = (item, normalize, field) => {
        if (item === null) return null;
        const value = normalize(item?.[field]);
        if (!item || !Number.isSafeInteger(item.itemId) || item.itemId < 1 || typeof item.name !== 'string' || !value) throw Error('Could not confirm your appearance. Please retry.');
        return { itemId: item.itemId, name: item.name, [field]: value };
      };
      return { skin: read(data?.skin, normalizePieceSkin, 'palette'), theme: read(data?.theme, normalizeTheme, 'vars') };
    } });
  }
}

// Lifecycle binding is kept above the renderer. Account replacement clears the
// prior selection immediately; profile updates do not duplicate inventory reads.
export function bindAppearance({ client, user, session, capture, onFocus }) {
  let generation, recovery;
  const unsubscribeUser = user.subscribe(value => {
    const next = capture().generation;
    if (generation === next) return;
    generation = next; client.reset();
    if (value) void client.refresh();
  });
  const unsubscribeSession = session.subscribe(value => {
    if (value.status !== 'ready' || recovery === value.recovery) return;
    recovery = value.recovery;
    if (capture().token && client.state.status !== 'loading') void client.refresh();
  });
  const offFocus = onFocus(() => { if (capture().token) void client.refresh(); });
  return () => { unsubscribeUser(); unsubscribeSession(); offFocus(); client.reset(); client.dispose(); };
}
