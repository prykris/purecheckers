import { error } from '@sveltejs/kit';
import { previewImageUrl } from '../../../../../shared/previewImages.js';
import { gameResultLabel } from '../../../../../shared/gameResult.js';

export async function load({ params, fetch }) {
  const res = await fetch('/api/leaderboard/game/' + encodeURIComponent(params.id));
  if (!res.ok) throw error(res.status === 404 || res.status === 400 ? 404 : 503, 'Replay unavailable');
  const { game } = await res.json();
  return { game, indexable: game.indexable === true, ogImage: previewImageUrl('game', game.id),
    ogType: 'article', ogImageAlt: `Final checkers position: ${game.redPlayer} versus ${game.blackPlayer}. ${gameResultLabel(game.result)}.` };
}
