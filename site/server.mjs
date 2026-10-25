/**
 * The Calder investor portal, server-rendered.
 *
 *   npm run site:dev      development, with HMR
 *   npm run site:build && npm run site:start    production
 *
 * In development Vite runs in middleware mode and the SSR entry is loaded
 * through it, so a change to a component is reflected on the next request
 * with no build step. In production the two prebuilt bundles are served from
 * disk. Either way the HTML that reaches the browser already contains the
 * investor's real balances, read from testnet during the request.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { SITE_DIR, assertConfigured } from './server/config.mjs';
import { api } from './server/api.mjs';
import { loadRoute, readSession } from './server/loaders.mjs';
import { parseRoute, PRIVATE_ROUTES } from './src/routes.mjs';

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 5174);

assertConfigured();

const app = express();
app.use(express.json({ limit: '512kb' }));
app.use('/api', api());

let vite;
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    configFile: join(SITE_DIR, 'vite.config.ts'),
    root: SITE_DIR,
    appType: 'custom',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
} else {
  app.use('/assets', express.static(join(SITE_DIR, 'dist/client/assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(join(SITE_DIR, 'dist/client'), { index: false }));
}

const productionTemplate = isProduction
  ? readFileSync(join(SITE_DIR, 'dist/client/index.html'), 'utf8')
  : null;

app.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const url = req.originalUrl;

  try {
    const route = parseRoute(new URL(url, 'http://localhost').pathname);
    const session = readSession(req.headers.cookie);

    // A page that shows an investor's own position needs an address to show.
    // Without one the right answer is the door, not an empty table.
    if (PRIVATE_ROUTES.has(route.name) && !session.walletAddress) {
      return res.redirect(302, route.name === 'subscribe' ? '/open' : '/open');
    }

    const data = await loadRoute(route, session);

    // Landing on an adviser's link is the only place the introduction is
    // stated. Remember it here, or the visitor arrives at /open with nobody
    // to credit and the subscription earns the adviser who sent them nothing.
    if (route.name === 'introduction' && data.introducer) {
      res.cookie('calder_code', data.introducer.code, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    let template;
    let render;
    if (isProduction) {
      template = productionTemplate;
      ({ render } = await import(join(SITE_DIR, 'dist/server/entry-server.js')));
    } else {
      template = await vite.transformIndexHtml(
        url,
        readFileSync(join(SITE_DIR, 'index.html'), 'utf8'),
      );
      ({ render } = await vite.ssrLoadModule('/src/entry-server.tsx'));
    }

    const { html, head } = render(route, data);
    // The same data the server rendered from, handed to the client so
    // hydration matches exactly rather than re-fetching and flickering.
    const payload = `<script>window.__CALDER__=${JSON.stringify({ route, data }).replace(/</g, '\\u003c')}</script>`;

    res
      .status(route.name === 'notFound' ? 404 : 200)
      .set({ 'Content-Type': 'text/html' })
      .end(template.replace('<!--app-head-->', head + payload).replace('<!--app-html-->', html));
  } catch (error) {
    // The stack goes to the console, where whoever is developing will see it.
    // It does NOT go to the page: every render does live testnet reads, so a
    // blip is a normal failure mode, and a wall of stack trace is both useless
    // to an investor and the worst thing that can appear on a demo recording.
    vite?.ssrFixStacktrace?.(error);
    console.error(error);
    res
      .status(500)
      .set({ 'Content-Type': 'text/html' })
      .end(
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>Calder — temporarily unavailable</title></head>` +
          `<body style="margin:0;background:#FAF8F3;color:#0C1C26;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">` +
          `<main style="max-width:34rem;margin:0 auto;padding:18vh 1.5rem 0">` +
          `<p style="font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#76858D;margin:0 0 .9rem">Calder Asset Management</p>` +
          `<h1 style="font-family:Georgia,serif;font-weight:600;font-size:2rem;line-height:1.15;margin:0 0 1rem">We could not reach the network.</h1>` +
          `<p style="color:#40535E;margin:0 0 1.5rem">This page reads your position from the Stellar test network as it renders, so a dropped connection shows up here rather than as stale figures. Nothing has changed on your account.</p>` +
          `<a href="${url.replace(/"/g, '&quot;')}" style="display:inline-block;padding:.7rem 1.35rem;border-radius:3px;background:#1C5245;color:#fff;text-decoration:none">Try again</a>` +
          `</main></body></html>`,
      );
  }
});

createServer(app).listen(port, 'localhost', () => {
  console.log(`\n  Calder investor portal`);
  console.log(`  http://localhost:${port}`);
  console.log(`  ${isProduction ? 'production' : 'development'}, server-rendered\n`);
});
