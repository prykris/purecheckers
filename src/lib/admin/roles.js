// Batch visible identity lookups; never use this presentation cache for authorization.
const cache = new Map(), queued = new Map();
let timer;
export function administratorRole(username) {
  if (!username) return Promise.resolve(false);
  const prior = cache.get(username);
  if (prior && prior.until > Date.now()) return Promise.resolve(prior.value);
  return new Promise(resolve => {
    const listeners = queued.get(username) || []; listeners.push(resolve); queued.set(username, listeners);
    if (!timer) timer = setTimeout(flush, 0);
  });
}
async function flush() {
  timer = null;
  const batch = [...queued.entries()].slice(0, 50); for (const [name] of batch) queued.delete(name);
  if (queued.size) timer = setTimeout(flush, 0);
  try {
    const response = await fetch('/api/leaderboard/roles?' + new URLSearchParams({ names: batch.map(([n]) => n).join('|') }), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Role lookup failed');
    const { administrators } = await response.json();
    for (const [name, listeners] of batch) { const value = administrators.includes(name); cache.set(name, { value, until: Date.now() + 60000 }); listeners.forEach(resolve => resolve(value)); }
    if (cache.size > 1000) { for (const [name, item] of cache) if (item.until < Date.now()) cache.delete(name); }
  } catch { for (const [, listeners] of batch) listeners.forEach(resolve => resolve(false)); }
}
