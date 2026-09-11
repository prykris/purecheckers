import { load } from '../src/routes/(marketing)/join/[code]/+page.server.js';

it('loads a shareable invitation without joining or creating an account', async () => {
  const fetch = vi.fn(async () => Response.json({ hostName: 'Chris', buyIn: 0 }));
  const setHeaders = vi.fn();
  expect(await load({ params: { code: 'abcdef' }, fetch, setHeaders })).toMatchObject({ code: 'ABCDEF', invite: { hostName: 'Chris' } });
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/rooms/invite/ABCDEF');
  expect(setHeaders).toHaveBeenCalledWith({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
});
it('distinguishes expired links from a temporarily unavailable server', async () => {
  const event = { params: { code: 'ABCDEF' }, setHeaders: vi.fn(), fetch: vi.fn(async () => new Response(null, { status: 404 })) };
  expect(await load(event)).toMatchObject({ invite: null });
  event.fetch.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(load(event)).rejects.toMatchObject({ status: 503 });
});
it('rejects malformed invitation codes before requesting room information', async () => {
  const fetch = vi.fn();
  await expect(load({ params: { code: 'bad/code' }, fetch, setHeaders: vi.fn() })).rejects.toMatchObject({ status: 404 });
  expect(fetch).not.toHaveBeenCalled();
});
