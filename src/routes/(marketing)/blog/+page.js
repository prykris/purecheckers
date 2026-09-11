import { redirect } from '@sveltejs/kit';

// /blog was a "coming soon" stub. Its role is taken by /strategy (articles)
// and /changelog (news). Not prerendered: a prerendered redirect would be
// served as an HTML file with a meta refresh, and this must be a real 301.
export const prerender = false;

export function load() {
  redirect(301, '/strategy');
}
