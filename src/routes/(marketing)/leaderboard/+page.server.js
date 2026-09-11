import { error } from '@sveltejs/kit';

export async function load({ fetch }) {
  const response = await fetch('/api/leaderboard');
  if (!response.ok) throw error(503, 'Leaderboard temporarily unavailable');
  const { players } = await response.json();
  return { players };
}
