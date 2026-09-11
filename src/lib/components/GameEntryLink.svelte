<script>
  import { user } from '$lib/stores/user.js';
  import { session } from '$lib/stores/session.js';
  import { locale } from '$lib/stores/locale.js';
  import { gameEntry } from '$lib/siteNavigation.js';
  let { label = null, language = null, class: className = '', onclick = undefined } = $props();
  const entry = $derived(gameEntry($user, $session, language || $locale));
</script>

<a href={entry.href} class={className} {onclick}>{$user ? entry.label : label || entry.label}</a>
