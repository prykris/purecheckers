<script>
  import PlayerLink from '../PlayerLink.svelte';
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { mentionSegments } from '../../../../shared/chat.js';
  import { emptyChat } from '$lib/chat/client.js';

  export let client = null;
  export let state = emptyChat();
  export let currentUserId = null;
  export let visible = true;
  export let readOnly = false;
  export let closeable = false;
  export let emptyText = 'No messages yet';
  const dispatch = createEventDispatcher();
  let messagesEl, mounted = false, alive = true, frame = null;
  let userScrolledUp = false, restoring = false, previousLastId = null;
  $: messages = state.messages;
  $: if (mounted) client?.setVisible(visible);
  $: if (messages.at(-1)?.id !== previousLastId) {
    previousLastId = messages.at(-1)?.id;
    if (!restoring && !userScrolledUp) tick().then(scrollToBottom);
  }
  onMount(() => { mounted = true; scrollToBottom(); });
  onDestroy(() => { alive = false; if (frame) cancelAnimationFrame(frame); client?.setVisible(false); });
  function scrollToBottom() {
    if (!alive || !messagesEl) return;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!alive || !messagesEl) return;
      messagesEl.scrollTop = messagesEl.scrollHeight; userScrolledUp = false;
    });
  }
  function onScroll() {
    if (!messagesEl || restoring) return;
    userScrolledUp = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight > 40;
  }
  async function loadOlder() {
    if (!client || state.loading) return;
    const height = messagesEl?.scrollHeight || 0, top = messagesEl?.scrollTop || 0;
    restoring = true;
    await client.load(true); await tick();
    if (alive && messagesEl) messagesEl.scrollTop = top + messagesEl.scrollHeight - height;
    restoring = false;
  }
  async function send() {
    if (await client?.send()) { await tick(); scrollToBottom(); }
  }
</script>

<div class="chat-panel">
  {#if closeable}
    <div class="chat-header">
      <span class="chat-title">Chat</span>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close chat">✕</button>
    </div>
  {/if}
  <div class="msgs" bind:this={messagesEl} on:scroll={onScroll}>
    {#if state.hasMore}
      <button class="history-action" disabled={state.loading} on:click={loadOlder}>Load older messages</button>
    {/if}
    {#if state.loading}<p class="loading-older" role="status">Loading messages…</p>{/if}
    {#if state.historyError}
      <div class="chat-feedback" role="status">{state.historyError}
        <button class="history-action" disabled={state.loading} on:click={() => client?.load()}>Retry history</button>
      </div>
    {:else if state.loaded && messages.length === 0}<p class="empty">{emptyText}</p>{/if}
    {#each messages as msg (msg.id)}
      {#if msg.system || msg.senderId === 0}
        <div class="msg system"><span>{msg.content}</span></div>
      {:else}
        <div class="msg" class:own={msg.senderId === currentUserId} class:spectator={msg.spectator}>
          <strong><PlayerLink username={msg.username} profileUrl={msg.profileUrl} /></strong>
          <span>{#each mentionSegments(msg.content) as segment}<span class:mention={segment.mention}>{#if segment.mention}@<PlayerLink username={segment.text.slice(1)} />{:else}{segment.text}{/if}</span>{/each}</span>
        </div>
      {/if}
    {/each}
  </div>
  {#if userScrolledUp}<button class="scroll-bottom" on:click={scrollToBottom} aria-label="Scroll to latest">↓</button>{/if}
  {#if !readOnly}
    {#if state.sendError}<p class="chat-feedback" role="status">{state.sendError}</p>
    {:else if !state.connected}<p class="chat-feedback" role="status">Chat is reconnecting…</p>{/if}
    <form class="input-row" on:submit|preventDefault={send}>
      <input class="input" type="text" value={state.draft} on:input={event => client?.setDraft(event.currentTarget.value)}
        readonly={state.delivery !== 'idle'} placeholder="Message…" aria-label="Chat message" maxlength="300" />
      <button class="btn btn-primary btn-small send-btn" type="submit"
        disabled={!client || !state.connected || state.delivery === 'sending' || !state.draft.trim()}>
        {state.delivery === 'sending' ? 'Sending…' : state.delivery === 'uncertain' ? 'Retry' : 'Send'}
      </button>
    </form>
  {/if}
</div>

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
  .msg .mention { color: var(--accent2); font-weight: 600; }

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
  .chat-feedback { font-size: var(--fs-caption); color: var(--text-dim); padding: var(--sp-xs) var(--sp-sm); margin: 0; }
  .history-action { align-self: center; background: none; color: var(--text-dim); border: 0; text-decoration: underline; cursor: pointer; font-size: var(--fs-caption); padding: var(--sp-xs); }
</style>
