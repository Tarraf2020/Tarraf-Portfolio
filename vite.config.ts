import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // Three is the only heavy dependency; splitting it out means edits to the
    // site's own code don't invalidate it in the browser cache.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[/\\]three/ }],
        },
      },
    },
  },
});
