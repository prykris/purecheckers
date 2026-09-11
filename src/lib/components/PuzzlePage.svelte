<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import PlayerLink from './PlayerLink.svelte';
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { watchPuzzleDay } from '$lib/puzzle/dayChange.js';
  import PublicIndex from './PublicIndex.svelte';
  import PuzzleBoard from './PuzzleBoard.svelte';
  import JsonLd from './JsonLd.svelte';
  import { formatPuzzleDate as formatDate, puzzleDescription, puzzleTheme } from '$lib/puzzle/presentation.js';
  import { colorName } from '../../../shared/notation.js';
  import { addDays, parsePuzzleDate, isoDate } from '../../../shared/puzzleDates.js';
  let { data } = $props();
  onMount(() => watchPuzzleDay(() => invalidateAll()));
  const title = $derived(data.hub ? 'Daily Checkers Puzzle' : `Checkers Puzzle for ${formatDate(data.puzzle.date)} — ${colorName(data.puzzle.sideToMove)} to move`);
  const path = $derived(data.hub ? '/puzzle' : '/puzzle/' + data.puzzle.date);
  const description = $derived(data.hub ? 'Find the combination, play the opponent’s replies and sharpen your checkers tactics. A new position every day at midnight UTC; no account needed.' : puzzleDescription(data.puzzle));
  const theme = $derived(data.puzzle && puzzleTheme(data.puzzle.theme));
  const webPage = $derived({
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': 'https://purecheckers.com' + path + '#webpage',
    name: title, description, url: 'https://purecheckers.com' + path, inLanguage: 'en',
    isPartOf: { '@id': 'https://purecheckers.com/#website' },
    ...(!data.hub ? { datePublished: data.puzzle.date + 'T00:00:00Z',
      dateModified: (data.archived ? isoDate(addDays(parsePuzzleDate(data.puzzle.date), 1)) : data.puzzle.date) + 'T00:00:00Z' } : {})
  });
</script>

<svelte:head>
  {#if !data.hub && data.prev}<link rel="prev" href={'https://purecheckers.com/puzzle/' + data.prev} />{/if}
  {#if !data.hub && data.next}<link rel="next" href={'https://purecheckers.com/puzzle/' + data.next} />{/if}
</svelte:head>
<JsonLd data={webPage} />
<PublicIndex {title} {path} {description} parents={data.hub ? [] : [{ name: 'Daily Puzzle', path: '/puzzle' }]} breadcrumbLabel={data.hub ? 'Daily Puzzle' : formatDate(data.puzzle.date)}>
  {#if data.puzzle}
    <p class="rules"><time datetime={data.puzzle.date}>{formatDate(data.puzzle.date)}</time> (UTC) · <a href="/strategy/checkers-rules">House rules: backward captures and flying kings</a></p>
    {#key data.puzzle.date}<PuzzleBoard puzzle={data.puzzle} archived={data.archived} />{/key}
    <nav class="dates" aria-label="Puzzle dates">
      {#if data.prev}<a href={'/puzzle/' + data.prev}>← Previous puzzle</a>{/if}
      {#if !data.hub}<a href="/puzzle">Today and archive</a>{/if}
      {#if data.next}<a href={'/puzzle/' + data.next}>Next puzzle →</a>{/if}
    </nav>
    <p class="tip">Practise this {theme.label} idea: <a href={theme.url}>{theme.guideLabel}</a>.</p>
    {#if data.puzzle.source}
      <p class="tip">From <a href={data.puzzle.source.url}>a game</a> between <PlayerLink username={data.puzzle.source.redPlayer} profileUrl={data.puzzle.source.redProfileUrl} /> and <PlayerLink username={data.puzzle.source.blackPlayer} profileUrl={data.puzzle.source.blackProfileUrl} />.</p>
    {/if}
  {:else}
    <p class="empty">Today’s puzzle is being prepared. You can practice with the archive below or <GameEntryLink  label="play a game" />.</p>
  {/if}
  {#if data.hub}
    <section class="about-puzzles">
      <h2>A little practice, every day</h2>
      <p>Look at the whole board before moving. Captures are compulsory, including backward captures by ordinary pieces. Kings can travel along an open diagonal, so a distant piece can change a combination. Count what happens after the reply, not just what you take on the first jump.</p>
      <p>Select a piece and a destination, drag it, or use the arrow keys and Enter. Finish every jump in a capture chain before judging your move. If a choice misses the line, the board returns to the start of that turn so you can try again. A hint points out the piece to consider; showing the solution plays through the full combination.</p>
      <p>Solving on consecutive UTC dates builds a streak. Registered players earn one coin for their first solve of today’s puzzle. Revealing the solution earns no coin and does not extend the streak. Archive puzzles are always free to practice and award no coins.</p>
      <p>Reaching the far row crowns a man and ends that capture turn, even when the new king could jump again. Come back for a new position tomorrow, or compare your approach with the explanation on a past puzzle. These positions use the same <a href="/strategy/checkers-rules">rules as our live games</a>.</p>
    </section>
    <section class="archive">
      <h2>Puzzle archive</h2>
      {#if data.archive.length}
        <ul>{#each data.archive as puzzle (puzzle.date)}
          <li><a href={'/puzzle/' + puzzle.date}><time datetime={puzzle.date}>{formatDate(puzzle.date)}</time><span>{puzzle.difficulty.toLowerCase()} · {puzzleTheme(puzzle.theme).label}</span></a><span>{puzzle.attempts ? Math.round(puzzle.solveRate * 100) + '% solved' : 'No attempts yet'}</span></li>
        {/each}</ul>
        {#if data.nextBefore}<a href={'/puzzle?before=' + data.nextBefore}>Older puzzles →</a>{/if}
      {:else}<p>No published puzzles yet.</p>{/if}
    </section>
  {/if}
</PublicIndex>

<style>
  .rules, .tip { color: var(--text-dim); line-height: 1.7; margin: var(--sp-lg) 0; }
  .dates { display: flex; flex-wrap: wrap; gap: var(--sp-lg); margin-top: var(--sp-xl); }
  .dates a { padding: var(--sp-sm) 0; }
  .about-puzzles, .archive { margin-top: var(--sp-xl); }
  h2 { font-size: var(--fs-heading); margin-bottom: var(--sp-md); }
  .about-puzzles p { color: var(--text-dim); line-height: 1.8; margin: var(--sp-md) 0; }
  ul { padding: 0; list-style: none; margin-bottom: var(--sp-lg); }
  li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-md); border-bottom: 1px solid var(--surface2); }
  li a { flex: 1; padding: var(--sp-md) 0; }
  li span { color: var(--text-dim); font-size: var(--fs-caption); }
  li a span { display: block; margin-top: 4px; }
</style>
