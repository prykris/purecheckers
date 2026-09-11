import { sharePromptFor, claimSharePrompt, SharePromptView } from '../src/lib/sharePrompts.js';
const user = { id: 9001, username: 'Chris', profilePublic: true };
const game = { gameId: 'game-17', gameOver: true, mode: 'RANKED', winner: 'red', resultData: { replayId: 17, persistStatus: 'saved', eloChanges: { red: 14 } } };
it('prompts only for saved qualifying wins and respects private profiles', () => {
  expect(sharePromptFor({ game, color: 'red', user }).reason).toBe('win');
  expect(sharePromptFor({ game, color: 'black', user })).toBeNull();
  expect(sharePromptFor({ game: { ...game, resultData: { persistStatus: 'failed' } }, color: 'red', user })).toBeNull();
  const milestone = { ...game, resultData: { ...game.resultData, milestones: { red: [{ name: 'Bronze', elo: 1200 }] } } };
  expect(sharePromptFor({ game: milestone, color: 'red', user }).surface).toBe('profile');
  expect(sharePromptFor({ game: milestone, color: 'red', user: { ...user, profilePublic: false } }).surface).toBe('result');
  expect(sharePromptFor({ game: { ...game, mode: 'FRIENDLY', origin: 'bot', botDifficulty: 'hard' }, color: 'red', user }).reason).toBe('win');
  expect(sharePromptFor({ game: { ...game, mode: 'FRIENDLY', origin: 'bot', botDifficulty: 'easy' }, color: 'red', user })).toBeNull();
});

it('does not let readable stale storage override today\'s in-memory claim after a failed write', () => {
  const storage = { getItem: () => '2026-09-10', setItem: () => { throw new Error('Read-only'); } };
  const day = new Date('2026-09-11');
  expect(claimSharePrompt(storage, 9100, 'result', day)).toBe(true);
  expect(claimSharePrompt(storage, 9100, 'result', day)).toBe(false);
});

it.each([
  { gameOver: false }, { persistStatus: 'failed' }, { endReason: 'restart-abandoned' },
  { winner: null }, { resultData: { ...game.resultData, result: 'ABORTED' } }
])('never promotes nonterminal, failed or cancelled outcomes: %j', patch => {
  expect(sharePromptFor({ game: { ...game, ...patch }, color: 'red', user })).toBeNull();
});

let nextUser = 9200;
function setup() {
  const data = new Map(), onShown = vi.fn();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const now = () => new Date('2026-09-11');
  const input = { game, color: 'red', user: { ...user, id: nextUser++ } };
  return { owner: new SharePromptView({ storage, now, onShown }), storage, now, onShown, input };
}

it('reports one prompt per view grant and suppresses remounts or another game that day', () => {
  const { owner, storage, now, onShown, input } = setup();
  expect(owner.update(input)?.surface).toBe('result');
  expect(owner.update({ ...input, game: { ...game } })?.surface).toBe('result');
  expect(onShown).toHaveBeenCalledTimes(1);
  expect(new SharePromptView({ storage, now, onShown }).update(input)).toBeNull();
  expect(owner.update({ ...input, game: { ...game, gameId: 'another' } })).toBeNull();
  expect(onShown).toHaveBeenCalledTimes(1);
});

it('waits for saved eligibility instead of consuming the prompt during pending persistence', () => {
  const { owner, input, onShown } = setup();
  expect(owner.update({ ...input, game: { ...game, persistStatus: 'pending' } })).toBeNull();
  expect(onShown).not.toHaveBeenCalled();
  expect(owner.update(input)?.surface).toBe('result');
});

it('revokes a milestone when privacy changes without silently transferring or reviving its grant', () => {
  const { owner, input, onShown } = setup();
  const milestone = { ...input, game: { ...game, resultData: { ...game.resultData, milestones: { red: [{ name: 'Bronze', elo: 1200 }] } } } };
  expect(owner.update(milestone)?.surface).toBe('profile');
  expect(owner.update({ ...milestone, user: { ...input.user, profilePublic: false } })).toBeNull();
  expect(owner.update(milestone)).toBeNull();
  expect(onShown).toHaveBeenCalledTimes(1);
});

it('refreshes a granted profile URL and label from current profile/receipt data', () => {
  const { owner, input, onShown } = setup();
  const milestone = { ...input, game: { ...game, resultData: { ...game.resultData, milestones: { red: [{ name: 'Bronze', elo: 1200 }] } } } };
  owner.update(milestone);
  const current = owner.update({ ...milestone, user: { ...input.user, username: 'New Name' } });
  expect(current.url).toBe('/player/New%20Name'); expect(current.text).toContain('Bronze (1200 ELO)');
  expect(onShown).toHaveBeenCalledTimes(1);
});

it('clears old grants when the account or result becomes unavailable', () => {
  const { owner, input, onShown } = setup();
  owner.update(input);
  expect(owner.update({ ...input, user: null })).toBeNull();
  expect(owner.update(input)).toBeNull();
  const other = { ...input, user: { ...input.user, id: nextUser++ } };
  expect(owner.update(other)?.surface).toBe('result');
  expect(owner.update({ ...other, game: { ...game, resultData: { persistStatus: 'failed' } } })).toBeNull();
  expect(owner.update(other)).toBeNull();
  expect(onShown).toHaveBeenCalledTimes(2);
});

it('keeps a claimed prompt usable if optional reporting throws', () => {
  const { owner, input } = setup();
  owner.onShown = () => { throw new Error('Unavailable'); };
  expect(owner.update(input)?.surface).toBe('result');
});
it('caps prompts per account, surface and UTC day, including unavailable storage', () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const date = new Date('2026-09-10T23:59:59Z');
  expect(claimSharePrompt(storage, user.id, 'result', date)).toBe(true);
  expect(claimSharePrompt(storage, user.id, 'result', date)).toBe(false);
  expect(claimSharePrompt(storage, user.id, 'profile', date)).toBe(true);
  expect(claimSharePrompt(storage, user.id, 'result', new Date('2026-09-11'))).toBe(true);
});
