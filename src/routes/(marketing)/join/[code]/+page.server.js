import { error } from '@sveltejs/kit';
import { JOIN_CODE_PATTERN } from '../../../../../shared/rooms.js';
import { previewImageUrl } from '../../../../../shared/previewImages.js';

// This page is shareable HTML; /invite/CODE owns client authentication and joining.
export async function load({ params, fetch, setHeaders }) {
  setHeaders({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  const code = params.code.toUpperCase();
  if (!JOIN_CODE_PATTERN.test(code)) error(404, 'Invitation not found');
  const response = await fetch(`/api/rooms/invite/${code}`);
  if (response.status === 404) return { code, invite: null };
  if (!response.ok) error(503, 'Could not check this invitation. Please try again.');
  const invite = await response.json();
  return { code, invite, ogImage: previewImageUrl('invite', code), ogImageAlt: `${invite.hostName} invites you to play checkers` };
}
