/**
 * Loading placeholders that hold the shape of the thing they stand in for, so
 * the page does not jump when data lands. Reduced-motion users get a static
 * block (see styles.css).
 */
export function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden />;
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row row--skeleton" key={i}>
          <SkeletonLine width="38%" />
          <SkeletonLine width="18%" />
          <SkeletonLine width="14%" />
          <SkeletonLine width="16%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="stats" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="stat" key={i}>
          <SkeletonLine width="40%" height={12} />
          <SkeletonLine width="60%" height={28} />
        </div>
      ))}
    </div>
  );
}
