import { PuzzleJournal } from '../src/lib/puzzle/journal.js';
const make = request => new PuzzleJournal({ storage: { getItem: () => null, setItem: () => {} }, uuid: () => 'visitor', request });
const progress = { solved: false, revealed: false, hintUsed: false, rewarded: false, attempts: 1, turns: [] };
const ack = attempt => ({ attempt, coinsAwarded: 0 });
afterEach(() => vi.useRealTimers());

it('retains an offline attempt and retries it without duplicating a successful upload', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(ack(progress));
  const journal = make(request);
  journal.record('2026-09-10', progress); await journal.running;
  expect(journal.records()['2026-09-10'].synced).toBeUndefined();
  await journal.sync(); await journal.sync();
  expect(request).toHaveBeenCalledTimes(2);
  journal.dispose();
});

it('does not mark a newer local attempt synchronized when an older acknowledgement arrives', async () => {
  let resolve;
  const journal = make(() => new Promise(r => { resolve = r; }));
  journal.record('2026-09-10', progress);
  journal.record('2026-09-10', { ...progress, attempts: 2 });
  resolve(ack(progress)); await journal.running;
  const row = journal.records()['2026-09-10'];
  expect(row.synced).not.toBe(JSON.stringify(row.payload));
  journal.dispose();
});

it('claims anonymous history once and isolates subsequent accounts', async () => {
  const request = vi.fn((url, options) => Promise.resolve(url.endsWith('/history')
    ? { history: options.token === 'first' ? { '2026-09-10': progress } : {} } : ack(progress)));
  const journal = make(request);
  journal.record('2026-09-10', progress); await journal.running;
  journal.setIdentity({ id: 1, token: 'first' }); await journal.running;
  expect(journal.records()['2026-09-10']).toBeDefined();
  journal.setIdentity({ id: 2, token: 'second' }); await journal.running;
  expect(journal.records()['2026-09-10']).toBeUndefined();
  expect(request.mock.calls.filter(([, o]) => o.token === 'second' && o.method === 'POST')).toHaveLength(0);
  journal.dispose();
});

it('retains an offline solve proof after restarting and asking for a hint', async () => {
  const request = vi.fn().mockRejectedValue(new Error('offline'));
  const journal = make(request);
  const solved = { ...progress, solved: true, turns: [[{ fromRow: 5, fromCol: 2, toRow: 4, toCol: 3 }]] };
  journal.record('2026-09-10', solved); await journal.running;
  journal.record('2026-09-10', { ...progress, hintUsed: true, attempts: 2 }); await journal.running;
  const payload = journal.records()['2026-09-10'].payload;
  expect(payload).toMatchObject({ solved: true, revealed: false, attempts: 2, turns: solved.turns });
  journal.dispose();
});

it('ignores a late acknowledgement from a previous identity', async () => {
  let resolve;
  const request = vi.fn().mockResolvedValue({ history: {} });
  const journal = make(request);
  journal.setIdentity({ id: 1, token: 'first' }); await journal.running;
  request.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  journal.record('2026-09-10', progress);
  journal.setIdentity({ id: 2, token: 'second' });
  resolve(ack({ ...progress, solved: true })); await journal.running;
  expect(journal.records()['2026-09-10']).toBeUndefined();
  expect(journal.data.scopes['user:1']['2026-09-10'].progress.solved).toBe(false);
  journal.dispose();
});

it('accepts server reveal history over a conflicting local solve and keeps it after another retry', async () => {
  const revealed = { ...progress, revealed: true };
  const request = vi.fn().mockResolvedValue(ack(revealed));
  const journal = make(request);
  journal.record('2026-09-10', { ...progress, solved: true, turns: [[]] }); await journal.running;
  expect(journal.view().history['2026-09-10']).toMatchObject({ solved: false, revealed: true, rewarded: false });
  expect(journal.view().pending['2026-09-10']).toBe(false);
  journal.record('2026-09-10', { ...progress, solved: true, attempts: 2, turns: [[]] }); await journal.running;
  expect(journal.view().history['2026-09-10'].solved).toBe(false);
  journal.dispose();
});

it('keeps a newer local count pending while projecting the server rejection underneath it', async () => {
  let resolve;
  const request = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; }))
    .mockRejectedValue(new Error('offline'));
  const journal = make(request);
  journal.record('2026-09-10', progress);
  journal.record('2026-09-10', { ...progress, solved: true, attempts: 2, turns: [[]] });
  resolve(ack({ ...progress, revealed: true })); await journal.running; await journal.running;
  expect(journal.view().history['2026-09-10']).toMatchObject({ solved: false, revealed: true, attempts: 2 });
  expect(journal.view().pending['2026-09-10']).toBe(true);
  journal.dispose();
});

it('rejects malformed acknowledgements without falsely marking progress saved', async () => {
  const journal = make(() => Promise.resolve({ attempt: { solved: true } }));
  journal.record('2026-09-10', progress); await journal.running;
  expect(journal.view().pending['2026-09-10']).toBe(true);
  expect(journal.view().error).toContain('Invalid progress confirmation');
  journal.dispose();
});

it('times out an unresponsive fetch, releases the queue, and allows a retry', async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) =>
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })))
    .mockResolvedValue(ack(progress));
  const journal = make(request);
  journal.record('2026-09-10', progress);
  await vi.advanceTimersByTimeAsync(15000);
  expect(journal.running).toBeNull();
  expect(journal.view().error).toContain('timed out');
  expect(journal.view().pending['2026-09-10']).toBe(true);
  await journal.sync();
  expect(journal.view().pending['2026-09-10']).toBe(false);
  expect(journal.view().error).toBeNull();
  journal.dispose();
});

it('reports a history read failure and applies a later authoritative snapshot atomically', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('history unavailable'))
    .mockResolvedValueOnce({ history: { 'bad-date': progress } })
    .mockResolvedValueOnce({ history: { '2026-09-10': { ...progress, revealed: true } } });
  const journal = make(request);
  journal.setIdentity({ id: 1, token: 'first' }); await journal.running;
  expect(journal.view().error).toBe('history unavailable');
  await journal.sync(); expect(journal.view().history).toEqual({});
  expect(journal.view().error).toContain('Invalid puzzle history');
  await journal.sync();
  expect(journal.view().history['2026-09-10']).toMatchObject({ revealed: true, solved: false });
  journal.dispose();
});

it('does not let an old history response cross an authentication generation with the same token', async () => {
  let resolve;
  const request = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; }))
    .mockResolvedValue({ history: {} });
  const journal = make(request);
  journal.setIdentity({ id: 1, token: 'same', generation: 1 });
  journal.setIdentity({ id: 1, token: 'same', generation: 2 });
  resolve({ history: { '2026-09-10': { ...progress, solved: true } } }); await journal.running; await journal.running;
  expect(journal.view().history).toEqual({});
  journal.dispose();
});

it('recovers malformed browser storage and reports denied persistence', () => {
  const journal = new PuzzleJournal({ storage: { getItem: () => JSON.stringify({ version: 1, visitorId: 'stored', scopes: { visitor: { 'bad-date': null, '2026-09-10': { progress: 'broken' } }, 'user:1': 3 } }),
    setItem: () => { throw new Error('denied'); } }, uuid: () => 'new', request: vi.fn() });
  expect(journal.view().history).toEqual({});
  expect(journal.view().storageError).toContain('cannot be stored');
  journal.dispose();
});
