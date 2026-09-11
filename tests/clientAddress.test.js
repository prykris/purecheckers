import express from 'express';
import request from 'supertest';
import { createClientAddressResolver } from '../server/middleware/clientAddress.js';
import { createRateLimiter } from '../server/middleware/rateLimit.js';

const directRequest = (headers = {}) => ({ socket: { remoteAddress: '::ffff:192.0.2.40' }, headers });

it('ignores every proxy header in direct mode, even if Express trust is changed elsewhere', () => {
  const req = directRequest({ 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '203.0.113.9', forwarded: 'for=203.0.113.10' });
  req.ip = '203.0.113.11';
  expect(createClientAddressResolver('socket')(req)).toBe('192.0.2.40');
  expect(() => createClientAddressResolver('true')).toThrow('CLIENT_IP_SOURCE');
});

it('uses only one valid Railway client address and canonicalizes equivalent IP spellings', () => {
  const resolve = createClientAddressResolver('railway');
  for (const value of ['192.0.2.8', '::ffff:192.0.2.8', '::FFFF:c000:0208']) {
    expect(resolve(directRequest({ 'x-real-ip': value }))).toBe('192.0.2.8');
  }
  for (const value of ['2001:db8::1', '2001:0DB8:0000:0000:0000:0000:0000:0001']) {
    expect(resolve(directRequest({ 'x-real-ip': value }))).toBe('2001:db8::1');
  }
});

it('falls back to the connection peer for absent, duplicate and malformed Railway headers', () => {
  const resolve = createClientAddressResolver('railway');
  for (const value of [undefined, '', '203.0.113.7, 203.0.113.8', ['203.0.113.7', '203.0.113.8'], '203.0.113.7:123', '[2001:db8::1]:123', 'fe80::1%eth0', 'not-an-ip']) {
    expect(resolve(directRequest({ 'x-real-ip': value, 'x-forwarded-for': '203.0.113.9' }))).toBe('192.0.2.40');
  }
  expect(resolve({ headers: {} })).toBe('unknown');
});

it('gives distinct Railway clients separate buckets while forwarded-header changes cannot refresh one', async () => {
  const app = express();
  app.get('/', createRateLimiter({ limit: 1, windowMs: 60_000, keyOf: createClientAddressResolver('railway') }), (req, res) => res.sendStatus(204));
  await request(app).get('/').set('X-Real-IP', '192.0.2.1').set('X-Forwarded-For', '203.0.113.1').expect(204);
  await request(app).get('/').set('X-Real-IP', '::ffff:192.0.2.1').set('X-Forwarded-For', '203.0.113.2').expect(429);
  await request(app).get('/').set('X-Real-IP', '192.0.2.2').expect(204);
});

it('does not let a direct client evade limits by changing a Railway-looking header', async () => {
  const app = express();
  app.get('/', createRateLimiter({ limit: 1, windowMs: 60_000, keyOf: createClientAddressResolver('socket') }), (req, res) => res.sendStatus(204));
  await request(app).get('/').set('X-Real-IP', '192.0.2.1').expect(204);
  await request(app).get('/').set('X-Real-IP', '192.0.2.2').expect(429);
});

it('bounds rotating identities without evicting active limits, then reclaims idle capacity', async () => {
  let now = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxClients: 1, clock: () => now, keyOf: createClientAddressResolver('railway') });
  const app = express();
  app.get('/', limiter, (req, res) => res.sendStatus(204));
  await request(app).get('/').set('X-Real-IP', '192.0.2.1').expect(204);
  await request(app).get('/').set('X-Real-IP', '192.0.2.2').expect(204);
  await request(app).get('/').set('X-Real-IP', '192.0.2.3').expect(429);
  await request(app).get('/').set('X-Real-IP', '192.0.2.1').expect(429);
  now = 1001;
  await request(app).get('/').set('X-Real-IP', '192.0.2.3').expect(204);
  await request(app).get('/').set('X-Real-IP', '192.0.2.3').expect(429);
  limiter.reset();
  await request(app).get('/').set('X-Real-IP', '192.0.2.3').expect(204);
});
