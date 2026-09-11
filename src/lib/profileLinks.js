// App layouts provide a profile viewer; public pages keep ordinary link navigation.
export const PROFILE_VIEWER = 'purecheckers.profile-viewer';

export function profileHref(username, profileUrl, profilePublic = true) {
  if (profilePublic === false || profileUrl === null || typeof username !== 'string' || !username.trim() || /^\[Expired Guest/.test(username)) return null;
  if (profileUrl !== undefined) {
    if (typeof profileUrl !== 'string' || !/^\/player\/[^/?#]+$/.test(profileUrl)) return null;
    try { return '/player/' + encodeURIComponent(decodeURIComponent(profileUrl.slice('/player/'.length))); }
    catch { return null; }
  }
  return '/player/' + encodeURIComponent(username);
}
