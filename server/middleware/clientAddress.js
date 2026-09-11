import { isIP } from 'node:net';
import { CLIENT_IP_SOURCE } from '../config.js';

// A rate-limit identity, not a change to Express's host/protocol trust settings.
// Railway mode requires an origin reachable only through Railway's HTTP edge.
function normalizeAddress(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  const family = isIP(address);
  if (family === 4) return address;
  if (family !== 6 || address.includes('%')) return null;
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

export function createClientAddressResolver(source = 'socket') {
  if (!['socket', 'railway'].includes(source)) {
    throw new Error('CLIENT_IP_SOURCE must be socket or railway');
  }
  return req => {
    const direct = normalizeAddress(req.socket?.remoteAddress) || 'unknown';
    if (source === 'socket') return direct;
    // A list, duplicate header, port, missing or invalid value is not an identity.
    // Fall back to the connection peer, never to X-Forwarded-For or Forwarded.
    return normalizeAddress(req.headers?.['x-real-ip']) || direct;
  };
}

export const getClientAddress = createClientAddressResolver(CLIENT_IP_SOURCE);
