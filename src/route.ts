/**
 * Three screens, no router dependency.
 *
 *   /i/<CODE>      investor subscribe  (the introducer link)
 *   /introducer    the introducer's own book
 *   /issuer        the attribution ledger
 *
 * `/` with no code renders the investor screen's empty state, which is what a
 * visitor arriving without a link should see.
 */
export type Route =
  | { screen: 'investor'; code: string | null }
  | { screen: 'introducer' }
  | { screen: 'issuer' };

export function parseRoute(path: string, search: string): Route {
  const link = /^\/i\/([^/]+)\/?$/.exec(path);
  if (link) return { screen: 'investor', code: decodeURIComponent(link[1]) };
  if (path.startsWith('/introducer')) return { screen: 'introducer' };
  if (path.startsWith('/issuer')) return { screen: 'issuer' };
  return { screen: 'investor', code: new URLSearchParams(search).get('code') };
}

export function navigate(to: string): void {
  history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
}
