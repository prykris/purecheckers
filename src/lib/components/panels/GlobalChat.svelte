<script>
  import { onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket.js';
  import { user } from '$lib/stores/user.js';
  import ChatPanel from '../chat/ChatPanel.svelte';

  export let visible = false;

  let messages = [];
  let socket = null;
  let attached = false;

  $: if (visible && !attached) attach();

  function attach() {
    socket = getSocket();
    if (!socket) return;
    if (attached) return;
    attached = true;
    socket.on('chat:message', onMsg);
    socket.on('chat:history', onHistory);
    socket.emit('chat:history', { channelId: 'global' });
  }

  onDestroy(() => {
    if (socket) {
      socket.off('chat:message', onMsg);
      socket.off('chat:history', onHistory);
    }
  });

  function onMsg(msg) {
    if (msg.channelId !== 'global') return;
    messages = [...messages, msg];
  }

  function onHistory({ channelId, messages: msgs, prepend }) {
    if (channelId !== 'global') return;
    if (prepend) {
      messages = [...msgs, ...messages];
      return;
    }
    messages = msgs;
  }

  function onSend(e) {
    if (!socket) return;
    socket.emit('chat:send', { channelId: 'global', content: e.detail.content });
  }

  function onLoadOlder(e) {
    if (!socket) return;
    socket.emit('chat:history', { channelId: 'global', beforeId: e.detail.beforeId });
  }
</script>

<ChatPanel
  {messages}
  currentUserId={$user?.id}
  on:send={onSend}
  on:load-older={onLoadOlder}
/>
