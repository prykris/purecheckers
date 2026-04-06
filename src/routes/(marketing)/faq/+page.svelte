<script>
  let openIndex = $state(0);

  function toggle(i) {
    openIndex = openIndex === i ? -1 : i;
  }

  const faqs = [
    {
      q: "Is Pure Checkers really free?",
      a: "Yes, completely free. No ads, no energy bars, no in-app purchases, no paywalls. We believe checkers should be accessible to everyone."
    },
    {
      q: "Do I need an account to play?",
      a: "No. Click Play and you're in as a guest with a generated name. You can upgrade to a full account anytime to keep your stats, ELO rating, and game history."
    },
    {
      q: "What happens to my stats when I upgrade from guest?",
      a: "Everything carries over — your ELO, wins, losses, and game history stay with your account. You also get starter coins as a welcome bonus."
    },
    {
      q: "How does the ELO rating system work?",
      a: "ELO measures your skill relative to other players. Win against a higher-rated player and you gain more points. Lose to a lower-rated player and you lose more. New players start at 1000 ELO."
    },
    {
      q: "What are coins for?",
      a: "Coins are an in-game currency earned by winning ranked matches. Spend them in the shop on themes, piece skins, and emotes. Coins exist in a closed economy — they're created on registration and destroyed in the shop."
    },
    {
      q: "Can I play on my phone?",
      a: "Yes. Pure Checkers is designed mobile-first with touch controls, drag and drop, and responsive layouts. Works on any modern browser — no app download needed."
    },
    {
      q: "What are the rules?",
      a: "Standard checkers (English draughts) on an 8×8 board. Pieces move diagonally forward, capture by jumping, and must take jumps when available. Reach the opposite end to get kinged — kings move in both directions. Chain jumps are allowed."
    },
    {
      q: "Can I play against bots?",
      a: "Yes. We have three bot difficulties — Easy, Medium, and Hard — each with their own AI depth and personality. Bot games are real server-side matches that get recorded in your history."
    },
    {
      q: "Can I play with friends?",
      a: "Yes. Create a private room and share the room code or QR link. Your friend joins instantly — no account needed."
    },
    {
      q: "What happens if I disconnect during a game?",
      a: "You get 30 seconds to reconnect. If you make it back, the game continues where you left off. If not, your opponent wins by forfeit."
    }
  ];
</script>

<svelte:head>
  <title>FAQ — Pure Checkers</title>
  <meta name="description" content="Frequently asked questions about Pure Checkers. Learn about accounts, ELO ratings, coins, rules, and more." />
  <link rel="canonical" href="https://purecheckers.com/faq" />
  <meta property="og:title" content="FAQ — Pure Checkers" />
  <meta property="og:description" content="Frequently asked questions about Pure Checkers." />
  <meta property="og:url" content="https://purecheckers.com/faq" />
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a
      }
    }))
  })}
  </script>
</svelte:head>

<section class="faq">
  <h1 class="page-title">Frequently Asked Questions</h1>
  <p class="page-sub">Everything you need to know about Pure Checkers</p>

  <div class="faq-list">
    {#each faqs as faq, i}
      <div class="faq-item" class:open={openIndex === i}>
        <button class="faq-q" onclick={() => toggle(i)}>{faq.q}<span class="faq-icon">{openIndex === i ? '−' : '+'}</span></button>
        {#if openIndex === i}
          <p class="faq-a">{faq.a}</p>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .faq {
    max-width: 700px; margin: 0 auto;
    padding: 64px var(--sp-md) 120px;
  }
  .page-title { font-size: var(--fs-title); font-weight: 700; text-align: center; margin-bottom: var(--sp-xs); }
  .page-sub { text-align: center; color: var(--text-dim); font-size: var(--fs-body); margin-bottom: 48px; }

  .faq-list { display: flex; flex-direction: column; gap: var(--sp-sm); }

  .faq-item {
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md); overflow: hidden;
  }
  .faq-item.open { border-color: var(--accent); }

  .faq-q {
    width: 100%;
    padding: var(--sp-md) var(--sp-lg);
    font-size: var(--fs-body); font-weight: 600; color: var(--text);
    cursor: pointer; background: none; border: none; font-family: var(--font);
    display: flex; align-items: center; justify-content: space-between;
    text-align: left;
    transition: color 0.15s;
  }
  .faq-q:hover { color: var(--accent); }
  .faq-icon { font-size: 1.2rem; color: var(--text-dim); flex-shrink: 0; margin-left: var(--sp-md); }
  .faq-item.open .faq-icon { color: var(--accent); }

  .faq-a {
    padding: 0 var(--sp-lg) var(--sp-md);
    font-size: var(--fs-body); color: var(--text-dim); line-height: 1.7;
  }
</style>
