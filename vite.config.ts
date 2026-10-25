import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The introducer link is /i/<CODE>, so dev needs SPA fallback (Vite's
    // default for appType 'spa'). Keep the host on localhost: passkeys need a
    // secure context, and localhost counts as one.
    host: 'localhost',
    port: 5173,
    // bb.js needs SharedArrayBuffer to prove in the browser, and that needs
    // cross-origin isolation. Without these two headers proving either refuses
    // to start or silently drops to a single thread and gets much slower.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
