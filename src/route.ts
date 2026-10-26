/**
 * Four screens, no router dependency.
 *
 *   /              Merit's front page (what a visitor without a link sees)
 *   /i/<CODE>      investor subscribe  (the link an adviser shares)
 *   /scout         the adviser's own book   (alias: /introducer)
 *   /issuer        the fund's console
 *
 * `/i` with no code renders the investor screen's empty state.
 *
 * `?code=` on /scout opens a different adviser's book (the demo bar uses it).
 * `?frame=phone` wraps the investor flow in a phone-sized frame, for recording
 * the demo on a laptop without faking a device.
 *
 * HASH TOKENS. Built with VITE_HASH_ROUTING=1 the same routes live after a
 * `#` as a single bare token, so the app can be hosted at any path — a static
 * file host, a shared page — with no server rewrites, and a deep link needs
 * nothing but letters, digits, dots and dashes:
 *
 *   #scout · #scout.CALDER-DO2 · #issuer · #i.CALDER-PR7 · #i.CALDER-PR7.phone
 *   (no token: the front page; #i alone: the investor screen with no link;
 *    #guide: the front page with the guided demo open)
 *
 * Dev and a root deployment keep clean paths.
 */
export type Route =
  | { screen: 'home' }
  | { screen: 'investor'; code: string | null; phone: boolean }
  | { screen: 'scout'; code: string | null }
  | { screen: 'issuer' };

export const HASH_ROUTING: boolean =
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_HASH_ROUTING === '1';

/** Where this build is published, if known — the base for links it hands out. */
const PUBLIC_URL: string =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PUBLIC_URL) || '';

/** "#i.CALDER-PR7.phone" -> { path: "/i/CALDER-PR7", search: "?frame=phone" } */
function fromToken(token: string): { path: string; search: string } {
  const parts = token.split('.').filter(Boolean);
  const [head, code, flag] = parts;
  switch (head) {
    case 'scout':
      return { path: '/scout', search: code ? `?code=${encodeURIComponent(code)}` : '' };
    case 'issuer':
      return { path: '/issuer', search: '' };
    case 'guide':
      return { path: '/', search: '?guide=1' };
    case 'i':
      return {
        path: code ? `/i/${encodeURIComponent(code)}` : '/i',
        search: flag === 'phone' ? '?frame=phone' : '',
      };
    default:
      return { path: '/', search: '' };
  }
}

/** "/i/CALDER-PR7?frame=phone" -> "i.CALDER-PR7.phone" */
function toToken(to: string): string {
  const q = to.indexOf('?');
  const path = q === -1 ? to : to.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : to.slice(q));
  if (params.has('guide')) return 'guide';
  const link = /^\/i\/([^/]+)\/?$/.exec(path);
  if (link) return `i.${decodeURIComponent(link[1])}${params.has('frame') ? '.phone' : ''}`;
  if (path.startsWith('/scout') || path.startsWith('/introducer')) {
    const code = params.get('code');
    return code ? `scout.${code}` : 'scout';
  }
  if (path.startsWith('/issuer')) return 'issuer';
  if (path.startsWith('/i')) return 'i';
  return '';
}

/** The path and query the app should route on, whichever mode is in force. */
export function currentLocation(): { path: string; search: string } {
  if (HASH_ROUTING) return fromToken(location.hash.replace(/^#/, ''));
  return { path: location.pathname, search: location.search };
}

export function parseRoute(path: string, search: string): Route {
  const params = new URLSearchParams(search);
  const link = /^\/i\/([^/]+)\/?$/.exec(path);
  if (link) {
    return { screen: 'investor', code: decodeURIComponent(link[1]), phone: params.has('frame') };
  }
  if (path.startsWith('/scout') || path.startsWith('/introducer')) {
    return { screen: 'scout', code: params.get('code') };
  }
  if (path.startsWith('/issuer')) return { screen: 'issuer' };
  if (path.startsWith('/i') || params.has('code')) {
    return { screen: 'investor', code: params.get('code'), phone: params.has('frame') };
  }
  return { screen: 'home' };
}

export function navigate(to: string): void {
  if (HASH_ROUTING) {
    location.hash = toToken(to);
    return;
  }
  history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
}

/** An absolute link to a route on THIS deployment, in whichever routing mode is on. */
export function hrefFor(to: string): string {
  if (!HASH_ROUTING) return `${location.origin}${to}`;
  const base = PUBLIC_URL || `${location.origin}${location.pathname}${location.search}`;
  return `${base}#${toToken(to)}`;
}
