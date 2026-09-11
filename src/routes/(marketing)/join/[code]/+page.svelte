<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  let { data } = $props();
  const host = $derived(data.invite?.hostName || 'A friend');
  const title = $derived(data.invite ? `${host} wants to play you at checkers` : 'This invitation is no longer open');
  const description = $derived(!data.invite ? 'Ask your friend for a new invitation, or start your own free game.' :
    data.invite.buyIn > 0 ? `Join ${host}'s game. Buy-in: ${data.invite.buyIn} coins. A registered account is required.` :
    `Join ${host}'s game. Free, no account needed. ${data.invite.turnTimer ? `${data.invite.turnTimer}-second turns.` : 'No clock.'}`);
  // Only human browsers enter the app; crawlers receive the complete preview above.
  onMount(() => {
    if (data.invite) goto(`/invite/${data.code}`, { replaceState: true }).catch(() => {});
  });
</script>

<svelte:head>
  <title>{title} — Pure Checkers</title>
  <meta name="robots" content="noindex" />
  <meta name="description" content={description} />
  <link rel="canonical" href={`https://purecheckers.com/join/${data.code}`} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={`https://purecheckers.com/join/${data.code}`} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<section class="invitation">
  <h1>{title}</h1>
  <p>{description}</p>
  {#if data.invite}
    <a class="btn btn-primary" href={`/invite/${data.code}`}>{data.invite.status === 'playing' ? 'Watch game' : 'Open game'}</a>
  {:else}
    <GameEntryLink class="btn btn-primary"  label="Start your own game" />
  {/if}
</section>

<style>
  .invitation { max-width: 640px; margin: 0 auto; padding: var(--sp-xl) var(--sp-md); display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-lg); }
  h1 { font-size: var(--fs-title); }
  p { color: var(--text-dim); }
</style>
