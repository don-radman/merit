/**
 * Resolve `@/…` to `src/…` for plain `node`.
 *
 * Vite and tsc both understand the alias from their own config, but the smoke
 * test runs on bare node with no bundler — deliberately, so it needs no install
 * and stays usable when the UI build is broken. This hook is what keeps that
 * true now that the imports are aliased.
 */
const SRC = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(specifier.slice(2), SRC).href, context);
  }
  return nextResolve(specifier, context);
}
