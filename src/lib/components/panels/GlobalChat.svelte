<script>
  import { globalChat } from '$lib/chat/runtime.js';
  import { user } from '$lib/stores/user.js';
  import ChatPanel from '../chat/ChatPanel.svelte';
  let { visible = false } = $props();
</script>

{#key $globalChat.client}
  <ChatPanel client={$globalChat.client} state={$globalChat.state} currentUserId={$user?.id} {visible}
    emptyText="Quiet in here. Say hi. Players see this between games." />
{/key}
