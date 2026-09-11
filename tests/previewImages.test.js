import { PREVIEW_TEMPLATE_VERSION, previewImageUrl } from '../shared/previewImages.js';
import { load as gamePage } from '../src/routes/(marketing)/game/[id]/+page.server.js';
import { load as playerPage } from '../src/routes/(marketing)/player/[username]/+page.server.js';
import { load as invitePage } from '../src/routes/(marketing)/join/[code]/+page.server.js';
import { loadPuzzlePage } from '../src/lib/server/puzzlePage.js';

const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const version = value => expect(new URL(value).searchParams.get('t')).toBe(String(PREVIEW_TEMPLATE_VERSION));

it('encodes identities and retains a zero profile revision in versioned absolute image URLs', () => {
  const url = previewImageUrl('player', 'A /?#& B', { revision: 0 });
  expect(url).toBe(`https://purecheckers.com/og/player/A%20%2F%3F%23%26%20B.png?v=0&t=${PREVIEW_TEMPLATE_VERSION}`);
});

it('advertises the current image version and article result metadata from the real replay loader', async () => {
  const data = await gamePage({ params: { id: '17' }, fetch: async () => response({ game: { id: 17, redPlayer: 'Chris', blackPlayer: 'Dana', result: 'DRAW', indexable: true } }) });
  version(data.ogImage); expect(data.ogType).toBe('article');
  expect(data.ogImageAlt).toContain('Draw.');
  expect(data.ogImageAlt).toContain('Chris versus Dana');
});

it('advertises profile, invitation and puzzle image versions through their actual loaders', async () => {
  const setHeaders = vi.fn();
  const player = await playerPage({ params: { username: 'Chris' }, setHeaders,
    fetch: async () => response({ player: { username: 'Chris', gamesPlayed: 0 }, games: [], activity: {} }) });
  version(player.ogImage); expect(new URL(player.ogImage).searchParams.get('v')).toBe('0');
  const invite = await invitePage({ params: { code: 'abc234' }, setHeaders,
    fetch: async () => response({ hostName: 'Chris' }) });
  version(invite.ogImage); expect(new URL(invite.ogImage).pathname).toBe('/og/invite/ABC234.png');
  const puzzle = await loadPuzzlePage({ params: { date: '2026-09-11' }, url: new URL('https://purecheckers.com/puzzle/2026-09-11'), setHeaders,
    fetch: async () => response({ puzzle: { date: '2026-09-11', sideToMove: 'red' } }) });
  version(puzzle.ogImage);
});
