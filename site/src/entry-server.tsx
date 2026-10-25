/**
 * The SSR entry.
 *
 * `renderToString` rather than a stream: these pages are small, their data is
 * already loaded before render is called, and a string is far easier to reason
 * about when the interesting part of the request is the chain read that
 * preceded it.
 */
import { renderToString } from 'react-dom/server';
import { App } from './App.tsx';
import './brand.css';
import type { PageData, Route } from './types.ts';

const TITLES: Record<string, (data: PageData) => string> = {
  home: (d) => `${d.fund.manager} — ${d.fund.name}`,
  fund: (d) => `${d.fund.name} — factsheet`,
  how: (d) => `How introductions work — ${d.fund.manager}`,
  introduction: (d) =>
    d.introducer
      ? `${d.introducer.displayName} has introduced you — ${d.fund.manager}`
      : `Introduction — ${d.fund.manager}`,
  open: (d) => `Open an account — ${d.fund.manager}`,
  portfolio: (d) => `Portfolio — ${d.fund.manager}`,
  wallet: (d) => `Wallet — ${d.fund.manager}`,
  subscribe: (d) => `Subscribe — ${d.fund.name}`,
  advisers: (d) => `Introducer register — ${d.fund.manager}`,
  adviser: (d) =>
    d.introducer ? `${d.introducer.displayName} — adviser book` : `Adviser book`,
  notFound: (d) => `Not found — ${d.fund.manager}`,
};

const DESCRIPTIONS: Record<string, (data: PageData) => string> = {
  home: (d) =>
    `${d.fund.name} is distributed through introducers and settled on Stellar. Open an account with a passkey.`,
  how: () =>
    'Every introduction is recorded publicly. No commission rate is. A demonstration of confidential onchain attribution.',
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function render(route: Route, data: PageData): { html: string; head: string } {
  const html = renderToString(<App route={route} data={data} />);
  const title = (TITLES[route.name] ?? TITLES.notFound)(data);
  const description = (DESCRIPTIONS[route.name] ?? DESCRIPTIONS.home)(data);

  const head = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta name="robots" content="noindex" />`,
    `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="%2311352d"/><text x="16" y="23" font-family="Georgia,serif" font-size="20" font-weight="700" fill="%23faf8f3" text-anchor="middle">C</text></svg>',
    )}" />`,
  ].join('\n    ');

  return { html, head };
}
