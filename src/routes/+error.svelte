<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import { page } from '$app/state';

  const title = $derived(
    page.status === 404 ? 'Page not found' : (page.error?.message || 'Something went wrong')
  );
  const blurb = $derived(
    page.status === 404
      ? 'The page you were looking for is not here. It may have moved, or the link may be wrong.'
      : 'Please try again in a moment. If it keeps happening, the game is still one click away.'
  );
</script>

<svelte:head>
  <title>{page.status} — {title} — Pure Checkers</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="error-page">
  <a class="brand" href="/"><span class="shimmer">Pure</span> Checkers</a>
  <p class="status">{page.status}</p>
  <h1>{title}</h1>
  <p class="blurb">{blurb}</p>
  <GameEntryLink class="play"  label="Play Checkers" />
  <nav aria-label="Helpful links">
    <a href="/">Home</a>
    <a href="/leaderboard">Leaderboard</a>
    <a href="/strategy">Strategy</a>
    <a href="/faq">FAQ</a>
    <a href="/changelog">Changelog</a>
  </nav>
</main>

<style>
  .error-page {
    min-height: 100dvh; padding: var(--sp-lg, 24px) var(--sp-md, 16px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-md, 16px); text-align: center;
    background: var(--bg, #1c1917); color: var(--text, #fafaf9);
    font-family: var(--font, 'Poppins', system-ui, sans-serif);
  }
  .brand { font-size: 1.15rem; font-weight: 700; color: var(--text, #fafaf9); text-decoration: none; letter-spacing: 1px; }
  .shimmer { color: var(--accent, #ef4444); }
  .status { font-size: 4rem; font-weight: 700; line-height: 1; color: var(--accent, #ef4444); }
  h1 { font-size: 1.4rem; font-weight: 600; }
  .blurb { color: var(--text-dim, #a8a29e); font-size: 0.95rem; line-height: 1.6; max-width: 440px; }
  .error-page :global(.play) {
    display: inline-block; margin-top: var(--sp-sm, 8px); padding: 12px 28px;
    background: linear-gradient(135deg, var(--accent, #ef4444), #dc2626); color: #fff;
    border-radius: var(--radius-sm, 8px); font-weight: 600; text-decoration: none;
  }
  nav { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-top: var(--sp-sm, 8px); }
  nav a { color: var(--text-dim, #a8a29e); font-size: 0.85rem; text-decoration: none; }
  nav a:hover { color: var(--text, #fafaf9); }
</style>
