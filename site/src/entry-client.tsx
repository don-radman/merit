/**
 * Hydration, and navigation after the first paint.
 *
 * The first page came from the server with its data already in it. After
 * that, following a link fetches the same loader output as JSON and swaps the
 * page in — so a navigation costs one request instead of a full document, and
 * the data a page renders from comes from exactly one place either way.
 */
import { StrictMode, useEffect, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './brand.css';
import type { PageData, Route } from './types.ts';

interface Payload {
  route: Route;
  data: PageData;
}

declare global {
  interface Window {
    __CALDER__?: Payload;
  }
}

const initial = window.__CALDER__;

function Root({ first }: { first: Payload }) {
  const [payload, setPayload] = useState(first);

  useEffect(() => {
    let cancelled = false;

    async function onNavigate() {
      const path = location.pathname + location.search;
      try {
        const response = await fetch(`/api/page?path=${encodeURIComponent(path)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as Payload & { redirect?: string };
        if (cancelled) return;
        if (next.redirect) {
          location.assign(next.redirect);
          return;
        }
        setPayload(next);
        window.scrollTo({ top: 0 });
      } catch {
        // A failed data fetch should not leave the address bar pointing at a
        // page that never rendered. Fall back to a full load.
        if (!cancelled) location.assign(path);
      }
    }

    addEventListener('popstate', onNavigate);
    return () => {
      cancelled = true;
      removeEventListener('popstate', onNavigate);
    };
  }, []);

  return <App route={payload.route} data={payload.data} />;
}

const root = document.getElementById('root');
if (root && initial) {
  hydrateRoot(
    root,
    <StrictMode>
      <Root first={initial} />
    </StrictMode>,
  );
}
