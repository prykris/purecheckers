import { TreasuryClient } from '../src/lib/treasuryClient.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const snapshot = (pending = [{ id: 11, amount: 10, canClaim: true }]) => ({ vault: { balance: 10, available: 0 }, pending });
async function fixture() {
  let generation = 0, state;
  const load = vi.fn().mockResolvedValue(snapshot());
  const claimReward = vi.fn().mockResolvedValue({ claimed: 10 });
  const refreshProfile = vi.fn().mockResolvedValue({ coins: 20 });
  const client = new TreasuryClient({ load, claimReward, refreshProfile, readScope: () => ({ generation, token: 'same-token' }),
    isCurrent: scope => scope.generation === generation, publish: value => { state = value; } });
  await client.refresh();
  return { client, load, claimReward, refreshProfile, state: () => state, replace: () => { generation++; client.reset(); } };
}

it('honors server claim availability and consumes a fresh snapshot after confirmation', async () => {
  const h = await fixture();
  h.load.mockResolvedValue(snapshot([]));
  expect(h.state().data.vault.available).toBe(0);
  expect(await h.client.claim(11)).toBe(true);
  expect(h.claimReward).toHaveBeenCalledWith(11, expect.objectContaining({ scope: { generation: 0, token: 'same-token' }, signal: expect.any(AbortSignal) }));
  expect(h.state()).toMatchObject({ claiming: null, error: null, data: snapshot([]) });
  expect(h.refreshProfile).toHaveBeenCalledTimes(2); h.client.dispose();
});

it('serializes claims through confirmation reads and rejects unavailable or unknown rewards', async () => {
  const h = await fixture(), pending = deferred();
  h.claimReward.mockReturnValue(pending.promise);
  const first = h.client.claim(11);
  expect(await h.client.claim(11)).toBe(false); expect(await h.client.claim(12)).toBe(false);
  expect(h.claimReward).toHaveBeenCalledTimes(1);
  pending.resolve({ claimed: 10 }); await first;
  h.load.mockResolvedValue(snapshot([{ id: 11, amount: 10, canClaim: false }])); await h.client.refresh();
  expect(await h.client.claim(11)).toBe(false); expect(h.claimReward).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('distinguishes confirmed claims from failed refreshes without fabricating a balance or removing a reward', async () => {
  const h = await fixture();
  h.load.mockRejectedValue(Error('read failed')); h.refreshProfile.mockRejectedValue(Error('profile failed'));
  expect(await h.client.claim(11)).toBe(true);
  expect(h.state()).toMatchObject({ claiming: null, data: snapshot(), status: 'error', error: 'Claim confirmed. Refresh to load the latest balance and treasury.' });
  h.load.mockResolvedValue(snapshot([])); h.refreshProfile.mockResolvedValue({ coins: 30 }); await h.client.refresh();
  expect(h.state()).toMatchObject({ data: snapshot([]), error: null, readError: null }); h.client.dispose();
});

it.each([Error('connection lost'), { claimed: 999 }, null])('recovers uncertain or malformed claim responses without automatically sending another claim: %s', async result => {
  const h = await fixture();
  if (result instanceof Error) h.claimReward.mockRejectedValue(result); else h.claimReward.mockResolvedValue(result);
  h.load.mockResolvedValue(snapshot([]));
  expect(await h.client.claim(11)).toBe(false);
  expect(h.claimReward).toHaveBeenCalledTimes(1); expect(h.refreshProfile).toHaveBeenCalledTimes(2);
  expect(h.state().data.pending).toEqual([]); expect(h.state().error).toBeTruthy(); h.client.dispose();
});

it.each(['replace', 'dispose'])('does not publish or start follow-up reads when an old claim completes after %s', async action => {
  const h = await fixture(), pending = deferred();
  h.claimReward.mockReturnValue(pending.promise); const first = h.client.claim(11);
  if (action === 'replace') h.replace(); else h.client.dispose();
  const state = h.state(); pending.resolve({ claimed: 10 });
  expect(await first).toBe(false); expect(h.state()).toBe(state);
  expect(h.load).toHaveBeenCalledTimes(1); expect(h.refreshProfile).toHaveBeenCalledTimes(1); h.client.dispose();
});
