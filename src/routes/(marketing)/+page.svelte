<script>
  const boardCells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isDark = (row + col) % 2 === 1;
    let piece = null;
    if (isDark && row < 3) piece = 'red';
    if (isDark && row > 4) piece = 'black';
    return { isDark, piece };
  });
</script>

<svelte:head>
  <title>Pure Checkers — Free Online Checkers, No Ads, No Paywalls</title>
  <meta name="description" content="Play checkers online for free. No ads, no energy bars, no in-app purchases. Create rooms, play with friends, earn ELO, and enjoy checkers the way it should be." />
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Pure Checkers",
    "url": "https://purecheckers.com",
    "applicationCategory": "GameApplication",
    "operatingSystem": "Any",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  })}
  </script>
</svelte:head>

<!-- ===== HERO ===== -->
<section class="hero" id="top">
  <h1 class="hero-logo"><span class="shimmer">Pure</span> Checkers</h1>

  <div class="board" aria-label="Checkerboard with pieces in starting position">
    {#each boardCells as cell}
      <div class="cell" class:dark={cell.isDark} class:light={!cell.isDark}>
        {#if cell.piece}
          <div class="piece" class:piece-red={cell.piece === 'red'} class:piece-black={cell.piece === 'black'}></div>
        {/if}
      </div>
    {/each}
  </div>

  <a href="/auth" class="play-btn">Play Now — It's Free</a>
  <p class="hero-note">No account required. Pick a nickname and go.</p>
</section>

<!-- ===== STORY ===== -->
<section class="section" id="story">
  <h2 class="section-title">Why Pure Checkers Exists</h2>
  <div class="prose">
    <p>When I started to look for apps on my phone to play checkers, I did find many, yet all of those suckers had ads or worse yet — an energy bar that was so limited that after two games I couldn't play no more unless I watched a painful ad of some game that a huge corporation made for a cashgrab.</p>
    <p>For just 5 dollars I could renew my energy and play 10 more games, can you imagine that? This hosting costs me 5 dollars a month, and thousands can play for free, forever freed from the greedy preying on you!</p>
    <p>This was made solely for myself, but I prepared it to be enjoyed by anyone. It took me a few days to make but I've already made my money back even if forever there will be no players here. I'll be here adding features, and thinking about players instead of a profit.</p>
    <p>Checkers shouldn't be something that only the rich can enjoy nowadays. Whilst I like playing on a physical board, a match or two on the go is what this app is for.</p>
  </div>
</section>

<!-- ===== FEATURES ===== -->
<section class="section" id="features">
  <h2 class="section-title">What You Get</h2>
  <div class="features-list">
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><div><h3>No Ads. Ever.</h3><p>No banners, no popups, no video ads. Just the game.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div><h3>Free For All. Forever.</h3><p>No in-app purchases, no energy bars, no paywalls. Play as much as you want.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div><h3>No Registration Required</h3><p>Pick a nickname and play. Create an account later if you want to keep your stats.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><div><h3>Works on Any Device</h3><p>Anyone with a browser can play — PC, phone, tablet. No app to download.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div><h3>Room System</h3><p>Create a room, let your friend scan a QR code, and you're playing.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div><h3>In-Game & Global Chat</h3><p>Talk to your opponent mid-game or hang out in global chat between matches.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><div><h3>ELO Rating & Leaderboard</h3><p>Earn your ranking with every win. Climb the board and see where you stand.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg><div><h3>Spectator Mode</h3><p>Watch other players' games live. Learn from the best or just enjoy the show.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><div><h3>Cosmetic Shop</h3><p>Earn coins by playing. Spend them on board themes and piece skins. Nothing that affects gameplay.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><div><h3>Closed Economy</h3><p>Coins stay in the game. Exchange with other players. No real money involved.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg><div><h3>Emotes In-Game</h3><p>Express yourself with emotes during matches. Celebrate a good move or tease your opponent.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><div><h3>Play with Bots</h3><p>No one online? Practice against bots at different difficulty levels.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><div><h3>Made for Community</h3><p>Built by a player, for players. No corporate agenda. Just checkers.</p></div></div>
  </div>
</section>

<!-- ===== HOW TO PLAY ===== -->
<section class="section" id="how-to-play">
  <h2 class="section-title">How to Play Checkers</h2>
  <p class="section-sub">Learn the basics in 2 minutes — or jump right in</p>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-body"><h3>Set Up the Board</h3><p>Checkers is played on the dark squares of an 8×8 board. Each player starts with 12 pieces on the three rows closest to them. Red always moves first.</p></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-body"><h3>Move Diagonally</h3><p>Regular pieces move one square diagonally forward. When your piece reaches the opposite end, it becomes a <strong>king</strong> and can move in both directions.</p></div></div>
    <div class="step"><div class="step-num">3</div><div class="step-body"><h3>Jump to Capture</h3><p>Capture opponent pieces by jumping over them diagonally. If a jump is available, you <strong>must</strong> take it. Chain multiple jumps for combos.</p></div></div>
    <div class="step"><div class="step-num">4</div><div class="step-body"><h3>Win the Game</h3><p>Win by capturing all opponent pieces or blocking them so they can't move. Strategy, positioning, and patience are key.</p></div></div>
  </div>
</section>

<!-- ===== ABOUT ===== -->
<section class="section" id="about">
  <h2 class="section-title">About</h2>
  <blockquote class="about-quote">
    My name is Chris. I made this world for us, in which all we are equal and differ only in skill. Free for all, free forever. Let skill divide us, let the best win!
  </blockquote>
  <div class="prose">
    <p>To give you a more accurate backstory — I lost 11 to 1 to my inebriated roommate, which left me feeling inferior or grounded in the fact that I'm not that good. I decided to practice in secret, so in search of a mobile app that I could play daily on my phone, I found none that didn't try to empty my wallet.</p>
    <p>So being completely honest, this app I created in pure spite of those f*ckers. No hard feelings, it's business to them and I get it.</p>
    <p>Since I am a software developer and checkers are so simple I decided to make one, and because I chose web technology I decided to host it online — because why not share it? It also makes sense because I figured I'd like to play against my now sober roommate at some time, right?</p>
    <p>As all puzzle pieces welded together I realized that this is such a low bandwidth game that I can just host it myself for a couple bucks. In rough math I'd be paying a fraction of what those greedy long-fingered twats would have tried to suck from me.</p>
    <p>So here I am paying $10 for a domain and $5 a month and anyone can play here for free. I don't really expect anyone to join, but if anyone does — I'll be ecstatic, this means one less victim. And since this is my hobby not a main project or anything, I will maintain it to the best of my ability.</p>
  </div>
</section>

<style>
  .hero {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100dvh; padding: var(--sp-lg) var(--sp-md); gap: var(--sp-lg);
  }
  .hero-logo { font-size: var(--fs-title); letter-spacing: 2px; color: var(--text); text-align: center; }

  .shimmer { color: var(--accent); background: linear-gradient(120deg, var(--accent) 0%, #ff8a8a 40%, #fff 50%, #ff8a8a 60%, var(--accent) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 2.5s ease-in-out forwards; }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

  .board { display: grid; grid-template-columns: repeat(8, 1fr); aspect-ratio: 1; width: min(300px, 50dvh, 80vw); flex-shrink: 1; min-height: 0; border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
  .cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
  .cell.light { background: var(--board-light); }
  .cell.dark { background: var(--board-dark); }
  .piece { width: 65%; height: 65%; border-radius: 50%; }
  .piece-red { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .piece-black { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }

  .play-btn { display: inline-block; padding: var(--sp-md) var(--sp-xl); font-size: 1.2rem; font-weight: 700; font-family: var(--font); background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; border-radius: var(--radius-sm); text-decoration: none; box-shadow: 0 4px 16px rgba(239,68,68,0.25); transition: transform 0.2s, box-shadow 0.2s; }
  .play-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(239,68,68,0.35); }
  .hero-note { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; }

  .section { padding: 64px var(--sp-md); max-width: 800px; margin: 0 auto; }
  .section-title { font-size: var(--fs-title); font-weight: 700; text-align: center; margin-bottom: var(--sp-sm); }
  .section-sub { text-align: center; color: var(--text-dim); font-size: var(--fs-body); margin-bottom: var(--sp-xl); }

  .prose { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-lg); }
  .prose p { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.8; }

  .about-quote { max-width: 640px; margin: 0 auto var(--sp-xl); padding: var(--sp-lg) var(--sp-xl); border-left: 3px solid var(--accent); font-size: var(--fs-heading); font-weight: 600; font-style: italic; line-height: 1.6; color: var(--text); }

  .features-list { display: flex; flex-direction: column; gap: var(--sp-lg); max-width: 640px; margin: 0 auto; }
  .feature-item { display: flex; align-items: flex-start; gap: var(--sp-md); }
  .feature-item :global(svg) { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .feature-item h3 { font-size: var(--fs-body); font-weight: 600; margin-bottom: 2px; }
  .feature-item p { color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.5; }

  .steps { display: flex; flex-direction: column; gap: var(--sp-lg); max-width: 600px; margin: 0 auto; }
  .step { display: flex; gap: var(--sp-md); align-items: flex-start; }
  .step-num { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }
  .step-body h3 { font-size: var(--fs-heading); font-weight: 600; margin-bottom: var(--sp-xs); }
  .step-body p { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.6; }

  @media (min-width: 600px) { .board { width: min(360px, 50dvh, 80vw); } }
  @media (min-width: 900px) { .board { width: min(400px, 50dvh, 80vw); } }
</style>
