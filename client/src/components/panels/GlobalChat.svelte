<script>
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '../../lib/socket.js';

  let messages = [];
  let input = '';
  let messagesEl;
  let socket;

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    socket.on('chat:global', onMessage);
    socket.emit('chat:global-history');
    socket.on('chat:global-history', onHistory);
  });

  onDestroy(() => {
    if (socket) {
      socket.off('chat:global', onMessage);
      socket.off('chat:global-history', onHistory);
    }
  });

  function onMessage(msg) {
    messages = [...messages, msg];
    scrollDown();
  }

  function onHistory({ messages: msgs }) {
    messages = msgs.map(m => ({
      senderId: m.sender.id,
      username: m.sender.username,
      content: m.content,
      timestamp: new Date(m.createdAt).getTime()
    }));
    scrollDown();
  }

  function scrollDown() {
    requestAnimationFrame(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function send() {
    if (!input.trim()) return;
    socket?.emit('chat:global', { content: input.trim() });
    input = '';
  }
</script>

<div class="chat-content">
  <div class="messages" bind:this={messagesEl}>
    {#if messages.length === 0}
      <p class="empty">No messages yet. Say hi!</p>
    {:else}
      {#each messages as msg}
        <div class="msg">
          <strong>{msg.username}</strong>
          <span>{msg.content}</span>
        </div>
      {/each}
    {/if}
  </div>
  <div class="input-row">
    <input class="input" type="text" bind:value={input} placeholder="Type a message..."
      maxlength="300" on:keydown={(e) => e.key === 'Enter' && send()} />
    <button class="btn btn-primary btn-small" on:click={send}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>

<style>
  .chat-content { display: flex; flex-direction: column; height: 100%; }
  .messages { flex: 1; overflow-y: auto; padding: var(--sp-sm) var(--sp-md); display: flex; flex-direction: column; gap: var(--sp-xs); }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-lg); }
  .msg { font-size: var(--fs-caption); line-height: 1.4; }
  .msg strong { color: var(--accent); margin-right: var(--sp-xs); font-weight: 600; }
  .msg span { color: var(--text); }

  .input-row {
    display: flex; gap: var(--sp-xs); padding: var(--sp-sm) var(--sp-md);
    border-top: 1px solid var(--surface2); flex-shrink: 0;
  }
</style>
