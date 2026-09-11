<script>
  import PlayerLink from './PlayerLink.svelte';
  import { gameResultLabel, winningColor } from '../../../shared/gameResult.js';
  import { describeHistory } from '../../../shared/gameHistory.js';
  import ReplayBoard from '$lib/components/ReplayBoard.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import ShareActions from './ShareActions.svelte';

  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const g = data.game;
  // svelte-ignore state_referenced_locally
  const indexable = data.indexable;

  const siteUrl = 'https://purecheckers.com';
  const gameUrl = `${siteUrl}/game/${g.id}`;
  const moves = Array.isArray(g.moveHistory) ? g.moveHistory : [];
  const resultText = gameResultLabel(g.result, { red: g.redPlayer, black: g.blackPlayer });
  const fmtDate = new Date(g.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isoDate = new Date(g.date).toISOString();

  const { moveLog } = describeHistory(moves);
  const movePairs = [];
  for (let i = 0; i < moveLog.length; i += 2) {
    movePairs.push({ n: i / 2 + 1, red: moveLog[i].notation, black: moveLog[i + 1]?.notation ?? null });
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${siteUrl}/` },
      { "@type": "ListItem", "position": 2, "name": `Game #${g.id}`, "item": gameUrl }
    ]
  };
</script>

<svelte:head>
  <title>{g.redPlayer} vs {g.blackPlayer} — Game Replay — Pure Checkers</title>
  <meta name="description" content="Watch the checkers game between {g.redPlayer} and {g.blackPlayer}. {resultText}. {moves.length} moves played." />
  <link rel="canonical" href={gameUrl} />
  <meta property="og:title" content="{g.redPlayer} vs {g.blackPlayer} — Checkers Replay" />
  <meta property="og:description" content="{resultText} · {moves.length} moves · {g.mode}" />
  <meta property="og:url" content={gameUrl} />
  {#if !indexable}
    <meta name="robots" content="noindex,follow" />
  {/if}
</svelte:head>

<JsonLd data={breadcrumbSchema} />

<section class="replay-page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span aria-current="page">Game #{g.id}</span>
  </nav>

  <h1 class="replay-title"><PlayerLink username={g.redPlayer} profileUrl={g.redProfileUrl} /> vs <PlayerLink username={g.blackPlayer} profileUrl={g.blackProfileUrl} /> — Checkers Replay</h1>

  <div class="meta">
    <span class="mode">{g.mode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
    <time class="date" datetime={isoDate}>{fmtDate}</time>
    <span class="result">{#if winningColor(g.result)}<PlayerLink username={g.result === 'RED_WIN' ? g.redPlayer : g.blackPlayer} profileUrl={g.result === 'RED_WIN' ? g.redProfileUrl : g.blackProfileUrl} /> wins{:else}{resultText}{/if}</span>
  </div>

  <ReplayBoard gameData={g} />
  <ShareActions surface="replay" url={gameUrl} data={g} label="Share replay" />

  <div class="players">
    <span class="player-link"><span class="dot red"></span> <PlayerLink username={g.redPlayer} profileUrl={g.redProfileUrl} /></span>
    <span class="player-link"><span class="dot black"></span> <PlayerLink username={g.blackPlayer} profileUrl={g.blackProfileUrl} /></span>
  </div>

  <section class="moves" aria-labelledby="moves-heading">
    <h2 id="moves-heading" class="moves-heading">Moves</h2>
    {#if movePairs.length > 0}
      <ol class="move-list">
        {#each movePairs as pair (pair.n)}
          <li>
            <span class="mv red">{pair.red}</span>
            {#if pair.black}<span class="mv black">{pair.black}</span>{/if}
          </li>
        {/each}
      </ol>
      <p class="moves-note">Squares are numbered 1–32 from Red’s end of the board; Red starts on 1–12 and moves first. “x” marks a capture, “K” a crowning.</p>
    {:else}
      <p class="moves-note">No moves were recorded for this game.</p>
    {/if}
  </section>
</section>

<style>
  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  .replay-page {
    max-width: 500px; margin: 0 auto;
    padding: 48px var(--sp-md) 120px;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg);
  }

  .replay-title { font-size: var(--fs-heading); font-weight: 700; text-align: center; color: var(--text); }

  .meta { display: flex; gap: var(--sp-sm); align-items: center; font-size: var(--fs-caption); flex-wrap: wrap; justify-content: center; }
  .mode { color: var(--text-dim); padding: 1px 6px; background: var(--surface2); border-radius: var(--radius-pill); }
  .date { color: var(--text-dim); }
  .result { color: var(--text); font-weight: 600; }

  .players { display: flex; gap: var(--sp-lg); }
  .player-link { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-body); font-weight: 500; color: var(--text-dim); text-decoration: none; transition: color 0.15s; }
  .player-link:hover { color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.red { background: var(--accent); }
  .dot.black { background: var(--text-dim); }

  .moves { width: 100%; }
  .moves-heading { font-size: var(--fs-body); font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: var(--sp-sm); }
  .move-list {
    list-style: decimal; padding-left: 2.5em; margin: 0;
    columns: 2; column-gap: var(--sp-lg);
    font-family: var(--font-mono); font-size: var(--fs-caption); color: var(--text);
  }
  .move-list li { padding: 2px 0; break-inside: avoid; }
  .move-list li::marker { color: var(--text-dim); }
  .mv { display: inline-block; min-width: 4.5em; }
  .mv.red { color: var(--accent); }
  .mv.black { color: var(--text); }
  .moves-note { margin-top: var(--sp-md); font-size: var(--fs-caption); color: var(--text-dim); line-height: 1.5; }
</style>
