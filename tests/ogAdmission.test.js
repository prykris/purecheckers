import express from 'express';
import request from 'supertest';
import { createOgRouter } from '../server/routes/og.js';

function setup({ cached = false, get } = {}) {
  let time = 0;
  const service = { hasRequest: vi.fn(() => cached), get: vi.fn(get ?? (() => Promise.resolve({
    png: Buffer.from('image fixture'), etag: '"card"', maxAge: 60
  }))) };
  const app = express().use('/og', createOgRouter({ service, clock: () => time }));
  return { app, service, advance: ms => { time += ms; } };
}

it('admits ten cold requests and rejects the next before data lookup with Retry-After', async () => {
  const { app, service } = setup();
  for (let id = 1; id <= 10; id++) expect((await request(app).get(`/og/game/${id}.png`)).status).toBe(200);
  const limited = await request(app).get('/og/game/11.png');
  expect(limited.status).toBe(429); expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  expect(service.get).toHaveBeenCalledTimes(10);
});

it('admits sixty cached requests but still applies the total request budget', async () => {
  const { app, service } = setup({ cached: true });
  for (let i = 0; i < 60; i++) expect((await request(app).get('/og/game/1.png')).status).toBe(200);
  expect((await request(app).get('/og/game/1.png')).status).toBe(429);
  expect(service.get).toHaveBeenCalledTimes(60);
});

it('shares the cold budget across all card surfaces without blocking cached cards', async () => {
  const { app, service } = setup();
  const paths = ['/og/game/1.png', '/og/player/Chris.png', '/og/puzzle/2026-09-11.png', '/og/invite/abc234.png'];
  for (let i = 0; i < 10; i++) expect((await request(app).get(paths[i % paths.length])).status).toBe(200);
  expect(service.get).toHaveBeenCalledWith('invite', 'ABC234');
  for (const path of paths) expect((await request(app).get(path)).status).toBe(429);
  service.hasRequest.mockReturnValue(true);
  expect((await request(app).get(paths[0])).status).toBe(200);
  expect(service.get).toHaveBeenCalledTimes(11);
});

it('refills cold and total budgets at their configured rates without resetting them per route', async () => {
  const { app, advance } = setup();
  for (let i = 0; i < 10; i++) await request(app).get('/og/game/1.png');
  advance(5999);
  expect((await request(app).get('/og/game/2.png')).status).toBe(429);
  advance(1);
  expect((await request(app).get('/og/game/2.png')).status).toBe(200);
  expect((await request(app).get('/og/game/3.png')).status).toBe(429);
  const warm = setup({ cached: true });
  for (let i = 0; i < 60; i++) await request(warm.app).get('/og/game/1.png');
  warm.advance(999);
  expect((await request(warm.app).get('/og/game/1.png')).status).toBe(429);
  warm.advance(1);
  expect((await request(warm.app).get('/og/game/1.png')).status).toBe(200);
  expect((await request(warm.app).get('/og/game/1.png')).status).toBe(429);
});

it('counts missing records against the cold budget', async () => {
  const { app, service } = setup({ get: () => Promise.resolve(null) });
  for (let i = 1; i <= 10; i++) {
    const missing = await request(app).get(`/og/game/${i}.png`);
    expect(missing.status).toBe(302); expect(missing.headers['cache-control']).toBe('no-store');
  }
  expect((await request(app).get('/og/game/11.png')).status).toBe(429);
  expect(service.get).toHaveBeenCalledTimes(10);
});

it('rejects malformed identities without lookup while keeping them in the total budget', async () => {
  const { app, service } = setup();
  const invalid = ['/og/game/0.png', '/og/game/2147483648.png', '/og/game/abc.png', '/og/invite/123.png',
    '/og/puzzle/2026-02-30.png', '/og/player/a.png', '/og/unknown/123.png'];
  for (let i = 0; i < 60; i++) expect((await request(app).get(invalid[i % invalid.length])).status).toBe(302);
  expect(service.get).not.toHaveBeenCalled(); expect(service.hasRequest).not.toHaveBeenCalled();
  expect((await request(app).get('/og/game/1.png')).status).toBe(429);
});

it('does not let conditional requests bypass either budget or the current visibility check', async () => {
  const { app, service } = setup({ cached: true });
  for (let i = 0; i < 60; i++) expect((await request(app).get('/og/player/Chris.png').set('If-None-Match', '"card"')).status).toBe(304);
  expect(service.get).toHaveBeenCalledTimes(60);
  expect((await request(app).get('/og/player/Chris.png').set('If-None-Match', '"card"')).status).toBe(429);
});

it('charges pending cold requests before awaiting the image service', async () => {
  let release, admitted;
  const waiting = new Promise(resolve => { release = resolve; });
  const allAdmitted = new Promise(resolve => { admitted = resolve; });
  let count = 0;
  const { app, service } = setup({ get: () => { if (++count === 10) admitted(); return waiting; } });
  const pending = Array.from({ length: 10 }, () => request(app).get('/og/game/1.png').then(response => response));
  try {
    await allAdmitted;
    expect((await request(app).get('/og/game/1.png')).status).toBe(429);
    expect(service.get).toHaveBeenCalledTimes(10);
  } finally {
    release(null);
    expect((await Promise.all(pending)).map(response => response.status)).toEqual(Array(10).fill(302));
  }
});
