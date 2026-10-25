import type { ReactNode } from 'react';

/**
 * A phone-sized viewport for recording the investor flow on a laptop. Purely
 * presentational — the content inside is the real screen at real size. Opt in
 * with `?frame=phone` on the investor route; everyone else never sees it.
 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-stage">
      <div className="phone" role="presentation">
        <div className="phone__notch" aria-hidden />
        <div className="phone__screen">{children}</div>
      </div>
    </div>
  );
}
