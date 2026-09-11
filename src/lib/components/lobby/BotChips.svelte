<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { createBotRoster } from '$lib/botRoster.js';
  import { createBotStats, bindBotStats } from '$lib/botStats.js';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { session } from '$lib/stores/session.js';
  import { botDifficulty, setBotDifficulty, DIFFICULTIES, difficultyLabel } from '$lib/stores/ui.js';

  // Both layouts share the roster read and remembered difficulty. Roster availability
  // never gates play; names fall back to difficulty labels.
  let { disabled = false, layout = 'compact', children } = $props();
  const descriptions = {
    easy: 'Get comfortable with the board and find your rhythm.',
    medium: 'Sharpen your tactics and look a few moves ahead.',
    hard: 'Put your combinations and careful planning to the test.',
  };
  const groupId = $props.id();
  let roster = $state({ data: null, status: 'idle', error: null });
  let resource;
  let stats = $state({ data: null, status: 'idle', error: null });
  let statsResource;

  onMount(() => {
    resource = createBotRoster({ request: api.get, publish: value => { roster = value; } });
    void resource.refresh();
    let stopStats;
    if (layout === 'cards') {
      statsResource = createBotStats({ request: api.get, readScope: captureSession, isCurrent: isCurrentSession, publish: value => { stats = value; } });
      stopStats = bindBotStats({ resource: statsResource, user, session, capture: captureSession,
        onFocus: callback => { window.addEventListener('focus', callback); return () => window.removeEventListener('focus', callback); } });
    }
    return () => { resource.dispose(); stopStats?.(); };
  });

  const chips = $derived(DIFFICULTIES.map(difficulty => {
    const bot = roster.data?.find(b => b.difficulty === difficulty);
    const name = bot?.displayName && bot.displayName !== difficultyLabel(difficulty) ? bot.displayName : null;
    return { difficulty, label: difficultyLabel(difficulty), name, rating: bot?.rating ?? null };
  }));
</script>

<div class="picker" class:card-picker={layout === 'cards'}>
<div class="options">
<div class="chips" class:cards={layout === 'cards'} role="radiogroup" aria-label="Bot difficulty" aria-busy={roster.status === 'loading'}>
  {#each chips as chip (chip.difficulty)}
    {@const record = stats.data?.find(row => row.difficulty === chip.difficulty)}
    {@const games = record ? record.wins + record.draws + record.losses : 0}
    <label class="chip {chip.difficulty}" class:selected={$botDifficulty === chip.difficulty} class:disabled>
      <input type="radio" name={groupId} value={chip.difficulty} checked={$botDifficulty === chip.difficulty} {disabled}
        onchange={() => setBotDifficulty(chip.difficulty)} />
      {#if layout === 'cards'}
        <span class="portrait" aria-hidden="true">
          <span class="checker back"></span>
          <span class="checker front"><span class="checker-mark">{chip.difficulty === 'easy' ? 'I' : chip.difficulty === 'medium' ? 'II' : 'III'}</span></span>
        </span>
        <span class="opponent">
          <span class="opponent-meta">{chip.label}{chip.rating !== null ? ` · ${chip.rating} rating` : ''}</span>
          <span class="opponent-name">{chip.name || chip.label}</span>
          <span class="opponent-description">{descriptions[chip.difficulty]}</span>
        </span>
        <span class="selection" aria-hidden="true">
          {#if $botDifficulty === chip.difficulty}
            <svg viewBox="0 0 20 20" fill="none"><path d="m5 10 3.5 3.5L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {/if}
        </span>
        <span class="personal-record">
          {#if stats.status === 'error'}
            <span class="record-empty">Your stats are unavailable</span>
          {:else if record && games > 0}
            <span class="record-score"><span><b>{record.wins}</b> wins</span><span><b>{record.draws}</b> draws</span><span><b>{record.losses}</b> losses</span></span>
            <span class="win-rate">{Math.round(record.wins / games * 100)}% wins</span>
          {:else}
            <span class="record-empty">{stats.status === 'loading' ? 'Loading your record…' : record ? 'No games yet. Start your record.' : 'Play to build your record.'}</span>
          {/if}
        </span>
      {:else if chip.name}
        <span class="chip-name">{chip.name}</span>
        <span class="chip-sub">{chip.label}{chip.rating !== null ? ` · ${chip.rating}` : ''}</span>
      {:else}
        <span class="chip-name">{chip.label}</span>
      {/if}
    </label>
  {/each}
</div>
{#if roster.status === 'error'}
  <div class="roster-feedback">
    <span role="status">Bot details unavailable. You can still play.</span>
    <button type="button" onclick={() => resource?.refresh()}>Retry</button>
  </div>
{/if}
{#if layout === 'cards' && stats.status === 'error'}
  <div class="roster-feedback">
    <span role="status">Could not load your personal stats.</span>
    <button type="button" onclick={() => statsResource?.refresh()}>Retry</button>
  </div>
{/if}
</div>
{#if children}
  {@render children(chips.find(chip => chip.difficulty === $botDifficulty))}
{/if}
</div>

<style>
  .picker, .options { display: contents; }
  .card-picker { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: var(--sp-sm); }
  .card-picker .options { display: block; flex: 1; min-height: 0; overflow-y: auto; padding: 4px; margin: -4px; scrollbar-width: thin; scrollbar-color: var(--surface2) transparent; }
  .chips { display: flex; gap: var(--sp-sm); width: 100%; }
  .chip {
    flex: 1; min-width: 0; position: relative; min-height: 44px; padding: var(--sp-xs) var(--sp-sm);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    background: var(--surface); border: 2px solid var(--surface2); border-radius: var(--radius-pill);
    color: var(--text-dim); font-family: var(--font); cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .chip input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
  .chip:focus-within { outline: 2px solid var(--text); outline-offset: 3px; }
  .chip.disabled { opacity: 0.6; cursor: default; }
  .chip-name { font-size: var(--fs-caption); font-weight: 600; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
  .chip-sub { font-size: var(--fs-caption); line-height: 1.3; text-align: center; }
  .chip.easy.selected { color: var(--success); border-color: var(--success); }
  .chip.medium.selected { color: var(--warning); border-color: var(--warning); }
  .chip.hard.selected { color: var(--accent); border-color: var(--accent); }
  .cards { flex-direction: column; gap: 12px; }
  .cards .chip {
    --opponent-color: var(--success);
    flex: none; display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px;
    padding: 16px; border-radius: var(--radius-lg);
    text-align: left; color: var(--text); border: 1px solid var(--surface2);
    transition: border-color 160ms, background-color 160ms;
  }
  .cards .medium { --opponent-color: var(--warning); }
  .cards .hard { --opponent-color: var(--accent); }
  .cards .chip.selected {
    color: var(--text); border-color: var(--opponent-color);
    background: color-mix(in srgb, var(--opponent-color) 7%, var(--surface));
    box-shadow: inset 0 0 0 1px var(--opponent-color);
  }
  .portrait { position: relative; flex: 0 0 64px; height: 72px; pointer-events: none; }
  .checker { position: absolute; width: 54px; height: 54px; border-radius: 50%; background: var(--opponent-color); border: 1px solid color-mix(in srgb, var(--opponent-color), white 25%); box-shadow: 0 5px 0 color-mix(in srgb, var(--opponent-color), black 45%), 0 9px 14px #0003; }
  .checker.back { top: 1px; left: 9px; opacity: 0.45; }
  .checker.front { left: 0; top: 13px; display: grid; place-items: center; }
  .checker-mark { display: grid; place-items: center; width: 39px; height: 39px; border: 1px solid #0004; border-radius: 50%; color: #201c18; font-family: Georgia, serif; font-size: 22px; font-weight: 700; }
  .opponent { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
  .opponent-meta { color: var(--text-dim); font-size: 0.75rem; line-height: 1.4; padding-right: 22px; }
  .opponent-name { font-size: 1.125rem; line-height: 1.3; font-weight: 700; overflow-wrap: anywhere; }
  .opponent-description { color: var(--text-dim); font-size: 0.875rem; line-height: 1.5; }
  .selection { position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; border: 1px solid var(--text-dim); border-radius: 50%; pointer-events: none; }
  .selected .selection { background: var(--opponent-color); border-color: var(--opponent-color); color: #201c18; }
  .selection svg { width: 100%; height: 100%; }
  .personal-record { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border-top: 1px solid var(--surface2); padding-top: 12px; color: var(--text-dim); font-size: 0.75rem; line-height: 1.5; }
  .record-score { display: flex; flex-wrap: wrap; gap: 12px; }
  .record-score b { color: var(--text); font-weight: 600; }
  .win-rate { color: var(--text); }
  @media (hover: hover) { .cards .chip:not(.disabled):hover { border-color: var(--opponent-color); } }
  @media (max-width: 600px) {
    .cards { gap: 10px; }
    .cards .chip { padding: 12px; gap: 10px; grid-template-columns: 50px minmax(0, 1fr); }
    .portrait { height: 58px; transform: scale(0.8); transform-origin: left center; }
    .opponent-description { font-size: 0.8rem; line-height: 1.4; }
    .personal-record { padding-top: 8px; gap: 4px 8px; }
    .record-score { gap: 8px; }
  }
  .roster-feedback { display: flex; align-items: center; gap: var(--sp-sm); color: var(--text-dim); font-size: var(--fs-caption); }
  .roster-feedback button { min-height: 44px; padding: 0 var(--sp-sm); background: none; border: none; color: var(--accent); font: inherit; cursor: pointer; }
  @media (prefers-reduced-motion: reduce) { .chip, .cards .chip { transition: none; } }
</style>
