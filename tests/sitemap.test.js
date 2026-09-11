import express from 'express';
import request from 'supertest';
import { createSitemapRouter, xmlEscape } from '../server/routes/sitemap.js';

function setup(options = {}) {
  const db = { puzzle: { findMany: vi.fn().mockResolvedValue([]) }, user: { findMany: vi.fn().mockResolvedValue([{ id: 1, username: 'Name & <tag>', updatedAt: new Date('2026-09-10') }]) }, game: { findMany: vi.fn().mockResolvedValue([]) } };
  const content = vi.fn().mockResolvedValue({ articles: [{ path: '/strategy/rules', updated: '2026-09-09' }] });
  const app = express().use(createSitemapRouter({ db, content, ...options }));
  return { app, db, content };
}

it('includes articles and encoded player URLs with home-only language alternates', async () => {
  const { app, db } = setup();
  const res = await request(app).get('/sitemap.xml');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('application/xml');
  expect(res.headers['cache-control']).toMatch(/max-age=\d+/);
  expect(res.text).toContain('/player/Name%20%26%20%3Ctag%3E</loc>');
  expect(res.text).toContain('/strategy/rules</loc>');
  expect(res.text).toContain('/leaderboard</loc>');
  expect(res.text.match(/<xhtml:link /g)).toHaveLength(6);
  expect(res.text).not.toMatch(/<priority>|<changefreq>|\/blog<|\/invite\//);
  expect(db.user.findMany.mock.calls[0][0].where).toEqual({ isGuest: false, isBot: false, gamesPlayed: { gt: 0 }, profilePublic: true });
  expect(xmlEscape('<&"\'')).toBe('&lt;&amp;&quot;&apos;');
});

it('coalesces requests, reuses cached XML, and rebuilds after expiry', async () => {
  let time = 0;
  const { app, content } = setup({ now: () => time, ttl: 1000 });
  await Promise.all([request(app).get('/sitemap.xml'), request(app).get('/sitemap.xml')]);
  expect(content).toHaveBeenCalledTimes(1);
  time = 1001;
  expect((await request(app).get('/sitemap.xml')).status).toBe(200);
  expect(content).toHaveBeenCalledTimes(2);
});

it('splits into a sitemap index and serves every shard with bounds checks', async () => {
  const { app } = setup({ pageSize: 3 });
  const root = await request(app).get('/sitemap.xml');
  expect(root.text).toContain('<sitemapindex');
  const urls = [...root.text.matchAll(/<loc>https:\/\/purecheckers.com([^<]+)<\/loc>/g)].map(m => m[1]);
  expect(urls).toHaveLength(4);
  const pages = await Promise.all(urls.map(url => request(app).get(url)));
  expect(pages.every(p => p.status === 200 && p.text.includes('<urlset'))).toBe(true);
  expect(pages.map(p => (p.text.match(/<url>/g) ?? []).length)).toEqual([3, 3, 3, 1]);
  expect((await request(app).get('/sitemaps/0.xml')).status).toBe(404);
  expect((await request(app).get('/sitemaps/5.xml')).status).toBe(404);
});

it('recovers from a failed generation instead of retaining a rejected promise', async () => {
  const content = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ articles: [] });
  const { app } = setup({ content });
  expect((await request(app).get('/sitemap.xml')).status).toBe(500);
  expect((await request(app).get('/sitemap.xml')).status).toBe(200);
});

it('limits publication caches to UTC midnight and queries published puzzle dates only', async () => {
  let time = Date.parse('2026-09-10T23:59:55Z');
  const { app, db } = setup({ now: () => time });
  db.puzzle.findMany.mockResolvedValue([{ date: new Date('2026-09-09') }]);
  const res = await request(app).get('/sitemap.xml');
  expect(res.headers['cache-control']).toBe('public, max-age=5');
  expect(res.text).toContain('/puzzle/2026-09-09</loc><lastmod>2026-09-10T00:00:00.000Z');
  expect(db.puzzle.findMany.mock.calls[0][0].where.date.lte).toEqual(new Date('2026-09-10'));
  time += 5000;
  await request(app).get('/sitemap.xml');
  expect(db.puzzle.findMany).toHaveBeenCalledTimes(2);
  expect(db.puzzle.findMany.mock.calls[1][0].where.date.lte).toEqual(new Date('2026-09-11'));
});
