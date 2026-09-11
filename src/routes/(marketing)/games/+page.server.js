import { error } from '@sveltejs/kit';

export async function load({ fetch }) {
  const response = await fetch('/api/leaderboard/games?public=1');
  if (!response.ok) throw error(503, 'Recent games temporarily unavailable');
  const { games } = await response.json();
  return { games };
}
