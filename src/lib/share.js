import { track } from './analytics.js';
import { gameResultLabel, playerGameResult } from '../../shared/gameResult.js';

export function buildShareText(surface, data) {
  if (surface === 'puzzle') return `Pure Checkers puzzle for ${data.date} — ${data.solved ? `solved in ${data.attempts} ${data.attempts === 1 ? 'try' : 'tries'}. Can you find the move?` : 'can you find the move?'} #checkers`;
  if (surface === 'invite') return data.buyIn > 0
    ? `${data.hostName} invites you to checkers. Wager: ${data.buyIn} coins; registered account required:`
    : `${data.hostName} wants to play you at checkers. Tap to join, no account needed:`;
  if (surface === 'profile') return `${data.ownProfile ? 'My checkers profile' : `${data.username} on Pure Checkers`}: ELO ${data.elo}, ${data.wins}W / ${data.losses}L.${data.ownProfile ? ' Challenge me:' : ' Play free online:'}`;
  if (surface === 'result' || surface === 'replay') {
    const moves = Array.isArray(data.moveHistory) ? data.moveHistory.length : 0;
    const count = `${moves} ${moves === 1 ? 'move' : 'moves'}`;
    if (surface === 'result') {
      const outcome = playerGameResult(data.result, data.yourColor);
      const opponent = data.yourColor === 'red' ? data.blackPlayer : data.redPlayer;
      if (outcome === 'win') {
        const elo = data.eloChanges?.[data.yourColor];
        const change = data.mode === 'RANKED' && Number.isFinite(elo) && elo > 0 ? ` (+${elo} ELO)` : '';
        return `I beat ${opponent} at checkers in ${count}${change}. Watch the replay:`;
      }
      if (outcome === 'loss') return `${opponent} beat me at checkers in ${count}. See if you can spot my mistake:`;
      if (outcome === 'draw') return `Drew with ${opponent} at checkers after ${count}. Replay:`;
    }
    const result = data.result === 'ABORTED' ? 'game was cancelled' : gameResultLabel(data.result);
    return `${data.redPlayer} vs ${data.blackPlayer} — checkers replay, ${count}, ${result}:`;
  }
  throw new Error('Unknown share surface');
}

export function buildShareUrl(url, surface) {
  const link = new URL(url, 'https://purecheckers.com');
  link.searchParams.set('utm_source', 'share'); link.searchParams.set('utm_medium', surface);
  return link.href;
}

export async function shareLink({ url, text, title = 'Pure Checkers', surface, copyOnly = false }, navigatorApi = globalThis.navigator) {
  const link = new URL(buildShareUrl(url, surface));
  const metadata = { content_type: surface, item_id: link.pathname };
  let native = !copyOnly && !!navigatorApi?.share;
  try { if (native && navigatorApi.canShare) native = navigatorApi.canShare({ url: link.href }); } catch { native = false; }
  if (native) {
    track('share', { ...metadata, method: 'web_share' });
    try { await navigatorApi.share({ title, text, url: link.href }); return 'shared'; }
    catch (err) { if (err?.name === 'AbortError') { track('share_cancel', { ...metadata, method: 'web_share' }); return 'cancelled'; } }
  }
  try {
    if (!navigatorApi?.clipboard?.writeText) return 'unavailable';
    track('share', { ...metadata, method: 'clipboard' });
    await navigatorApi.clipboard.writeText(text + '\n' + link.href);
    return 'copied';
  } catch { return 'unavailable'; }
}
