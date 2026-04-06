<script>
  let { children } = $props();
  const siteUrl = 'https://purecheckers.com';
</script>

<svelte:head>
  <!-- Global OG defaults (pages override title/description/url) -->
  <meta property="og:site_name" content="Pure Checkers" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="{siteUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card defaults -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="{siteUrl}/og-image.png" />

  <!-- Theme color -->
  <meta name="theme-color" content="#1c1917" />

  <!-- hreflang -->
  <link rel="alternate" hreflang="en" href="{siteUrl}/" />
  <link rel="alternate" hreflang="es" href="{siteUrl}/es/" />
  <link rel="alternate" hreflang="x-default" href="{siteUrl}/" />
</svelte:head>

<div class="marketing-layout">
  <!-- Desktop sidebar -->
  <nav class="sidebar" aria-label="Main navigation">
    <div class="sidebar-top">
      <a href="/" class="sidebar-logo">
        <span class="shimmer">Pure</span> Checkers
      </a>
    </div>

    <div class="sidebar-nav">
      <span class="sidebar-label">On this page</span>
      <a href="/#story" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        Our Story
      </a>
      <a href="/#features" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        Features
      </a>
      <a href="/#how-to-play" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        How to Play
      </a>
      <a href="/#about" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        About
      </a>

      <hr class="sidebar-divider" />

      <span class="sidebar-label">Explore</span>
      <a href="/blog" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Blog & News
      </a>
      <a href="/changelog" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Changelog
      </a>
      <a href="/strategy" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Strategy Guides
      </a>
    </div>

    <div class="sidebar-bottom">
      <a href="/auth" class="sidebar-btn">Play Now</a>
      <div class="sidebar-lang">
        <a href="/">EN</a>
        <a href="/es/">ES</a>
      </div>
    </div>
  </nav>

  <main class="marketing-main">
    {@render children()}

    <footer class="mkt-footer">
      <div class="mkt-footer-inner">
        <span class="mkt-footer-brand"><span class="shimmer">Pure</span> Checkers</span>
        <p class="mkt-footer-tagline">Free multiplayer checkers. Play with friends or strangers worldwide.</p>
        <div class="mkt-footer-links">
          <a href="/#features">Features</a>
          <a href="/#how-to-play">How to Play</a>
          <a href="/#about">About</a>
          <a href="/blog">Blog</a>
          <a href="/changelog">Changelog</a>
        </div>
        <p class="mkt-footer-copy">&copy; {new Date().getFullYear()} Pure Checkers. All rights reserved.</p>
      </div>
    </footer>
  </main>
</div>

<style>
  .marketing-layout {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }

  .sidebar { display: none; }

  @media (min-width: 900px) {
    .sidebar {
      display: flex; flex-direction: column; width: 220px; flex-shrink: 0;
      background: var(--surface); border-right: 1px solid var(--surface2);
      padding: var(--sp-lg) var(--sp-md); overflow-y: auto;
    }
  }

  .sidebar-top { margin-bottom: var(--sp-xl); }
  .sidebar-logo { font-size: 1.15rem; font-weight: 700; color: var(--text); text-decoration: none; }
  .sidebar-nav { display: flex; flex-direction: column; gap: var(--sp-xs); flex: 1; }
  .sidebar-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); padding: var(--sp-xs) var(--sp-sm); margin-top: var(--sp-xs); }
  .sidebar-divider { border: none; border-top: 1px solid var(--surface2); margin: var(--sp-sm) 0; }
  .sidebar-link { display: flex; align-items: center; gap: var(--sp-sm); padding: var(--sp-sm); border-radius: var(--radius-sm); color: var(--text-dim); font-size: var(--fs-body); font-weight: 500; text-decoration: none; transition: color 0.15s, background 0.15s; }
  .sidebar-link:hover { color: var(--text); background: var(--surface2); }
  .sidebar-link :global(svg) { flex-shrink: 0; }
  .sidebar-bottom { display: flex; flex-direction: column; gap: var(--sp-sm); margin-top: var(--sp-md); }
  .sidebar-btn { display: block; text-align: center; padding: var(--sp-sm); border-radius: var(--radius-sm); font-size: var(--fs-caption); font-weight: 600; background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
  .sidebar-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
  .sidebar-lang { display: flex; justify-content: center; gap: var(--sp-md); }
  .sidebar-lang a { font-size: 0.75rem; font-weight: 600; color: var(--text-dim); transition: color 0.15s; }
  .sidebar-lang a:hover { color: var(--accent); }

  .marketing-main { flex: 1; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; }

  .shimmer { color: var(--accent); background: linear-gradient(120deg, var(--accent) 0%, #ff8a8a 40%, #fff 50%, #ff8a8a 60%, var(--accent) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 2.5s ease-in-out forwards; }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

  .mkt-footer { border-top: 1px solid var(--surface2); padding: var(--sp-xl) var(--sp-md); margin-top: 64px; }
  .mkt-footer-inner { max-width: 800px; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--sp-sm); }
  .mkt-footer-brand { font-size: var(--fs-heading); font-weight: 700; color: var(--text); }
  .mkt-footer-tagline { color: var(--text-dim); font-size: var(--fs-caption); }
  .mkt-footer-links { display: flex; gap: var(--sp-lg); flex-wrap: wrap; justify-content: center; }
  .mkt-footer-links a { color: var(--text-dim); font-size: var(--fs-caption); transition: color 0.15s; }
  .mkt-footer-links a:hover { color: var(--text); }
  .mkt-footer-copy { font-size: 0.65rem; color: var(--text-dim); }
</style>
