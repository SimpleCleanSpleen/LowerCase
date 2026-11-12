import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any sub-path
  // (GitHub Pages project sites live at /<repo>/, Firebase at /).
  base: './',
  // Unique per build; appended to asset URLs to defeat stale caches.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // never inline sprite sheets as base64
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.5 MB min (~340 KB gzip)
    rollupOptions: {
      output: {
        // Keep Phaser in its own chunk so game-code changes don't bust its cache.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
