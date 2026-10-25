import type { ReactNode } from 'react';
import { PRODUCT } from '@/lib/index.ts';

/**
 * The frame around every screen: a thin header with the product mark and
 * who the viewer is. The investor screen deliberately shows the FUND, not
 * the product — an investor is buying Calder units through someone they
 * trust, and should never have to learn our name to do it.
 */
export default function Shell({
  viewer,
  brand = 'product',
  wide = false,
  children,
}: {
  /** Who is looking: "Raghunathan Family Office · Scout", "Calder · Fund". */
  viewer?: ReactNode;
  brand?: 'product' | 'fund';
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden />
          <span className="brand__name">{brand === 'product' ? PRODUCT.name : 'Calder'}</span>
        </div>
        {viewer && <div className="shell__viewer">{viewer}</div>}
      </header>
      <main className={`page${wide ? ' page--wide' : ''}`}>{children}</main>
    </div>
  );
}
