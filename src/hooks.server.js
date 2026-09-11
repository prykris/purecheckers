// Server hooks. Runs for SSR requests and at prerender time, so the
// prerendered marketing pages get the right <html lang> without runtime work.

function langFor(pathname) {
  return pathname === '/es' || pathname.startsWith('/es/') ? 'es' : 'en';
}

export async function handle({ event, resolve }) {
  const lang = event.route?.id?.startsWith('/(account)') && new URL(event.request.url).searchParams.get('lang') === 'es' ? 'es' : langFor(event.url.pathname);
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', lang)
  });

  // The SPA under src/routes/(app) renders an empty shell to crawlers; keep it
  // out of the index. route.id is null for static assets and unmatched URLs.
  const routeId = event.route?.id;
  if (typeof routeId === 'string' && (routeId.startsWith('/(app)') || routeId.startsWith('/(account)'))) {
    response.headers.set('X-Robots-Tag', 'noindex');
  }
  return response;
}
