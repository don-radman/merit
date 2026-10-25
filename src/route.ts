/**
 * Three screens, no router dependency.
 *
 *   /i/<CODE>      investor subscribe  (the link a scout shares)
 *   /scout         the scout's own book   (alias: /introducer)
 *   /issuer        the fund's console
 *
 * `/` with no code renders the investor screen's empty state, which is what a
 * visitor arriving without a link should see.
 *
 * `?code=` on /scout opens a different scout's book (the dev bar uses it).
 * `?frame=phone` wraps the investor flow in a phone-sized frame, for recording
 * the demo on a laptop without faking a device.
 */
export type Route =
  | { screen: 'investor'; code: string | null; phone: boolean }
  | { screen: 'scout'; code: string | null }
  | { screen: 'issuer' };

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
  return { screen: 'investor', code: params.get('code'), phone: params.has('frame') };
}

export function navigate(to: string): void {
  history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
}
