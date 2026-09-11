import { error } from '@sveltejs/kit';
import { parsePuzzleDate } from '../../../shared/puzzleDates.js';
import { previewImageUrl } from '../../../shared/previewImages.js';

export async function loadPuzzlePage({ fetch, params, url, setHeaders }) {
  const date = params.date;
  if (date && !parsePuzzleDate(date)) error(404, 'Puzzle not found');
  const before = url.searchParams.get('before');
  if (!date && before && !parsePuzzleDate(before)) error(400, 'Use a valid archive date');
  const response = await fetch('/api/puzzle/' + (date ?? 'today'));
  if (!response.ok && (date || response.status !== 404)) error(response.status === 404 ? 404 : 503, response.status === 404 ? 'Puzzle not found' : 'Puzzles are temporarily unavailable');
  const detail = response.ok ? await response.json() : { puzzle: null };
  let archive = [];
  if (!date) {
    const listing = await fetch('/api/puzzle' + (before ? '?before=' + before : ''));
    if (!listing.ok) error(503, 'The puzzle archive is temporarily unavailable');
    archive = (await listing.json()).puzzles;
  }
  // The hub can be empty while the next publishing batch is prepared.
  setHeaders({ 'cache-control': response.headers.get('cache-control') ?? 'no-cache' });
  return { ...detail, archive, hub: !date, nextBefore: archive.length === 30 ? archive.at(-1).date : null,
    ...(detail.puzzle ? { ogImage: previewImageUrl('puzzle', detail.puzzle.date), ogImageAlt: `${detail.puzzle.sideToMove} to move — daily checkers puzzle` } : {}) };
}
