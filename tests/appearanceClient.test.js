import { writable } from 'svelte/store';
import { AppearanceClient, bindAppearance } from '../src/lib/appearanceClient.js';
import { DEFAULT_PIECE_SKIN } from '../shared/pieceSkins.js';
import { normalizeTheme, DEFAULT_THEME_VARS } from '../shared/themes.js';
import { renderTheme } from '../src/lib/theme.js';

const data = id => ({ skin: id ? { itemId: id, name: 'Skin ' + id, palette: DEFAULT_PIECE_SKIN } : null, theme: null });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

it('validates theme colours, preserves accepted appearance on malformed responses and restores every default colour', async () => {
  const h = fixture(), theme = { itemId: 2, name: 'Ocean', vars: normalizeTheme({ '--bg': '#0a1628' }) };
  h.load.mockResolvedValue({ skin: null, theme });
  expect(await h.client.refresh()).toBe(true);
  for (const vars of [{ '--bg': 'url(https://example.com)' }, { position: 'fixed' }, {}]) {
    h.load.mockResolvedValue({ skin: null, theme: { ...theme, vars } });
    expect(await h.client.refresh()).toBe(false);
    expect(h.state().data.theme).toEqual(theme);
  }
  const properties = {}, root = { style: { setProperty: (key, value) => { properties[key] = value; } } };
  renderTheme(theme, root); expect(properties['--bg']).toBe('#0a1628');
  h.replace(); renderTheme(h.state().data?.theme, root);
  expect(properties).toEqual(DEFAULT_THEME_VARS);
  h.client.dispose();
});
function fixture() {
  let generation = 1, state;
  const load = vi.fn().mockResolvedValue(data(1));
  const capture = () => ({ generation, token: 'token' });
  const client = new AppearanceClient({ load, readScope: capture, isCurrent: scope => scope.generation === generation, publish: value => { state = value; } });
  return { client, load, capture, state: () => state, replace: () => { generation++; client.reset(); } };
}

it('only publishes the latest read and ignores old selections after account replacement or disposal', async () => {
  const h = fixture(), first = deferred(), second = deferred();
  h.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const a = h.client.refresh(), b = h.client.refresh();
  second.resolve(data(2)); await b; first.resolve(data(1)); await a;
  expect(h.state().data.skin.itemId).toBe(2);
  for (const action of ['replace', 'dispose']) {
    const pending = deferred(); h.load.mockReturnValueOnce(pending.promise);
    const read = h.client.refresh(); action === 'replace' ? h.replace() : h.client.dispose();
    const state = h.state(); pending.resolve(data(3)); expect(await read).toBe(false); expect(h.state()).toBe(state);
  }
});

it('distinguishes no equipped skin from an invalid/failed read and preserves the last accepted appearance', async () => {
  const h = fixture(); await h.client.refresh();
  for (const result of [{}, { skin: {} }, { skin: { ...data(2).skin, palette: { red: {}, black: {} } } }]) {
    h.load.mockResolvedValue(result); expect(await h.client.refresh()).toBe(false);
    expect(h.state()).toMatchObject({ status: 'error', data: data(1) });
  }
  h.load.mockResolvedValue(data(null)); expect(await h.client.refresh()).toBe(true); expect(h.state().data).toEqual(data(null)); h.client.dispose();
});

it('binds once to account generations, recovery and focus, and removes all effects on disposal', async () => {
  const h = fixture(), user = writable({ id: 1 }), session = writable({ status: 'disconnected', recovery: 0 });
  let focus; const off = vi.fn();
  const stop = bindAppearance({ client: h.client, user, session, capture: h.capture, onFocus: callback => { focus = callback; return off; } });
  await vi.waitFor(() => expect(h.state().status).toBe('ready'));
  user.set({ id: 1, coins: 50 }); expect(h.load).toHaveBeenCalledTimes(1);
  session.set({ status: 'ready', recovery: 1 }); await vi.waitFor(() => expect(h.load).toHaveBeenCalledTimes(2));
  session.set({ status: 'ready', recovery: 1 }); expect(h.load).toHaveBeenCalledTimes(2);
  focus(); await vi.waitFor(() => expect(h.load).toHaveBeenCalledTimes(3));
  h.replace(); user.set({ id: 2 }); await vi.waitFor(() => expect(h.load).toHaveBeenCalledTimes(4));
  stop(); expect(off).toHaveBeenCalledOnce(); expect(h.state().data).toBeNull();
  user.set({ id: 3 }); session.set({ status: 'ready', recovery: 2 }); focus(); expect(h.load).toHaveBeenCalledTimes(4);
});
