<script>
  import { onMount } from 'svelte';
  import PlayerLink from './PlayerLink.svelte';
  import { playerResultLabel, gameEndReason, gameResultLabel } from '../../../shared/gameResult.js';
  import { historyDetails, historyPerspective, historyTime } from '$lib/gameHistoryPresentation.js';

  // Presentation only: callers own fetching, filtering and replay navigation.
  let { games, playerId = null, opponentsOnly = false, scrollable = false, onreplay = null, replayTarget = undefined } = $props();
  const listId = $props.id();
  let expandedId = $state(null);
  let now = $state(Date.now());
  $effect(() => { if (!games.some(game => game.id === expandedId)) expandedId = null; });
  onMount(() => {
    const timer = setInterval(() => now = Date.now(), 60_000);
    return () => clearInterval(timer);
  });

  function replay(event, id) {
    if (!onreplay || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onreplay(id);
  }
</script>

<div class="game-history" class:scrollable>
  {#each games as game (game.id)}
    {@const perspective = historyPerspective(game, playerId)}
    {@const outcomeLabel = perspective.color ? playerResultLabel(perspective.result) : gameResultLabel(game.result)}
    {@const endingLabel = gameEndReason(game.endReason, game.result)}
    {@const expanded = expandedId === game.id}
    {@const label = `${game.redPlayer || 'Unknown'} vs ${game.blackPlayer || 'Unknown'}`}
    {@const opponent = perspective.color === 'red' ? 'black' : 'red'}
    <div class="game-row" class:win={perspective.result === 'win'} class:loss={perspective.result === 'loss'} class:draw={game.result === 'DRAW'} class:cancelled={game.result === 'ABORTED'} class:expanded>
      <div class="summary" title={`${outcomeLabel} · ${endingLabel} · ${game.mode === 'RANKED' ? 'Ranked' : 'Friendly'}`}>
        <button type="button" class="expand" aria-label={`${expanded ? 'Hide' : 'Show'} details for ${label}`} aria-expanded={expanded} aria-controls={`${listId}-${game.id}`} onclick={() => expandedId = expanded ? null : game.id}></button>
        <span class="ending-icon" role="img" aria-label={outcomeLabel} title={`${outcomeLabel} · ${endingLabel}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            {#if game.endReason === 'resign'}<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
            {:else if game.endReason === 'timeout'}<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            {:else if game.result === 'ABORTED'}<circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" />
            {:else if game.result === 'DRAW'}<path d="M5 9h14M5 15h14" />
            {:else if ['disconnect', 'abandon', 'restart-disconnect'].includes(game.endReason)}<path d="m3 3 18 18M8 4h10v12M8 20h10M4 12h8m-3-3 3 3-3 3" />
            {:else}<path d="m4 6 4 4 4-7 4 7 4-4-2 12H6zM7 21h10" />{/if}
          </svg>
          <span class="sr-only">{endingLabel}</span>
        </span>
        <div class="players">
          {#if opponentsOnly && perspective.color}
            <span class="vs">vs</span>
            <span class="name"><PlayerLink username={game[`${opponent}Player`]} profileUrl={game[`${opponent}ProfileUrl`]} /></span>
          {:else}
            <span class="name" class:winner={game.result === 'RED_WIN'}><PlayerLink username={game.redPlayer} profileUrl={game.redProfileUrl} /></span>
            <span class="vs">vs</span>
            <span class="name" class:winner={game.result === 'BLACK_WIN'}><PlayerLink username={game.blackPlayer} profileUrl={game.blackProfileUrl} /></span>
          {/if}
          {#if game.mode === 'RANKED'}<span class="ranked-mark" role="img" aria-label="Ranked game" title="Ranked game"><svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"><path d="m8 1 6 7-6 7-6-7zM5 8h6" /></svg></span>{/if}
          {#if game.isBotGame}<span class="bot-tag">vs bot</span>{/if}
        </div>
        <div class="meta">
          <div class="quick-stats">
            <span>{historyTime(game.endedAt || game.date, now)}</span>
          </div>
          <a class="replay" href="/game/{game.id}" target={replayTarget} rel={replayTarget === '_blank' ? 'noopener' : undefined} aria-label={`Replay ${label}${replayTarget === '_blank' ? ' in a new tab' : ''}`} onclick={event => replay(event, game.id)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 3v18l15-9z" /></svg>Replay
          </a>
        </div>
      </div>
      <div id={`${listId}-${game.id}`} hidden={!expanded}>
        {#if expanded}
          <dl class="details">
            {#each historyDetails(game, playerId) as detail}
              <div><dt title={detail.help}>{detail.label}</dt><dd>{detail.value}</dd></div>
            {/each}
          </dl>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .game-history { min-width: 0; }
  .scrollable { flex: 1; min-height: 0; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--surface2) transparent; }
  .game-row { border-bottom: 1px solid var(--surface2); border-left: 2px solid transparent; }
  .ending-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--text-dim); pointer-events: none; }
  .win .ending-icon { color: var(--success); }
  .loss .ending-icon { color: var(--accent); }
  .draw .ending-icon { color: var(--gold); }
  .cancelled .players { opacity: .65; }
  .ranked-mark { color: var(--gold); display: inline-flex; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .game-row.win { border-left-color: var(--success); }
  .game-row.loss { border-left-color: var(--accent); }
  .summary { position: relative; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px; }
  .expand { position: absolute; inset: 0; width: 100%; border: 0; background: transparent; cursor: pointer; border-radius: 4px; }
  .expand:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .players { position: relative; pointer-events: none; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; flex: 1; min-width: 0; padding: 6px 0; font-size: var(--fs-caption); color: var(--text-dim); }
  .players :global(a) { pointer-events: auto; }
  .name { min-width: 0; overflow-wrap: anywhere; }
  .winner { font-weight: 700; color: var(--text); }
  .vs { opacity: .6; }
  .bot-tag { font-size: .55rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--accent2); background: rgba(168,85,247,.12); padding: 1px 5px; border-radius: var(--radius-pill); white-space: nowrap; }
  .meta { display: grid; align-items: center; flex-shrink: 0; pointer-events: none; font-size: .65rem; }
  .quick-stats, .replay { grid-area: 1 / 1; }
  .quick-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; color: var(--text-dim); }
  .replay { position: relative; opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 0 6px; color: var(--accent); font-weight: 600; text-decoration: none; border-radius: 6px; }
  .replay:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; opacity: 1; pointer-events: auto; background: var(--surface); }
  .expanded { background: var(--surface); }
  .expanded .quick-stats, .meta:has(.replay:focus-visible) .quick-stats { visibility: hidden; }
  .expanded .replay { opacity: 1; pointer-events: auto; }
  .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; padding: 8px 12px 16px; }
  dt { font-size: .65rem; color: var(--text-dim); }
  dd { margin: 3px 0 0; font-size: var(--fs-caption); overflow-wrap: anywhere; }
  @media (hover: hover) and (pointer: fine) {
    .summary { min-height: 40px; }
    .replay { min-height: 40px; }
    .summary:hover .quick-stats, .summary:focus-within .quick-stats { visibility: hidden; }
    .summary:hover .replay, .summary:focus-within .replay { opacity: 1; pointer-events: auto; }
    .replay:hover { background: var(--surface2); }
  }
</style>
