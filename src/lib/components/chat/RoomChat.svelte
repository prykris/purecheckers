<script>
  import { roomChat } from '$lib/chat/runtime.js';
  import { user } from '$lib/stores/user.js';
  import ChatPanel from './ChatPanel.svelte';
  // Runes key by client identity. Legacy object keys recreate the input on every draft update.
  let { channelId = null, closeable = false, readOnly = false, visible = true, variant = null } = $props();
</script>

{#key $roomChat.client}
  <ChatPanel client={$roomChat.client} state={$roomChat.state} currentUserId={$user?.id}
    visible={visible && (!channelId || channelId === $roomChat.client?.channelId)} {variant} {readOnly} {closeable} on:close />
{/key}
