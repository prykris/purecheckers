<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getSocket } from '$lib/socket.js';

  onMount(() => {
    const code = page.params.code?.toUpperCase();
    if (code) {
      const sock = getSocket();
      if (sock) {
        sock.emit('room:join', { roomId: null, code });
      }
    }
    goto('/lobby');
  });
</script>

<p>Joining...</p>
