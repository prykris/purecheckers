import { ProfileSettingsClient } from '../src/lib/profileSettingsClient.js';
import { withDeadline } from '../src/lib/actions/deadline.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  let generation = 1, state, profile = { id: 1, profileVersion: 3, profilePublic: true };
  const write = vi.fn().mockResolvedValue({ profileVersion: 4, profilePublic: false });
  const refresh = vi.fn().mockImplementation(async () => (profile = { ...profile, profileVersion: 4, profilePublic: false }));
  const client = new ProfileSettingsClient({ readProfile: () => profile, capture: () => ({ generation }), isCurrent: scope => scope.generation === generation,
    write, refresh, publish: value => { state = value; } });
  return { client, write, refresh, state: () => state, profile: () => profile, replace: () => { generation++; client.reset(); } };
}

it('sends the accepted revision, keeps the displayed setting unchanged until the profile read and blocks duplicate input', async () => {
  const h = fixture(), receipt = deferred(), read = deferred(); h.write.mockReturnValue(receipt.promise); h.refresh.mockReturnValue(read.promise);
  const first = h.client.change(false);
  expect(h.write).toHaveBeenCalledWith({ profilePublic: false, expectedProfileVersion: 3 }, { generation: 1 });
  expect(h.profile().profilePublic).toBe(true); expect(await h.client.change(true)).toBe(false);
  receipt.resolve({ profilePublic: false, profileVersion: 4 }); await Promise.resolve(); await Promise.resolve();
  expect(await h.client.change(true)).toBe(false);
  read.resolve({ profilePublic: false, profileVersion: 4 }); expect(await first).toBe(true);
  expect(h.state()).toMatchObject({ busy: false, needsRefresh: false, error: '' }); h.client.dispose();
});

it('refreshes a conflicting choice without automatically replaying it', async () => {
  const h = fixture(); h.write.mockRejectedValue(Object.assign(Error('Account changed'), { status: 409 }));
  expect(await h.client.change(false)).toBe(false);
  expect(h.write).toHaveBeenCalledOnce(); expect(h.refresh).toHaveBeenCalledOnce();
  expect(h.state()).toMatchObject({ busy: false, error: 'Account changed', success: '', needsRefresh: false }); h.client.dispose();
});

it.each([true, false])('distinguishes a failed refresh from confirmed=%s and requires explicit read recovery', async confirmed => {
  const h = fixture(); if (!confirmed) h.write.mockRejectedValue(Error('lost response'));
  h.refresh.mockRejectedValue(Error('offline'));
  expect(await h.client.change(false)).toBe(confirmed);
  expect(h.state()).toMatchObject({ busy: false, needsRefresh: true });
  expect(h.state().error).toContain(confirmed ? 'Privacy change saved.' : 'Privacy change could not be confirmed.');
  expect(await h.client.change(true)).toBe(false);
  h.refresh.mockResolvedValue({ profilePublic: false, profileVersion: 4 }); expect(await h.client.refresh()).toBe(true);
  expect(h.state()).toMatchObject({ busy: false, needsRefresh: false, error: '' }); expect(h.write).toHaveBeenCalledOnce(); h.client.dispose();
});

it.each(['replace', 'dispose'])('discards late write completion after %s without starting another account read', async action => {
  const h = fixture(), receipt = deferred(); h.write.mockReturnValue(receipt.promise);
  const first = h.client.change(false); action === 'replace' ? h.replace() : h.client.dispose();
  const state = h.state(); receipt.resolve({ profilePublic: false, profileVersion: 4 });
  expect(await first).toBe(false); expect(h.refresh).not.toHaveBeenCalled(); expect(h.state()).toBe(state); h.client.dispose();
});

it('prevents an old refresh completion from clearing the new account’s pending state', async () => {
  const h = fixture(), read = deferred(), newer = deferred(); h.refresh.mockReturnValueOnce(read.promise);
  const first = h.client.change(false); await Promise.resolve(); await Promise.resolve();
  h.replace(); h.write.mockReturnValueOnce(newer.promise); const second = h.client.change(false);
  read.resolve({ profilePublic: false, profileVersion: 4 }); await first;
  expect(h.state().busy).toBe(true);
  newer.resolve({ profilePublic: false, profileVersion: 4 }); await second; expect(h.state().busy).toBe(false); h.client.dispose();
});

it.each([null, { profilePublic: true, profileVersion: 4 }, { profilePublic: false, profileVersion: 3 }])('does not claim malformed confirmation %j succeeded', async receipt => {
  const h = fixture(); h.write.mockResolvedValue(receipt);
  expect(await h.client.change(false)).toBe(false); expect(h.state().success).toBe(''); expect(h.refresh).toHaveBeenCalledOnce(); h.client.dispose();
});

it('bounds the privacy write using the shared deadline and reconciles its uncertain outcome', async () => {
  vi.useFakeTimers();
  const h = fixture();
  try {
    h.write.mockImplementation(() => withDeadline(signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')))), 'Privacy confirmation timed out. Refresh to check the current setting.'));
    const action = h.client.change(false); await vi.advanceTimersByTimeAsync(15_000);
    expect(await action).toBe(false); expect(h.refresh).toHaveBeenCalledOnce(); expect(h.state()).toMatchObject({ busy: false, error: 'Privacy confirmation timed out. Refresh to check the current setting.' });
  } finally { h.client.dispose(); vi.useRealTimers(); }
});
