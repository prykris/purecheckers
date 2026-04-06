import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  // Fetch player data from our own API
  const res = await fetch(`/api/leaderboard/player/${params.username}`);
  if (!res.ok) throw error(404, 'Player not found');
  const data = await res.json();
  return { player: data.player, games: data.games };
}
