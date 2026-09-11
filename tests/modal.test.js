import { modal } from '../src/lib/modal.js';

function fixture() {
  const trigger = { isConnected: true, focus: vi.fn() }, fallback = { focus: vi.fn() }, initial = { focus: vi.fn() };
  const events = {}, document = { activeElement: trigger, otherOpen: false,
    querySelector(selector) { return selector === 'dialog[open]' ? this.otherOpen : fallback; } };
  const node = { ownerDocument: document, open: false,
    addEventListener(type, fn) { events[type] = fn; }, removeEventListener(type) { delete events[type]; },
    showModal: vi.fn(function () { this.open = true; }), close: vi.fn(function () { this.open = false; }),
    querySelector: () => initial, getBoundingClientRect: () => ({ top: 10, bottom: 90, left: 10, right: 90 }) };
  return { trigger, fallback, initial, node, events, document };
}
it('opens once, prevents default Escape, and restores focus on closure', () => {
  const f = fixture(), onclose = vi.fn(), preventDefault = vi.fn();
  const action = modal(f.node, { open: true, onclose }); action.update({ open: true, onclose });
  expect(f.node.showModal).toHaveBeenCalledOnce(); expect(f.initial.focus).toHaveBeenCalledOnce();
  f.events.cancel({ preventDefault }); expect(preventDefault).toHaveBeenCalledOnce(); expect(onclose).toHaveBeenCalledOnce();
  action.update({ open: false }); expect(f.trigger.focus).toHaveBeenCalledOnce();
  action.destroy(); expect(f.node.close).toHaveBeenCalledOnce(); expect(Object.keys(f.events)).toEqual([]);
});
it('does not dismiss while confirming, and only treats clicks outside its bounds as backdrop clicks', () => {
  const f = fixture(), onclose = vi.fn(); const action = modal(f.node, { busy: true, onclose });
  f.events.cancel({ preventDefault() {} }); f.events.click({ target: f.node, clientX: 0, clientY: 0 }); expect(onclose).not.toHaveBeenCalled();
  action.update({ onclose }); f.events.click({ target: f.node, clientX: 30, clientY: 30 }); expect(onclose).not.toHaveBeenCalled();
  f.events.click({ target: f.node, clientX: 0, clientY: 0 }); expect(onclose).toHaveBeenCalledOnce(); action.destroy();
});
it('restores a fallback after context removal without stealing focus from a newer modal', () => {
  const f = fixture(), action = modal(f.node); f.trigger.isConnected = false; action.destroy(); expect(f.fallback.focus).toHaveBeenCalledOnce();
  const next = fixture(), second = modal(next.node); next.document.otherOpen = true; second.destroy(); expect(next.trigger.focus).not.toHaveBeenCalled();
});
