<script>
  import { onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket.js';

  export let visible = false;

  let messages = [];
  let input = '';
  let messagesEl;
  let socket = null;
  let attached = false;
  let lastSendTime = 0;

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
    scrollDown();
  }

  function onHistory({ channelId, messages: msgs }) {
    if (channelId !== 'global') return;
    messages = msgs;
    scrollDown();
  }

  function scrollDown() {
    requestAnimationFrame(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function send() {
    if (!input.trim() || !socket) return;
    const now = Date.now();
    if (now - lastSendTime < 1000) return;
    lastSendTime = now;
    socket.emit('chat:send', { channelId: 'global', content: input.trim().slice(0, 300) });
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
    <button class="btn btn-primary btn-small" on:click={send} aria-label="Send">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>

<style>
  .chat-content { display: flex; flex-direction: column; height: 100%; }
  .messages { flex: 1; overflow-y: auto; padding: var(--sp-sm) var(--sp-md); display: flex; flex-direction: column; gap: var(--sp-xs); }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-lg); }
  .msg { font-size: var(--fs-caption); line-height: 1.4; word-break: break-word; }
  .msg strong { color: var(--accent); margin-right: var(--sp-xs); font-weight: 600; }
  .msg span { color: var(--text); }
  .input-row { display: flex; gap: var(--sp-xs); padding: var(--sp-sm) var(--sp-md); border-top: 1px solid var(--surface2); flex-shrink: 0; }
</style>
