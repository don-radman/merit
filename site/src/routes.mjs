/**
 * The site's routes, parsed the same way on both sides.
 *
 * Plain ESM with no dependencies so the server can import it to decide what
 * to load and render, and the browser can import the identical file to decide
 * what to show after a client-side navigation. One table, no router.
 */

/** @typedef {{name: string, params: Record<string,string>, path: string}} Route */

const TABLE = [
  [/^\/$/, 'home'],
  [/^\/fund\/?$/, 'fund'],
  [/^\/how-it-works\/?$/, 'how'],
  [/^\/i\/([^/]+)\/?$/, 'introduction', ['code']],
  [/^\/open\/?$/, 'open'],
  [/^\/portfolio\/?$/, 'portfolio'],
  [/^\/wallet\/?$/, 'wallet'],
  [/^\/subscribe\/?$/, 'subscribe'],
  [/^\/advisers\/?$/, 'advisers'],
  [/^\/advisers\/([^/]+)\/?$/, 'adviser', ['code']],
];

/** @returns {Route} */
export function parseRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const [pattern, name, keys = []] of TABLE) {
    const match = pattern.exec(path);
    if (!match) continue;
    const params = {};
    keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
    return { name, params, path };
  }
  return { name: 'notFound', params: {}, path };
}

/** Routes that render an investor's own position and so need their address. */
export const PRIVATE_ROUTES = new Set(['portfolio', 'wallet', 'subscribe']);

export const NAV = [
  { href: '/fund', label: 'The fund' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/advisers', label: 'For advisers' },
];
