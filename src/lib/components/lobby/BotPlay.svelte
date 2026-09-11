<script>
  import { phase } from '$lib/stores/app.js';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { botDifficulty } from '$lib/stores/ui.js';
  import BotChips from './BotChips.svelte';
  import SessionLine from './SessionLine.svelte';

  // bot:play also replaces a matchmaking search. Active rooms retain their return action.
  let { onskip = null } = $props();

  const idle = $derived($phase === 'idle');
  const searching = $derived($phase === 'matchmaking');
  const pending = $derived($session.pending === 'bot:play');
  const canSend = $derived($session.status === 'ready' && !$session.pending);

  async function play() {
    if (!canSend) return;
    await sendCommand('bot:play', { difficulty: $botDifficulty });
  }
</script>

<div class="bot">
  {#if idle || searching}
    <div class="intro">
      <h2>Meet your next opponent</h2>
      <p>Three levels. Always up for a game.</p>
    </div>
    <BotChips layout="cards" disabled={pending}>
      {#snippet children(opponent)}
        <div class="start">
          <button type="button" class="btn btn-primary play-btn" onclick={play} disabled={!canSend}>
            {pending ? 'Starting…' : `Play ${opponent.name || `the ${opponent.label.toLowerCase()} bot`}`}
            {#if !pending}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
          </button>
          {#if searching}<p class="switch-note">Starting a bot game ends your player search.</p>{/if}
        </div>
      {/snippet}
    </BotChips>
    {#if searching}
      <SessionLine />
    {:else if onskip}
      <button type="button" class="human-link" onclick={onskip}>Looking for a human? <span>Try Quick Play</span></button>
    {/if}
  {:else}
    <SessionLine />
  {/if}
</div>

<style>
  .bot { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: stretch; gap: var(--sp-md); padding: var(--sp-sm) 0; width: 100%; }
  .intro { flex-shrink: 0; }
  .intro h2 { font-size: 1.4rem; line-height: 1.3; font-weight: 700; letter-spacing: -0.025em; }
  .intro p { margin-top: var(--sp-sm); color: var(--text-dim); font-size: var(--fs-body); }
  .start { flex-shrink: 0; padding-top: var(--sp-sm); border-top: 1px solid var(--surface2); }
  .play-btn { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; min-height: 56px; font-size: 1rem; }
  .play-btn svg { flex-shrink: 0; width: 20px; height: 20px; }
  .switch-note { margin-top: var(--sp-sm); text-align: center; color: var(--text-dim); font-size: var(--fs-caption); }
  .human-link { flex-shrink: 0; align-self: center; min-height: 44px; padding: var(--sp-sm); border: none; background: none; color: var(--text-dim); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
  .human-link span { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
</style>
