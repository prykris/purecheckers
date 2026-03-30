<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { getSocket } from '../../lib/socket.js';

  export let roomId = null;
  export let gameId = null;
  export let closeable = false;

  const dispatch = createEventDispatcher();

  let messages = [];
  let input = '';
  let messagesEl;
  let socket;
  let lastSendTime = 0;

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    socket.on('chat:room-message', onRoomMsg);
    socket.on('chat:game-message', onGameMsg);
  });

  onDestroy(() => {
    if (socket) {
      socket.off('chat:room-message', onRoomMsg);
      socket.off('chat:game-message', onGameMsg);
    }
  });

  function onRoomMsg(msg) { messages = [...messages, msg]; scrollDown(); }
  function onGameMsg(msg) { messages = [...messages, msg]; scrollDown(); }

  function scrollDown() {
    requestAnimationFrame(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function send() {
    if (!input.trim() || !socket) return;
    // Client-side rate limit: 1 msg per second
    const now = Date.now();
    if (now - lastSendTime < 1000) return;
    lastSendTime = now;

    const content = input.trim().slice(0, 200);
    input = '';
    if (gameId) {
      socket.emit('chat:game-message', { gameId, content });
    } else if (roomId) {
      socket.emit('chat:room-message', { roomId, content });
    }
  }
</script>

<div class="room-chat">
  {#if closeable}
    <div class="chat-header">
      <span class="chat-title">Chat</span>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  {/if}
  <div class="msgs" bind:this={messagesEl}>
    {#if messages.length === 0}
      <p class="empty">No messages yet</p>
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
    <input class="input" type="text" bind:value={input} placeholder="Message..."
      maxlength="200" on:keydown={(e) => e.key === 'Enter' && send()} />
    <button class="btn btn-primary btn-small send-btn" on:click={send}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>

<style>
  .room-chat { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; }

  .chat-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--sp-xs) var(--sp-sm);
    border-bottom: 1px solid var(--surface2); flex-shrink: 0;
  }
  .chat-title { font-size: var(--fs-caption); font-weight: 600; color: var(--text-dim); }
  .close-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 2px; }
  .close-btn:hover { color: var(--text); }

  .msgs {
    flex: 1; overflow-y: auto; padding: var(--sp-sm);
    display: flex; flex-direction: column; gap: 2px;
    min-height: 0; width: 100%;
  }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-md); }
  .msg {
    font-size: var(--fs-caption); line-height: 1.4;
    word-break: break-word; overflow-wrap: break-word;
    width: 100%;
  }
  .msg strong { color: var(--accent); margin-right: var(--sp-xs); font-weight: 600; font-size: 0.65rem; }
  .msg span { color: var(--text); }

  .input-row {
    display: flex; gap: var(--sp-xs); padding: var(--sp-xs) var(--sp-sm);
    border-top: 1px solid var(--surface2); flex-shrink: 0; width: 100%;
  }
  .input-row .input { font-size: var(--fs-caption); padding: var(--sp-xs) var(--sp-sm); flex: 1; min-width: 0; }
  .send-btn { padding: var(--sp-xs) var(--sp-sm); flex-shrink: 0; }
</style>
