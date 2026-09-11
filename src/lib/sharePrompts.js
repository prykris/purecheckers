import { gameResultCode, playerGameResult } from '../../shared/gameResult.js';

const memory = new Map();

export function sharePromptFor({ game, color, user }) {
  const result = game?.resultData;
  if (!user || !game?.gameOver || game.winner !== color || result?.persistStatus !== 'saved' || !result.replayId ||
      (game.persistStatus && game.persistStatus !== 'saved') ||
      playerGameResult(result.result ?? gameResultCode(game.winner, game.endReason), color) !== 'win') return null;
  const milestone = result.milestones?.[color]?.at(-1);
  if (milestone && !user.isGuest && user.profilePublic !== false) return {
    surface: 'profile', reason: 'milestone', label: `You reached ${milestone.name}`,
    text: `I just hit ${milestone.name} (${milestone.elo} ELO) on Pure Checkers:`,
    url: '/player/' + encodeURIComponent(user.username),
  };
  if ((game.mode === 'RANKED' && result.eloChanges?.[color] > 0) || (game.origin === 'bot' && game.botDifficulty === 'hard')) return {
    surface: 'result', reason: 'win', label: 'Show someone this game', url: '/game/' + result.replayId,
  };
  return null;
}

export function claimSharePrompt(storage, userId, surface, now = new Date()) {
  const key = `checkers_share_prompt:${userId}:${surface}`, day = now.toISOString().slice(0, 10);
  // Keep today's successful in-memory claim even when storage can read an old
  // value but cannot persist the new one. Either source can suppress a repeat.
  for (const [entry, date] of memory) if (date !== day) memory.delete(entry);
  if (memory.get(key) === day) return false;
  let previous;
  try { previous = storage.getItem(key); } catch {}
  memory.set(key, day);
  if (previous === day) return false;
  try { storage.setItem(key, day); } catch {}
  return true;
}

// One result-view owner. A claim grants one surface/reason for this participant
// and game; profile changes update its content but cannot transfer the grant.
export class SharePromptView {
  constructor({ storage, onShown = () => {}, now = () => new Date() }) {
    this.storage = storage; this.onShown = onShown; this.now = now;
    this.key = null; this.attempted = false; this.grant = null;
  }
  update(input) {
    const key = input.user?.id != null && input.game?.gameId != null
      ? JSON.stringify([input.user.id, input.game.gameId]) : null;
    if (key !== this.key) {
      this.key = key; this.attempted = false; this.grant = null;
    }
    const candidate = key && sharePromptFor(input);
    if (!candidate) { this.grant = null; return null; }
    if (!this.attempted) {
      this.attempted = true;
      if (claimSharePrompt(this.storage, input.user.id, candidate.surface, this.now())) {
        this.grant = { surface: candidate.surface, reason: candidate.reason };
        try { this.onShown(candidate); } catch { /* Optional analytics cannot block the result. */ }
      }
    }
    if (!this.grant || this.grant.surface !== candidate.surface || this.grant.reason !== candidate.reason) {
      this.grant = null; return null;
    }
    return candidate;
  }
}
