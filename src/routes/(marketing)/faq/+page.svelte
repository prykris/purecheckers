<script>
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { PUZZLE_SOLVE_COINS } from '../../../../shared/constants.js';
  import { FEEDBACK_URL } from '../../../../shared/feedback.js';

  let openIndex = $state(0);

  function toggle(i) {
    openIndex = openIndex === i ? -1 : i;
  }

  const faqs = [
    {
      q: "Is Pure Checkers really free?",
      a: "Yes. You can play free games against bots or other players without paying. Rooms with a coin buy-in are optional, and the room shows that cost before you join."
    },
    {
      q: "Do I need an account to play?",
      a: "No. Pick a nickname to enter as a guest and play free games. Upgrade your guest account before it expires to keep your identity and recorded games. Ranked games and rooms with a coin buy-in require a registered account."
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
      a: `Coins come from eligible games and rewards. Registered players earn ${PUZZLE_SOLVE_COINS} ${PUZZLE_SOLVE_COINS === 1 ? 'coin' : 'coins'} for their first eligible solve of today's daily puzzle; archive puzzles do not award coins. Use coins for available shop items or a room's buy-in. The shop and room show the cost before you confirm.`
    },
    {
      q: "Can I play on my phone?",
      a: "Yes. Pure Checkers is designed mobile-first with touch controls, drag and drop, and responsive layouts. Works on any modern browser — no app download needed."
    },
    {
      q: "What are the rules?",
      a: "Checkers on an 8×8 board, 12 pieces each, red moves first. Regular pieces move one square diagonally forward but can capture in all four diagonal directions. Reach the far end to get crowned a king: kings move any distance along a diagonal and can capture from a distance. Captures are compulsory — if you have a jump you must take one, but you choose which — and a piece keeps jumping while more captures are available. A piece that is crowned mid-chain stops there. A game is drawn if the same position occurs three times or 50 half-moves (25 by each side) pass without a capture.",
      more: { href: "/strategy/checkers-rules", label: "Read the full rules" }
    },
    {
      q: "Can I play against bots?",
      a: "Yes. We have three bot difficulties — Easy, Medium, and Hard — each with their own AI depth and personality. Bot games are real server-side matches that get recorded in your history."
    },
    {
      q: "Can I play with friends?",
      a: "Yes. Choose Play with a friend for a free invitation, or create a room with your preferred settings. Share its link or let your friend scan the code. Free games allow guests; coin buy-ins require registered accounts and both players to ready up."
    },
    {
      q: "What happens if I disconnect during a game?",
      a: "The app reconnects and restores the server's current game state. Return before the displayed reconnect deadline to continue; an expired deadline can result in a forfeit. Recovery after a server restart may ask both players to confirm they are back. Refreshing is not required for normal reconnection."
    },
    {
      q: "Are profiles and shared replays public?",
      a: "You can hide your public profile in Profile settings. This hides the profile page and profile preview, but leaderboard names and names in saved game records remain public. Guest profiles are temporary: expired profile links stop working, and retired guests appear as Guest in replays. Social and messaging apps may keep an older preview after a name or privacy change."
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
</svelte:head>

<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://purecheckers.com/faq#faq",
  "url": "https://purecheckers.com/faq",
  "isPartOf": { "@id": "https://purecheckers.com/#website" },
  "mainEntity": faqs.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  }))
}} />

<section class="faq">
  <h1 class="page-title">Frequently Asked Questions</h1>
  <p class="page-sub">Everything you need to know about Pure Checkers</p>

  <div class="faq-list">
    {#each faqs as faq, i}
      <div class="faq-item" class:open={openIndex === i}>
        <h2 class="faq-h">
          <button class="faq-q" onclick={() => toggle(i)} aria-expanded={openIndex === i} aria-controls="faq-a-{i}">{faq.q}<span class="faq-icon" aria-hidden="true">{openIndex === i ? '−' : '+'}</span></button>
        </h2>
        <div class="faq-a" id="faq-a-{i}" hidden={openIndex !== i}>
          <p>{faq.a}</p>
          {#if faq.more}
            <p class="faq-more"><a href={faq.more.href}>{faq.more.label}</a></p>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <p class="faq-more">Found a problem? <a href={FEEDBACK_URL}>Report it on GitHub</a> (GitHub account required).
    Include what happened, your browser and a replay link if available. Reports are public; leave out passwords and other private information.</p>
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

  .faq-h { margin: 0; font-size: inherit; font-weight: inherit; }
  .faq-a {
    padding: 0 var(--sp-lg) var(--sp-md);
    font-size: var(--fs-body); color: var(--text-dim); line-height: 1.7;
  }
  .faq-a[hidden] { display: none; }
  .faq-more { margin-top: var(--sp-sm); }
  .faq-more a { color: var(--accent); font-weight: 600; text-decoration: none; }
  .faq-more a:hover { text-decoration: underline; }
</style>
