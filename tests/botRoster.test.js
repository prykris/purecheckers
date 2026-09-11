import { createBotRoster } from '../src/lib/botRoster.js';
import { parseBotRoster } from '../shared/bots.js';

const payload = () => ({ bots: ['easy', 'medium', 'hard'].map((difficulty, i) => ({ key: difficulty, difficulty, displayName: ['Pip', 'Marge', 'The Colonel'][i], rating: 600 + i * 400 })) });
function fixture(request) {
  let state;
  const resource = createBotRoster({ request, publish: value => { state = value; } });
  return { resource, state: () => state };
}
afterEach(() => vi.useRealTimers());

it('loads public roster details without account credentials and orders them by difficulty', async () => {
  const data = payload(); data.bots.reverse(); data.bots[0].rating = 0;
  const request = vi.fn().mockResolvedValue(data), h = fixture(request);
  await h.resource.refresh();
  expect(request).toHaveBeenCalledWith('/bots', { authToken: null, signal: expect.any(AbortSignal) });
  expect(h.state().data.map(bot => bot.difficulty)).toEqual(['easy', 'medium', 'hard']);
  expect(h.state().data[2].rating).toBe(0);
  h.resource.dispose();
});

it.each([
  value => { value.bots.pop(); },
  value => { value.bots[1] = value.bots[0]; },
  value => { value.bots[0].key = 'hard'; },
  value => { value.bots[0].rating = '600'; },
  value => { value.bots[0].displayName = ' '; }
])('rejects a malformed roster as a whole', change => {
  const data = payload(); change(data);
  expect(() => parseBotRoster(data)).toThrow('Invalid bot roster');
});

it('exposes a failed load and permits an explicit retry', async () => {
  const h = fixture(vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(payload()));
  expect(await h.resource.refresh()).toBe(false);
  expect(h.state()).toMatchObject({ data: null, status: 'error' });
  expect(await h.resource.refresh()).toBe(true);
  expect(h.state().data).toHaveLength(3); h.resource.dispose();
});

it('discards a late response after the picker closes and fetches current data when reopened', async () => {
  let resolve;
  const request = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce(payload());
  const old = fixture(request), pending = old.resource.refresh();
  old.resource.dispose();
  const current = fixture(request); await current.resource.refresh();
  const obsolete = payload(); obsolete.bots[0].displayName = 'Old name'; resolve(obsolete); await pending;
  expect(old.state().data).toBeNull(); expect(current.state().data[0].displayName).toBe('Pip');
  current.resource.dispose();
});

it('releases a timed-out fetch and keeps recovery available', async () => {
  vi.useFakeTimers();
  const h = fixture(vi.fn().mockImplementationOnce((_path, { signal }) => new Promise((_resolve, reject) =>
    signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }))).mockResolvedValueOnce(payload()));
  const pending = h.resource.refresh(); await vi.advanceTimersByTimeAsync(15000); await pending;
  expect(h.state()).toMatchObject({ status: 'error', data: null, error: expect.stringContaining('timed out') });
  await h.resource.refresh(); expect(h.state().status).toBe('ready'); h.resource.dispose();
});
