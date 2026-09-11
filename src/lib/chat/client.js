import { CHAT_EVENTS } from '../../../shared/chat.js';
import { CHAT_MAX_LENGTH } from '../../../shared/chat.js';

export const emptyChat = () => ({ messages: [], connected: false, loaded: false, loading: false, hasMore: false,
  historyError: null, draft: '', delivery: 'idle', sendError: null, unread: 0, mentions: 0 });

/** Delivery and reads have separate lifecycles; neither can change game membership. */
export class ChatClient {
  constructor({ channelId, userId, publish = () => {}, storage, uuid = () => crypto.randomUUID(), timeoutMs = 8000 }) {
    Object.assign(this, { channelId, userId, publish, storage, uuid, timeoutMs });
    this.state = emptyChat(); this.generation = 0; this.pending = null; this.socket = null;
    this.visible = false; this.lastSeen = 0; this.timers = new Set();
    this.storageKey = `chat_seen_${userId}_${channelId}`;
    try { this.lastSeen = Number(storage?.getItem(this.storageKey)) || 0; } catch {}
  }
  update(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  bind(socket) {
    this.unbind(); this.socket = socket;
    const receive = message => this.receive(message);
    const disconnect = () => {
      this.cancelRequests();
      this.update({ connected: false, loading: false,
        ...(this.pending ? { delivery: 'uncertain', sendError: 'Delivery is unconfirmed. Reconnect and retry this message.' } : {}) });
    };
    socket.on(CHAT_EVENTS.message, receive); socket.on('disconnect', disconnect);
    this.detach = () => { socket.off(CHAT_EVENTS.message, receive); socket.off('disconnect', disconnect); };
    this.update({ connected: !!socket.connected });
  }
  cancelRequests() {
    this.generation++;
    for (const entry of [...this.timers]) { clearTimeout(entry.timer); entry.resolve(null); }
    this.timers.clear();
  }
  unbind() { this.detach?.(); this.detach = null; this.cancelRequests(); this.socket = null; }
  dispose() { this.unbind(); this.publish = () => {}; }
  request(event, payload) {
    if (!this.socket?.connected) return Promise.resolve(null);
    return new Promise(resolve => {
      const entry = { resolve, timer: null };
      const finish = value => { clearTimeout(entry.timer); this.timers.delete(entry); resolve(value); };
      entry.timer = setTimeout(() => finish(null), this.timeoutMs); this.timers.add(entry);
      this.socket.emit(event, { channelId: this.channelId, ...payload }, finish);
    });
  }
  merge(messages) {
    const byId = new Map(this.state.messages.map(message => [message.id, message]));
    for (const message of messages) if (message.channelId === this.channelId && Number.isSafeInteger(message.id)) byId.set(message.id, message);
    const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
    this.update({ messages: sorted });
    if (this.visible) this.markRead();
    else if (this.lastSeen > 0) {
      const unread = sorted.filter(m => m.id > this.lastSeen && m.senderId !== this.userId);
      this.update({ unread: unread.length, mentions: unread.filter(m => m.mentions?.includes(this.userId)).length });
    }
    if (this.pending && sorted.some(m => m.senderId === this.userId && m.clientMessageId === this.pending.clientMessageId)) {
      this.pending = null; this.update({ delivery: 'idle', draft: '', sendError: null });
    }
  }
  receive(message) {
    if (message?.channelId !== this.channelId || !Number.isSafeInteger(message.id)) return;
    const fresh = !this.state.messages.some(m => m.id === message.id);
    this.merge([message]);
    if (fresh && !this.visible && !this.lastSeen && message.senderId !== this.userId)
      this.update({ unread: this.state.unread + 1, mentions: this.state.mentions + (message.mentions?.includes(this.userId) ? 1 : 0) });
  }
  async recover() {
    this.cancelRequests();
    this.update({ connected: !!this.socket?.connected, loading: false,
      ...(this.pending ? { delivery: 'uncertain' } : {}) });
    await this.load();
  }
  async load(older = false) {
    if (this.state.loading || (older && !this.state.hasMore)) return false;
    const generation = this.generation;
    const beforeId = older ? this.state.messages[0]?.id : undefined;
    const newestKnown = this.state.messages.at(-1)?.id;
    this.update({ loading: true, historyError: null });
    const response = await this.request(CHAT_EVENTS.history, beforeId ? { beforeId } : {});
    if (generation !== this.generation) return false;
    if (!response?.ok) {
      this.update({ loading: false, historyError: response?.error || 'Could not load chat. Reconnect or retry.' }); return false;
    }
    const oldest = response.messages[0]?.id;
    // A long absence can exceed one history page. Start a contiguous recent window;
    // older pages remain explicitly available, rather than hiding a gap in the middle.
    const gap = !older && response.hasMore && newestKnown && oldest > newestKnown;
    if (gap) this.update({ messages: this.state.messages.filter(m => m.id >= oldest) });
    const extendsHistory = older || !this.state.loaded || gap || !this.state.messages.length;
    this.merge(response.messages);
    this.update({ loaded: true, loading: false, hasMore: extendsHistory ? response.hasMore : this.state.hasMore, historyError: null });
    return true;
  }
  setDraft(draft) { if (!this.pending) this.update({ draft: draft.slice(0, CHAT_MAX_LENGTH), sendError: null }); }
  async send() {
    if (this.state.delivery === 'sending' || !this.state.draft.trim()) return false;
    if (!this.socket?.connected) { this.update({ sendError: 'Chat is offline. Your message has been kept.' }); return false; }
    if (!this.pending) this.pending = { clientMessageId: this.uuid(), content: this.state.draft.trim() };
    const pending = this.pending, generation = this.generation;
    this.update({ delivery: 'sending', sendError: null });
    const response = await this.request(CHAT_EVENTS.send, pending);
    if (generation !== this.generation || this.pending !== pending) return !this.pending;
    if (response?.ok) { this.merge([response.message]); return true; }
    if (!response || response.code === 'unavailable') {
      this.update({ delivery: 'uncertain', sendError: response?.error || 'Delivery is unconfirmed. Retry this message safely.' });
    } else { this.pending = null; this.update({ delivery: 'idle', sendError: response.error || 'Message was not sent.' }); }
    return false;
  }
  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) this.markRead();
  }
  markRead() {
    const newest = Math.max(this.lastSeen, this.state.messages.at(-1)?.id || 0);
    if (newest !== this.lastSeen) {
      this.lastSeen = newest;
      try { this.storage?.setItem(this.storageKey, String(newest)); } catch {}
    }
    // Visibility is reported again when subscribers render a published state.
    // Reading an already-read channel must not publish another identical state.
    if (this.state.unread || this.state.mentions) this.update({ unread: 0, mentions: 0 });
  }
}
