<script>
  import AdminBadge from './AdminBadge.svelte';
  import { getContext } from 'svelte';
  import { PROFILE_VIEWER, profileHref } from '$lib/profileLinks.js';
  let { username, profileUrl = undefined, profilePublic = true, isAdmin = undefined } = $props();
  const openProfile = getContext(PROFILE_VIEWER);
  const href = $derived(profileHref(username, profileUrl, profilePublic));
  function activate(event) {
    if (!openProfile || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openProfile(decodeURIComponent(href.slice('/player/'.length)));
  }
</script>

{#if href}
  <a {href} onclick={activate} aria-haspopup={openProfile ? 'dialog' : undefined}>{username} <AdminBadge {username} {isAdmin}/></a>
{:else}
  <span>{username || 'Unknown'} <AdminBadge {username} {isAdmin}/></span>
{/if}

<style>
  a { color: inherit; font: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 3px; border-radius: 2px; }
  a:hover { text-decoration-color: currentColor; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
