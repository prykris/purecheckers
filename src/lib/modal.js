/** Native modal semantics: background inertness, Escape, focus containment/return. */
export function modal(node, options = {}) {
  let current = options, trigger = null;
  function close() {
    if (!node.open) return;
    node.close();
    if (!node.ownerDocument.querySelector('dialog[open]')) {
      const target = trigger?.isConnected ? trigger : node.ownerDocument.querySelector('[data-focus-fallback]');
      target?.focus({ preventScroll: true });
    }
  }
  function apply() {
    if (current.open === false) { close(); return; }
    if (!node.open) {
      trigger = node.ownerDocument.activeElement;
      node.showModal(); node.querySelector('[data-initial-focus]')?.focus();
    }
  }
  function cancel(event) { event.preventDefault(); if (!current.busy) current.onclose?.(); }
  function backdrop(event) {
    if (event.target !== node || current.busy) return;
    const rect = node.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) current.onclose?.();
  }
  node.addEventListener('cancel', cancel); node.addEventListener('click', backdrop); apply();
  return { update(next) { current = next; apply(); }, destroy() {
    close(); node.removeEventListener('cancel', cancel); node.removeEventListener('click', backdrop);
  } };
}
