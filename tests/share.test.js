import { shareLink, buildShareText, buildShareUrl } from '../src/lib/share.js';
import { track } from '../src/lib/analytics.js';
vi.mock('../src/lib/analytics.js', () => ({ track: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const options = { url: '/puzzle/2026-09-10', text: buildShareText('puzzle', { date: '2026-09-10', attempts: 2, solved: true }), surface: 'puzzle' };

it('shares a spoiler-free message and an attributed permanent URL', async () => {
  const share = vi.fn().mockResolvedValue();
  expect(await shareLink(options, { share })).toBe('shared');
  expect(share.mock.calls[0][0]).toMatchObject({ text: expect.stringContaining('solved in 2 tries'), url: 'https://purecheckers.com/puzzle/2026-09-10?utm_source=share&utm_medium=puzzle' });
});
it('keeps cancellation quiet and copies when native sharing is unavailable', async () => {
  const writeText = vi.fn().mockResolvedValue();
  expect(await shareLink(options, { share: () => Promise.reject({ name: 'AbortError' }), clipboard: { writeText } })).toBe('cancelled');
  expect(writeText).not.toHaveBeenCalled();
  expect(await shareLink(options, { canShare: () => false, share: vi.fn(), clipboard: { writeText } })).toBe('copied');
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/puzzle/2026-09-10?'));
  expect(await shareLink(options, {})).toBe('unavailable');
});

it('uses the invitation URL for manual fallback when sharing and clipboard access fail', async () => {
  const invite = { url: '/join/ABC123?ref=friend#room', surface: 'invite', text: 'Join me' };
  const share = vi.fn().mockRejectedValue(new Error('blocked'));
  const writeText = vi.fn().mockRejectedValue(new Error('denied'));
  expect(await shareLink(invite, { share, clipboard: { writeText } })).toBe('unavailable');
  const manual = buildShareUrl(invite.url, invite.surface);
  expect(manual).toBe('https://purecheckers.com/join/ABC123?ref=friend&utm_source=share&utm_medium=invite#room');
  expect(share.mock.calls[0][0].url).toBe(manual);
  expect(writeText).toHaveBeenCalledWith('Join me\n' + manual);
});

const result = { result: 'RED_WIN', yourColor: 'red', redPlayer: 'Chris', blackPlayer: 'Dana',
  moveHistory: Array(34).fill({}), mode: 'RANKED', eloChanges: { red: 14, black: -14 } };

it('shares the participant perspective and only a confirmed positive ranked rating change', () => {
  expect(buildShareText('result', result)).toBe('I beat Dana at checkers in 34 moves (+14 ELO). Watch the replay:');
  expect(buildShareText('result', { ...result, yourColor: 'black' })).toBe('Chris beat me at checkers in 34 moves. See if you can spot my mistake:');
  expect(buildShareText('result', { ...result, result: 'DRAW' })).toBe('Drew with Dana at checkers after 34 moves. Replay:');
  for (const patch of [{ mode: 'FRIENDLY' }, { eloChanges: null }, { eloChanges: { red: 0 } }]) {
    expect(buildShareText('result', { ...result, ...patch })).not.toContain('ELO');
  }
});

it('keeps replays neutral, including cancelled and unknown results', () => {
  expect(buildShareText('replay', result)).toBe('Chris vs Dana — checkers replay, 34 moves, Red wins:');
  expect(buildShareText('result', { ...result, yourColor: null })).not.toMatch(/I beat|beat me/);
  expect(buildShareText('replay', { ...result, result: 'ABORTED' })).toContain('game was cancelled');
  expect(buildShareText('replay', { ...result, result: 'UNKNOWN' })).toContain('Result unavailable');
  expect(buildShareText('replay', { ...result, moveHistory: [{}] })).toContain('1 move,');
});

it('distinguishes sharing your profile from sharing someone else', () => {
  const player = { username: 'Dana', elo: 1250, wins: 15, losses: 4 };
  expect(buildShareText('profile', { ...player, ownProfile: true })).toBe('My checkers profile: ELO 1250, 15W / 4L. Challenge me:');
  expect(buildShareText('profile', player)).toBe('Dana on Pure Checkers: ELO 1250, 15W / 4L. Play free online:');
});

it('keeps puzzle text spoiler-free with tries, a puzzle-only hashtag, and no square/solution data', () => {
  const puzzle = { date: '2026-09-10', solved: true, attempts: 1, solution: '9x18x27' };
  expect(buildShareText('puzzle', puzzle)).toBe('Pure Checkers puzzle for 2026-09-10 — solved in 1 try. Can you find the move? #checkers');
  expect(buildShareText('puzzle', { ...puzzle, solved: false })).not.toMatch(/solved|9x18|1 try/);
  expect(buildShareText('result', result)).not.toContain('#');
});

it('keeps the supported templates under 140 characters even with long display names', () => {
  const long = { ...result, redPlayer: 'R'.repeat(40), blackPlayer: 'B'.repeat(40) };
  for (const [surface, data] of [
    ['result', long], ['result', { ...long, yourColor: 'black' }],
    ['replay', { ...long, result: 'ABORTED' }],
    ['profile', { username: 'P'.repeat(40), elo: 3000, wins: 10000, losses: 10000 }],
    ['invite', { hostName: 'H'.repeat(40) }],
    ['invite', { hostName: 'H'.repeat(40), buyIn: 2147483647 }],
    ['puzzle', { date: '2026-09-10', solved: true, attempts: 1000 }]
  ]) expect([...buildShareText(surface, data)].length).toBeLessThan(140);
});

it('discloses wager and account requirements in invitation text', () => {
  const text = buildShareText('invite', { hostName: 'Chris', buyIn: 20 });
  expect(text).toContain('Wager: 20 coins'); expect(text).toContain('registered account required');
  expect(text).not.toContain('no account needed');
});

it('records attempts before invoking the native sheet and cancellation with the same item identity', async () => {
  const share = vi.fn(() => {
    expect(track).toHaveBeenCalledWith('share', { method: 'web_share', content_type: 'puzzle', item_id: '/puzzle/2026-09-10' });
    return Promise.reject({ name: 'AbortError' });
  });
  expect(await shareLink(options, { share })).toBe('cancelled');
  expect(track.mock.calls.at(-1)).toEqual(['share_cancel', { method: 'web_share', content_type: 'puzzle', item_id: '/puzzle/2026-09-10' }]);
});

it('handles unusual native rejection values and reports clipboard fallback as its own attempt', async () => {
  const writeText = vi.fn().mockResolvedValue();
  expect(await shareLink(options, { share: () => Promise.reject(null), clipboard: { writeText } })).toBe('copied');
  expect(track.mock.calls.map(([, data]) => data.method)).toEqual(['web_share', 'clipboard']);
});

it('honours explicit Copy link and handles failed capability checks without opening a sheet', async () => {
  const share = vi.fn(), writeText = vi.fn().mockResolvedValue();
  expect(await shareLink({ ...options, copyOnly: true }, { share, clipboard: { writeText } })).toBe('copied');
  expect(await shareLink(options, { share, canShare: () => { throw new Error('unsupported'); }, clipboard: { writeText } })).toBe('copied');
  expect(share).not.toHaveBeenCalled();
});

it('replaces attribution while preserving other query parameters and fragments', () => {
  expect(buildShareUrl('/game/17?utm_source=old&utm_medium=old&ref=friend#moves', 'result'))
    .toBe('https://purecheckers.com/game/17?utm_source=share&utm_medium=result&ref=friend#moves');
});

it('copies only the exact visible URL for an invitation link field', async () => {
  const writeText = vi.fn().mockResolvedValue();
  const url = 'http://localhost:5180/join/ABC123';
  await shareLink({ url, text: 'Join me', surface: 'invite', copyOnly: true, attribute: false }, { clipboard: { writeText } });
  expect(writeText).toHaveBeenCalledWith(url);
});
