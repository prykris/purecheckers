import { error } from '@sveltejs/kit';
import { previewImageUrl } from '../../../../../shared/previewImages.js';

export async function load({ params, fetch, setHeaders }) {
  setHeaders({ 'Cache-Control': 'no-store' });
  // Fetch player data from our own API. Usernames may contain spaces or
  // reserved characters ("Quick Crown 35"), so encode the path segment.
  const res = await fetch(`/api/leaderboard/player/${encodeURIComponent(params.username)}`);
  if (!res.ok) throw error(res.status === 404 ? 404 : 503, res.status === 404 ? 'Player not found' : 'Profiles are temporarily unavailable');
  const data = await res.json();
  const player = data.player;
  return {
    player,
    ogImage: previewImageUrl('player', player.username, { revision: player.gamesPlayed }),
    ogType: 'profile', ogImageAlt: `${player.username} — checkers rating and activity`,
    games: data.games,
    activity: data.activity || {},
    // Guest profiles are tombstoned within days and bots are not people;
    // neither should be indexed.
    indexable: !(player.isGuest || player.isBot),
  };
}
