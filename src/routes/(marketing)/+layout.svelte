<script>
  let { children } = $props();
  const siteUrl = "https://purecheckers.com";
  let menuOpen = $state(false);
</script>

<svelte:head>
  <meta property="og:site_name" content="Pure Checkers" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="{siteUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="{siteUrl}/og-image.png" />
  <meta name="theme-color" content="#1c1917" />
  <link rel="alternate" hreflang="en" href="{siteUrl}/" />
  <link rel="alternate" hreflang="es" href="{siteUrl}/es/" />
  <link rel="alternate" hreflang="x-default" href="{siteUrl}/" />
</svelte:head>

<!-- Mobile hamburger (floating top-right) -->
<header class="mobile-header">
  <button
    class="hamburger"
    onclick={() => (menuOpen = !menuOpen)}
    aria-label="Toggle menu"
  >
    {#if menuOpen}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="22"
        height="22"
        ><line x1="18" y1="6" x2="6" y2="18" /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        /></svg
      >
    {:else}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="22"
        height="22"
        ><line x1="3" y1="6" x2="21" y2="6" /><line
          x1="3"
          y1="12"
          x2="21"
          y2="12"
        /><line x1="3" y1="18" x2="21" y2="18" /></svg
      >
    {/if}
  </button>
</header>

<!-- Mobile menu overlay -->
{#if menuOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="menu-overlay" onclick={() => (menuOpen = false)}></div>
  <nav class="mobile-menu" aria-label="Mobile navigation">
    <a href="/" onclick={() => (menuOpen = false)}>Home</a>
    <a href="/#features" onclick={() => (menuOpen = false)}>Features</a>
    <a href="/#how-to-play" onclick={() => (menuOpen = false)}>How to Play</a>
    <a href="/blog" onclick={() => (menuOpen = false)}>Blog</a>
    <a href="/strategy" onclick={() => (menuOpen = false)}>Strategy</a>
    <a href="/faq" onclick={() => (menuOpen = false)}>FAQ</a>
    <a href="/changelog" onclick={() => (menuOpen = false)}>Changelog</a>
    <hr />
    <div class="mobile-lang">
      <a href="/" onclick={() => (menuOpen = false)}>EN</a>
      <a href="/es/" onclick={() => (menuOpen = false)}>ES</a>
    </div>
    <a href="/auth" class="mobile-play" onclick={() => (menuOpen = false)}
      >Play Now</a
    >
  </nav>
{/if}

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
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          /></svg
        >
        Our Story
      </a>
      <a href="/#features" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline
            points="17 6 23 6 23 12"
          /></svg
        >
        Features
      </a>
      <a href="/#how-to-play" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><circle cx="12" cy="12" r="10" /><path
            d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
          /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
        >
        How to Play
      </a>
      <a href="/#about" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle
            cx="12"
            cy="7"
            r="4"
          /></svg
        >
        About
      </a>

      <hr class="sidebar-divider" />

      <span class="sidebar-label">Explore</span>
      <a href="/blog" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          /><polyline points="14 2 14 8 20 8" /><line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
          /><line x1="16" y1="17" x2="8" y2="17" /></svg
        >
        Blog & News
      </a>
      <a href="/changelog" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><polyline points="16 18 22 12 16 6" /><polyline
            points="8 6 2 12 8 18"
          /></svg
        >
        Changelog
      </a>
      <a href="/strategy" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          /></svg
        >
        Strategy Guides
      </a>
      <a href="/faq" class="sidebar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="18"
          height="18"
          ><circle cx="12" cy="12" r="10" /><path
            d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
          /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
        >
        FAQ
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
        <span class="mkt-footer-brand"
          ><span class="shimmer">Pure</span> Checkers</span
        >
        <p class="mkt-footer-tagline">
          Free multiplayer checkers. Play with friends or strangers worldwide.
        </p>
        <div class="mkt-footer-links">
          <a href="/">Home</a>
          <a href="/#features">Features</a>
          <a href="/#how-to-play">How to Play</a>
          <a href="/blog">Blog</a>
          <a href="/strategy">Strategy</a>
          <a href="/faq">FAQ</a>
          <a href="/changelog">Changelog</a>
        </div>
        <div class="mkt-footer-lang">
          <a href="/">English</a> · <a href="/es/">Español</a>
        </div>
        <p class="mkt-footer-copy">
          &copy; {new Date().getFullYear()} Pure Checkers. All rights reserved.
        </p>
      </div>
    </footer>
  </main>
</div>

<style>
  /* Mobile header */
  .mobile-header {
    position: fixed;
    top: max(var(--sp-sm), env(safe-area-inset-top));
    right: var(--sp-sm);
    z-index: 60;
  }
  .hamburger {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: var(--sp-sm);
    display: flex;
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .hamburger:hover {
    color: var(--text);
    background: var(--surface2);
  }

  @media (min-width: 900px) {
    .mobile-header {
      display: none;
    }
  }

  /* Mobile menu overlay */
  .menu-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 70;
  }
  .mobile-menu {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 260px;
    z-index: 80;
    background: var(--surface);
    border-left: 1px solid var(--surface2);
    padding: var(--sp-xl) var(--sp-lg);
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    overflow-y: auto;
    animation: slide-in 0.2s ease-out;
  }
  @keyframes slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  .mobile-menu a {
    color: var(--text-dim);
    text-decoration: none;
    font-size: var(--fs-body);
    font-weight: 500;
    padding: var(--sp-xs) 0;
    transition: color 0.15s;
  }
  .mobile-menu a:hover {
    color: var(--text);
  }
  .mobile-menu hr {
    border: none;
    border-top: 1px solid var(--surface2);
    margin: var(--sp-xs) 0;
  }
  .mobile-lang {
    display: flex;
    gap: var(--sp-md);
  }
  .mobile-lang a {
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  .mobile-play {
    display: block;
    text-align: center;
    padding: var(--sp-sm);
    background: linear-gradient(135deg, var(--accent), #dc2626);
    color: #fff !important;
    border-radius: var(--radius-sm);
    font-weight: 600;
    margin-top: var(--sp-sm);
  }

  @media (min-width: 900px) {
    .menu-overlay,
    .mobile-menu {
      display: none;
    }
  }

  /* Layout */
  .marketing-layout {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }

  /* Desktop sidebar */
  .sidebar {
    display: none;
  }

  @media (min-width: 900px) {
    .marketing-layout {
      height: calc(100dvh);
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      width: 220px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--surface2);
      padding: var(--sp-lg) var(--sp-md);
      overflow-y: auto;
    }
  }

  .sidebar-top {
    margin-bottom: var(--sp-xl);
  }
  .sidebar-logo {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
  }
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    flex: 1;
  }
  .sidebar-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    padding: var(--sp-xs) var(--sp-sm);
    margin-top: var(--sp-xs);
  }
  .sidebar-divider {
    border: none;
    border-top: 1px solid var(--surface2);
    margin: var(--sp-sm) 0;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-sm);
    border-radius: var(--radius-sm);
    color: var(--text-dim);
    font-size: var(--fs-body);
    font-weight: 500;
    text-decoration: none;
    transition:
      color 0.15s,
      background 0.15s;
  }
  .sidebar-link:hover {
    color: var(--text);
    background: var(--surface2);
  }
  .sidebar-link :global(svg) {
    flex-shrink: 0;
  }
  .sidebar-bottom {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    margin-top: var(--sp-md);
  }
  .sidebar-btn {
    display: block;
    text-align: center;
    padding: var(--sp-sm);
    border-radius: var(--radius-sm);
    font-size: var(--fs-caption);
    font-weight: 600;
    background: linear-gradient(135deg, var(--accent), #dc2626);
    color: #fff;
    text-decoration: none;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }
  .sidebar-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
  .sidebar-lang {
    display: flex;
    justify-content: center;
    gap: var(--sp-md);
  }
  .sidebar-lang a {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-dim);
    transition: color 0.15s;
  }
  .sidebar-lang a:hover {
    color: var(--accent);
  }

  /* Main content */
  .marketing-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  @media (max-width: 899px) {
    .marketing-layout {
      height: auto;
      min-height: 100dvh;
      flex-direction: column;
    }
    .marketing-main {
      overflow: visible;
    }
  }

  .shimmer {
    color: var(--accent);
    background: linear-gradient(
      120deg,
      var(--accent) 0%,
      #ff8a8a 40%,
      #fff 50%,
      #ff8a8a 60%,
      var(--accent) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 2.5s ease-in-out forwards;
  }
  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }

  /* Footer */
  .mkt-footer {
    border-top: 1px solid var(--surface2);
    padding: var(--sp-xl) var(--sp-md);
    margin-top: 64px;
  }
  .mkt-footer-inner {
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
  }
  .mkt-footer-brand {
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--text);
  }
  .mkt-footer-tagline {
    color: var(--text-dim);
    font-size: var(--fs-caption);
  }
  .mkt-footer-links {
    display: flex;
    gap: var(--sp-lg);
    flex-wrap: wrap;
    justify-content: center;
  }
  .mkt-footer-links a {
    color: var(--text-dim);
    font-size: var(--fs-caption);
    transition: color 0.15s;
  }
  .mkt-footer-links a:hover {
    color: var(--text);
  }
  .mkt-footer-lang {
    font-size: var(--fs-caption);
    color: var(--text-dim);
  }
  .mkt-footer-lang a {
    color: var(--text-dim);
    transition: color 0.15s;
  }
  .mkt-footer-lang a:hover {
    color: var(--accent);
  }
  .mkt-footer-copy {
    font-size: 0.65rem;
    color: var(--text-dim);
  }
</style>
