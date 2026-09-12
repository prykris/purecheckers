<script>
  import { gameState, presenceStats } from '$lib/stores/app.js';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { user } from '$lib/stores/user.js';
  import { browseTo } from '$lib/stores/navigation.js';
  import { NEARBY_ROOM, openUpgradeSheet } from '$lib/stores/ui.js';
  import { BOT_DIFFICULTIES, botDifficultyLabel } from '../../../shared/bots.js';
  import { track } from '$lib/analytics.js';
  import ShareActions from './ShareActions.svelte';
  import ReplayBoard from './ReplayBoard.svelte';
  import { SharePromptView } from '$lib/sharePrompts.js';
  import { gameResultCode, gameEndReason, playerGameResult, gameResultLabel } from '../../../shared/gameResult.js';

  // The result sheet. Every button is one accepted command: the server treats a finished
  // game as idle for idle commands and force-idles first. Rows follow the action matrix
  // by `game.origin` ('bot' | 'quickplay' | 'room') and guest status.
  let { onchat = null, chatOpen = false, unread = 0, skin, children, view = $gameState } = $props();

  const game = $derived(view.state);
  const gameId = $derived(game.gameId);
  const spectator = $derived(view.mode === 'spectator');
  const myColor = $derived(view.myColor);
  const opponentName = $derived(view.opponentName || 'Opponent');
  const opponentId = $derived(view.opponentId);
  const origin = $derived(game.origin || 'quickplay');
  const guest = $derived(!!$user?.isGuest);
  const canSend = $derived($session.status === 'ready' && !$session.pending);
  const pending = $derived($session.pending);
  const searchingCount = $derived($presenceStats.searching || 0);
  const repeatDifficulty = $derived(BOT_DIFFICULTIES.includes(game.botDifficulty) ? game.botDifficulty : 'medium');

  const resultCode = $derived(game.resultData?.result ?? gameResultCode(game.winner, game.endReason));
  const myResult = $derived(playerGameResult(resultCode, myColor));
  const verdict = $derived(spectator ? gameResultLabel(resultCode, {red:view.spectatorRedName,black:view.spectatorBlackName}) : myResult === 'win' ? 'You won!' : myResult === 'loss' ? 'You lost' : gameResultLabel(resultCode));
  const reason = $derived(gameEndReason(game.resultData?.endReason || game.endReason, resultCode));

  const result = $derived(game.resultData || null);
  const persistStatus = $derived(game.persistStatus || result?.persistStatus || 'pending');
  const shareData = $derived({ result: resultCode, endReason: game.endReason, yourColor: myColor, mode: game.mode,
    moveHistory: game.moveHistory, eloChanges: result?.eloChanges,
    redProfileUrl: myColor === 'red' && $user?.profilePublic === false ? null : undefined,
    blackProfileUrl: myColor === 'black' && $user?.profilePublic === false ? null : undefined,
    redPlayer: spectator ? view.spectatorRedName : myColor === 'red' ? $user?.username : opponentName,
    blackPlayer: spectator ? view.spectatorBlackName : myColor === 'black' ? $user?.username : opponentName });
  const promptView = new SharePromptView({
    storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
    onShown: candidate => track('share_prompt_shown', { reason: candidate.reason, content_type: candidate.surface })
  });
  let sharePrompt = $state(null);
  $effect(() => {
    sharePrompt = spectator ? null : promptView.update({ game, color: myColor, user: $user });
  });
  const myElo = $derived(result?.eloChanges?.[myColor] || 0);
  const oppElo = $derived(result?.eloDetail?.[myColor]?.opponentElo || null);
  const coins = $derived((result?.coinBreakdown?.[myColor] || []).reduce((sum, item) => sum + (item.amount || 0), 0) || result?.coinRewards?.[myColor] || 0);
  const ranked = $derived(game.mode ? game.mode === 'RANKED' : myElo !== 0);
  const stakes = $derived.by(() => {
    if (persistStatus === 'failed') return 'Result could not be saved';
    if (persistStatus === 'pending' && !result) return 'Saving result…';
    const parts = [];
    if (spectator) return ranked ? 'Ranked' : 'Friendly';
    if (ranked) {
      parts.push(`${myElo > 0 ? '+' : ''}${myElo} ELO`);
      if (oppElo) parts.push(`vs ${oppElo} rated`);
    } else {
      parts.push('Friendly');
      parts.push(coins > 0 ? `+${coins} coins` : 'no rating change');
    }
    if (ranked && coins > 0) parts.push(`+${coins} coins`);
    return parts.join(' · ');
  });

  // Rematch labels from the snapshot's rematchRequests and opponentLeft.
  const requests = $derived(game.rematchRequests || []);
  const opponentLeft = $derived(!!game.opponentLeft);
  const rematchLabel = $derived(game.rematchPending ? 'Starting rematch…' : opponentLeft ? `${opponentName} left`
    : requests.includes($user?.id) ? `Waiting for ${opponentName}…`
    : requests.includes(opponentId) ? 'Accept rematch' : 'Rematch');
  const rematchEnabled = $derived(!game.rematchPending && !opponentLeft && !requests.includes($user?.id));

  const showNearby = $derived(origin === 'bot' || (origin === 'quickplay' && !guest));
  const showFind = $derived(origin !== 'room' && searchingCount > 0);
  const showSave = $derived(guest && !spectator);

  async function playAgain() {
    if (!canSend) return;
    track('rematch_bot', { difficulty: repeatDifficulty });
    await sendCommand('bot:play', { difficulty: repeatDifficulty });
  }
  async function rematch() {
    if (!canSend || !rematchEnabled) return;
    await sendCommand('game:rematch-request', { gameId });
  }
  async function playNearby() {
    if (!canSend) return;
    track('post_game_invite', { origin });
    await sendCommand('room:create', { ...NEARBY_ROOM });
  }
  async function findOpponent() {
    if (!canSend) return;
    track('post_game_search', { origin, searching: searchingCount });
    await sendCommand('matchmaking:join');
  }
  async function lobby() {
    if (!canSend) return;
    const r = spectator ? await sendCommand('room:leave', { roomId: view.roomId }) : await sendCommand('game:leave', { gameId });
    if (r.ok) browseTo('lobby');
  }
</script>

{#snippet summary()}
  <p class="eyebrow">Game over</p>
  <header class="verdict-row">
    <h2 class="verdict" class:win={myResult === 'win'} class:loss={myResult === 'loss'}>{verdict}</h2>
    {#if reason}<span class="reason">{reason}</span>{/if}
  </header>
  <p class="stakes" class:failed={persistStatus === 'failed'}>{stakes}</p>

{/snippet}
{#snippet actions()}
  {#if !spectator}<div class="buttons">
    {#if origin === 'bot'}
      <button type="button" class="btn btn-primary row-btn" onclick={playAgain} disabled={!canSend}>
        {pending === 'bot:play' ? 'Starting…' : `Play again · ${botDifficultyLabel(repeatDifficulty)}`}
      </button>
    {:else}
      <button type="button" class="btn btn-primary row-btn" onclick={rematch} disabled={!canSend || !rematchEnabled}>
        {pending === 'game:rematch-request' ? 'Sending…' : rematchLabel}
      </button>
    {/if}
    {#if showNearby}
      <button type="button" class="btn btn-dark row-btn" onclick={playNearby} disabled={!canSend}>
        {pending === 'room:create' ? 'Opening your room…' : 'Play with a friend'}
      </button>
    {/if}
    {#if showFind}
      <button type="button" class="btn btn-dark row-btn" onclick={findOpponent} disabled={!canSend}>
        {pending === 'matchmaking:join' ? 'Starting search…' : `Find Opponent · ${searchingCount} searching`}
      </button>
    {/if}
    {#if origin === 'room' && showSave}
      <button type="button" class="btn btn-dark row-btn two-line" onclick={() => openUpgradeSheet()}>
        <span>Save account</span>
        <span class="sub">Keep {$user?.username} and your games</span>
      </button>
    {/if}
  </div>

  {/if}
  {#if persistStatus !== 'failed' && resultCode !== 'ABORTED'}
    <div class="sharing">
      {#if sharePrompt}<p class="stakes">{sharePrompt.label}</p>{/if}
      <ShareActions surface="result" url={persistStatus === 'saved' && result?.replayId ? '/game/' + result.replayId : null} data={shareData} label="Share result" />
      {#if sharePrompt?.surface === 'profile' && $user?.profilePublic !== false}<ShareActions surface="profile" url={sharePrompt.url} text={sharePrompt.text} data={$user} label="Share milestone" />{/if}
    </div>
  {/if}

  <div class="links">
    <button type="button" class="link" onclick={lobby} disabled={!canSend}>{pending === 'game:leave' ? 'Leaving…' : 'Lobby'}</button>
    {#if origin !== 'bot' && onchat}
      <span class="sep" aria-hidden="true">·</span>
      <button type="button" class="link" aria-expanded={chatOpen} onclick={() => onchat()}>
        {chatOpen ? 'Hide chat' : 'Chat'}{#if unread > 0}<span class="unread">{unread > 9 ? '9+' : unread}</span>{/if}
      </button>
    {/if}
    {#if showSave && origin !== 'room'}
      <span class="sep" aria-hidden="true">·</span>
      <button type="button" class="link accent" onclick={() => openUpgradeSheet()}>Save account</button>
    {/if}
  </div>
{/snippet}
{#if children}
  {@render children(summary, actions, shareData)}
{:else}
  <section class="sheet" aria-label="Game result">
    {@render summary()}
    {#key gameId}<ReplayBoard gameData={shareData} {skin} perspective={myColor} initialPosition="end" review />{/key}
    {@render actions()}
  </section>
{/if}

<style>
  .sheet {
    width: 100%; max-width: 480px;
    display: flex; flex-direction: column; gap: var(--sp-sm);
    text-align: center;
  }
  .eyebrow { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); }
  .verdict-row { display: flex; align-items: baseline; justify-content: center; gap: var(--sp-sm); min-height: 28px; flex-wrap: wrap; }
  .verdict { font-size: clamp(2rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.2; color: var(--text); }
  .verdict.win { color: var(--success); }
  .verdict.loss { color: var(--accent); }
  .reason { font-size: var(--fs-caption); color: var(--text-dim); }
  .stakes { font-size: var(--fs-caption); color: var(--text-dim); min-height: 18px; line-height: 1.5; margin-bottom: var(--sp-sm); }
  .stakes.failed { color: var(--warning); }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--sp-sm); margin-top: var(--sp-sm); }
  .sharing { display: flex; flex-direction: column; gap: var(--sp-sm); border-top: 1px solid var(--surface2); padding-top: var(--sp-md); margin-top: var(--sp-sm); }
  .row-btn { flex: 1 1 180px; min-width: 0; min-height: 48px; padding: var(--sp-xs) var(--sp-md); font-size: var(--fs-caption); }
  .row-btn.two-line { flex-direction: column; gap: 0; line-height: 1.2; }
  .row-btn .sub { font-size: 0.65rem; font-weight: 500; opacity: 0.8; }
  .links { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--sp-sm); }
  .link {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 600;
    min-height: 44px; padding: 0 var(--sp-xs); display: inline-flex; align-items: center; gap: var(--sp-xs);
  }
  .link:hover { color: var(--text); }
  .link:disabled { opacity: 0.5; cursor: default; }
  .link.accent { color: var(--accent2); }
  .sep { color: var(--text-dim); opacity: 0.4; }
  .unread { min-width: 16px; height: 16px; border-radius: 8px; background: var(--accent2); color: #fff; font-size: 0.55rem; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; }

  :global(.table) .eyebrow{display:none;}:global(.table) .verdict{font-size:24px;}:global(.table) .verdict-row{justify-content:flex-start;gap:6px;}:global(.table) .stakes{margin:2px 0;font-size:10px;min-height:0;}:global(.table) .buttons{margin:0;width:100%;gap:5px;}:global(.table) .row-btn{min-height:36px;font-size:11px;flex:1 1 120px;padding:4px 8px;}:global(.table) .sharing{border:0;padding:0;margin:0;}:global(.table) .links{gap:4px;}:global(.table) .link{min-height:32px;font-size:10px;}
  :global(.table[data-layout=focus]) .verdict{font-size:18px;}:global(.table[data-layout=focus]) .verdict-row{min-height:22px;}
</style>
