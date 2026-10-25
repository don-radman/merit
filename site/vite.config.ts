import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * The site is its own Vite project, separate from the demo SPA at the repo
 * root. Two reasons: the root app is being worked on in parallel and should
 * not have its config changed underneath it, and this one builds two bundles
 * (a browser bundle and an SSR bundle) where that one builds none.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    // Passkeys need a secure context. localhost is one; a LAN IP is not, so
    // binding elsewhere would silently break WebAuthn.
    host: 'localhost',
    port: 5174,
  },
});
