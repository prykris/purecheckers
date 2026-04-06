import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  const res = await fetch(`/api/leaderboard/game/${params.id}`);
  if (!res.ok) throw error(404, 'Game not found');
  const data = await res.json();
  return { game: data.game };
}
