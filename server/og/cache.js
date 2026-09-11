export class ImageCache {
  constructor({ maxEntries = 200, maxBytes = 16 * 1024 * 1024, now = Date.now } = {}) {
    this.maxEntries = maxEntries; this.maxBytes = maxBytes; this.now = now; this.entries = new Map(); this.bytes = 0;
  }
  delete(key) { const old = this.entries.get(key); if (old) { this.bytes -= old.png.length; this.entries.delete(key); } }
  get(key) {
    const row = this.entries.get(key);
    if (!row) return null;
    if (row.expires <= this.now()) { this.delete(key); return null; }
    this.entries.delete(key); this.entries.set(key, row); return row;
  }
  hasRequest(requestKey) {
    return [...this.entries.entries()].some(([key, row]) => row.requestKey === requestKey && !!this.get(key));
  }
  set(key, row) {
    this.delete(key);
    if (row.png.length > this.maxBytes) return;
    this.entries.set(key, row); this.bytes += row.png.length;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) this.delete(this.entries.keys().next().value);
  }
}
