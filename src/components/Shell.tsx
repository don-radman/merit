import type { ReactNode } from 'react';
import { PRODUCT } from '@/lib/index.ts';
import { MeritMark } from '@/components/icons.tsx';

/**
 * The frame around every screen: a thin header with the brand and who the
 * viewer is.
 *
 * Brand hierarchy (docs/brand): the client's brand in investor flows, Merit in
 * adviser and fund operations. `brand="fund"` scopes Calder's tokens (deep
 * green, serif) over the same components, so an investor is buying Calder
 * units through someone they trust and never has to learn our name to do it.
 */
export default function Shell({
  viewer,
  brand = 'product',
  wide = false,
  children,
}: {
  /** Who is looking: "Raghunathan Family Office · Adviser", "Calder · Fund operations". */
  viewer?: ReactNode;
  brand?: 'product' | 'fund';
  wide?: boolean;
  children: ReactNode;
}) {
  const fund = brand === 'fund';
  return (
    <div className={`shell${fund ? ' shell--fund' : ''}`}>
      <header className="shell__header">
        <div className={`brand${fund ? ' brand--fund' : ''}`}>
          {fund ? (
            <span className="brand__mark--fund" aria-hidden>
              C
            </span>
          ) : (
            <MeritMark size={32} />
          )}
          <span className="brand__name">{fund ? 'Calder' : PRODUCT.name}</span>
        </div>
        {viewer && <div className="shell__viewer">{viewer}</div>}
      </header>
      <main className={`page${wide ? ' page--wide' : ''}`}>{children}</main>
    </div>
  );
}
