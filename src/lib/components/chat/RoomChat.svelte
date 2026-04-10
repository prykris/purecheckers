<script>
  import { onMount } from 'svelte';
  import { getSocket } from '$lib/socket.js';
  import { markChannelRead, getActiveChannelId } from '$lib/socketService.js';
  import { roomChatMessages, roomUnreadChat } from '$lib/stores/app.js';
  import { user } from '$lib/stores/user.js';
  import ChatPanel from './ChatPanel.svelte';

  export let channelId = null;
  export let closeable = false;
  export let readOnly = false;

  onMount(() => { markChannelRead(); });

  function onSend(e) {
    const { content } = e.detail;
    const socket = getSocket();
    const ch = channelId || getActiveChannelId();
    if (!socket || !ch) return;

    // Optimistic local add
    roomChatMessages.update(msgs => [...msgs, {
      id: null,
      channelId: ch,
      senderId: $user?.id,
      username: $user?.username || 'You',
      content,
      createdAt: new Date().toISOString()
    }]);

    socket.emit('chat:send', { channelId: ch, content });
  }

  function onLoadOlder(e) {
    const { beforeId } = e.detail;
    const socket = getSocket();
    const ch = channelId || getActiveChannelId();
    if (!socket || !ch) return;
    socket.emit('chat:history', { channelId: ch, beforeId });
  }
</script>

<ChatPanel
  messages={$roomChatMessages}
  currentUserId={$user?.id}
  {readOnly}
  {closeable}
  on:send={onSend}
  on:load-older={onLoadOlder}
  on:close
/>
