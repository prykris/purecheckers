<script>
  import { createEventDispatcher } from 'svelte';
  import { onMount, tick } from 'svelte';

  export let messages = [];
  export let currentUserId = null;
  export let readOnly = false;
  export let closeable = false;

  const dispatch = createEventDispatcher();

  let input = '';
  let messagesEl;
  let lastSendTime = 0;
  let userScrolledUp = false;
  let loadingOlder = false;
  let allOlderLoaded = false;
  let prevMsgCount = 0;

  onMount(() => {
    scrollToBottom();
  });

  // Reactive: when messages change, auto-scroll if user is at bottom
  $: if (messages.length > prevMsgCount) {
    const newestMsg = messages[messages.length - 1];
    const isOwnMsg = newestMsg?.senderId === currentUserId;
    if (isOwnMsg || !userScrolledUp) {
      tick().then(() => scrollToBottom());
    }
    prevMsgCount = messages.length;
  }

  function scrollToBottom() {
    if (messagesEl) {
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        userScrolledUp = false;
      });
    }
  }

  function onScroll() {
    if (!messagesEl) return;
    const distFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    userScrolledUp = distFromBottom > 40;

    // Infinite scroll: load older when near top
    if (messagesEl.scrollTop < 30 && !loadingOlder && !allOlderLoaded && messages.length > 0) {
      loadOlder();
    }
  }

  function loadOlder() {
    const oldest = messages[0];
    if (!oldest?.id) return;
    loadingOlder = true;

    const prevCount = messages.length;
    const prevScrollH = messagesEl.scrollHeight;

    dispatch('load-older', { beforeId: oldest.id });

    // Wait for prepended messages to render, then restore scroll position
    const check = () => {
      if (messages.length > prevCount) {
        tick().then(() => {
          if (messagesEl) {
            const newScrollH = messagesEl.scrollHeight;
            messagesEl.scrollTop = newScrollH - prevScrollH;
          }
          loadingOlder = false;
          if (messages.length - prevCount < 50) allOlderLoaded = true;
        });
      } else {
        // If nothing loaded after a delay, mark done
        setTimeout(() => {
          loadingOlder = false;
          if (messages.length === prevCount) allOlderLoaded = true;
        }, 1000);
      }
    };
    // Check after a frame to let the store update propagate
    setTimeout(check, 300);
  }

  function send() {
    if (!input.trim()) return;
    const now = Date.now();
    if (now - lastSendTime < 1000) return;
    lastSendTime = now;
    const content = input.trim().slice(0, 300);
    input = '';
    dispatch('send', { content });
    // Always scroll to bottom on own send
    requestAnimationFrame(() => scrollToBottom());
  }
</script>

<div class="chat-panel">
  {#if closeable}
    <div class="chat-header">
      <span class="chat-title">Chat</span>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  {/if}
  <div class="msgs" bind:this={messagesEl} on:scroll={onScroll}>
    {#if loadingOlder}
      <div class="loading-older">Loading...</div>
    {/if}
    {#if messages.length === 0}
      <p class="empty">No messages yet</p>
    {:else}
      {#each messages as msg}
        {#if msg.system || msg.senderId === 0}
          <div class="msg system">
            <span>{msg.content}</span>
          </div>
        {:else}
          <div class="msg" class:own={msg.senderId === currentUserId} class:spectator={msg.spectator}>
            <strong>{msg.username}</strong>
            <span>{@html highlightMentions(msg.content)}</span>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
  {#if userScrolledUp}
    <button class="scroll-bottom" on:click={scrollToBottom} aria-label="Scroll to latest">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  {/if}
  {#if !readOnly}
  <div class="input-row">
    <input class="input" type="text" bind:value={input} placeholder="Message..."
      maxlength="300" on:keydown={(e) => e.key === 'Enter' && send()} />
    <button class="btn btn-primary btn-small send-btn" on:click={send} aria-label="Send">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
  {/if}
</div>

<script context="module">
  function highlightMentions(content) {
    if (!content) return '';
    return content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  }
</script>

<style>
  .chat-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; position: relative; }
  .chat-header { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-xs) var(--sp-sm); border-bottom: 1px solid var(--surface2); flex-shrink: 0; }
  .chat-title { font-size: var(--fs-caption); font-weight: 600; color: var(--text-dim); }
  .close-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 2px; }
  .close-btn:hover { color: var(--text); }

  .msgs {
    flex: 1; overflow-y: auto; padding: var(--sp-sm);
    display: flex; flex-direction: column; gap: 2px;
    min-height: 0; width: 100%;
    scrollbar-width: thin;
    scrollbar-color: var(--surface2) transparent;
  }
  .msgs::-webkit-scrollbar { width: 4px; }
  .msgs::-webkit-scrollbar-track { background: transparent; }
  .msgs::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }
  .msgs::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }

  .loading-older {
    text-align: center; font-size: var(--fs-caption); color: var(--text-dim);
    padding: var(--sp-xs); flex-shrink: 0;
  }

  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-md); }
  .msg { font-size: var(--fs-caption); line-height: 1.4; word-break: break-word; overflow-wrap: break-word; width: 100%; }
  .msg.system { color: var(--text-dim); font-style: italic; }
  .msg.own strong { color: var(--success); }
  .msg:not(.own):not(.system):not(.spectator) strong { color: var(--accent); }
  .msg.spectator strong { color: var(--text-dim); }
  .msg strong { margin-right: var(--sp-xs); font-weight: 600; font-size: 0.65rem; }
  .msg span { color: var(--text); }
  .msg :global(.mention) { color: var(--accent2); font-weight: 600; }

  .scroll-bottom {
    position: absolute; bottom: 44px; right: var(--sp-sm);
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--surface); border: 1px solid var(--surface2);
    color: var(--text-dim); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    z-index: 2;
    transition: background 0.15s;
  }
  .scroll-bottom:hover { background: var(--surface2); color: var(--text); }

  .input-row { display: flex; gap: var(--sp-xs); padding: var(--sp-xs) var(--sp-sm); border-top: 1px solid var(--surface2); flex-shrink: 0; width: 100%; }
  .input-row .input { font-size: var(--fs-caption); padding: var(--sp-xs) var(--sp-sm); flex: 1; min-width: 0; }
  .send-btn { padding: var(--sp-xs) var(--sp-sm); flex-shrink: 0; }
</style>
