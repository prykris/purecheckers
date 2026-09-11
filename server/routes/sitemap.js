import { Router } from 'express';
import prisma from '../db.js';
import { discoverableGames, discoverablePlayerWhere } from '../services/publicGames.js';
import { readContentManifest } from '../services/contentManifest.js';
import { todayUtc, addDays, isoDate } from '../../shared/puzzleDates.js';

const ORIGIN = 'https://purecheckers.com';
const STATIC_UPDATED = '2026-09-10';
const STATIC_PATHS = ['/', '/es', '/faq', '/changelog', '/leaderboard', '/games'];
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
export const xmlEscape = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const absolute = path => ORIGIN + path;

function urlEntry({ path, updated }) {
  const alternates = path === '/' || path === '/es'
    ? [['en', '/'], ['es', '/es'], ['x-default', '/']].map(([lang, url]) =>
      `<xhtml:link rel="alternate" hreflang="${lang}" href="${absolute(url)}"/>`).join('') : '';
  return `<url><loc>${xmlEscape(absolute(path))}</loc>${updated ? `<lastmod>${xmlEscape(new Date(updated).toISOString())}</lastmod>` : ''}${alternates}</url>`;
}

export function createSitemapRouter({ db = prisma, content = readContentManifest, now = Date.now, pageSize = 40000, ttl = 600000 } = {}) {
  const router = Router();
  let cache;
  let pending;
  async function build() {
    const generatedAt = now(), day = todayUtc(new Date(generatedAt));
    const { articles } = await content();
    const entries = STATIC_PATHS.map(path => ({ path, updated: STATIC_UPDATED }));
    entries.push({ path: '/strategy', updated: articles.map(a => a.updated).sort().at(-1) ?? STATIC_UPDATED }, ...articles);
    entries.push({ path: '/puzzle', updated: day });
    let puzzleCursor;
    while (true) {
      const puzzles = await db.puzzle.findMany({ where: { date: { lte: day } }, select: { date: true },
        orderBy: { date: 'asc' }, take: 500, ...(puzzleCursor ? { cursor: { date: puzzleCursor }, skip: 1 } : {}) });
      entries.push(...puzzles.map(p => ({ path: '/puzzle/' + isoDate(p.date), updated: p.date < day ? addDays(p.date, 1) : p.date })));
      if (puzzles.length < 500) break;
      puzzleCursor = puzzles.at(-1).date;
    }
    let cursor;
    while (true) {
      const players = await db.user.findMany({ where: discoverablePlayerWhere, select: { id: true, username: true, updatedAt: true }, orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      entries.push(...players.map(p => ({ path: '/player/' + encodeURIComponent(p.username), updated: p.updatedAt })));
      if (players.length < 500) break;
      cursor = players.at(-1).id;
    }
    for await (const g of discoverableGames(db)) entries.push({ path: '/game/' + g.id, updated: g.endedAt ?? g.startedAt });
    const pages = [];
    for (let i = 0; i < entries.length; i += pageSize) {
      pages.push(XML_HEAD + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + entries.slice(i, i + pageSize).map(urlEntry).join('') + '</urlset>');
    }
    const root = pages.length === 1 ? pages[0] : XML_HEAD + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map((_, i) => `<sitemap><loc>${absolute('/sitemaps/' + (i + 1) + '.xml')}</loc></sitemap>`).join('') + '</sitemapindex>';
    return { pages, root, expires: Math.min(generatedAt + ttl, addDays(day, 1).getTime()) };
  }
  async function serve(req, res, next) {
    try {
      if (!cache || now() >= cache.expires) {
        pending ??= build().then(value => { cache = value; }).finally(() => { pending = null; });
        await pending;
      }
      const page = req.params.page;
      const body = page ? (/^[1-9]\d*$/.test(page) ? cache.pages[Number(page) - 1] : null) : cache.root;
      if (!body) return res.status(404).end();
      res.set('Cache-Control', `public, max-age=${Math.max(0, Math.floor((cache.expires - now()) / 1000))}`);
      res.type('application/xml').send(body);
    } catch (err) { next(err); }
  }
  router.get('/sitemap.xml', serve);
  router.get('/sitemaps/:page.xml', serve);
  return router;
}

export default createSitemapRouter();
