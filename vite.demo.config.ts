// Separate Vite config for the demo app, so the library build (vite.config.ts)
// stays untouched. Run with:  npm run demo
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: 'demo',
  plugins: [vue()],
  // The demo's build-time choice for the details panel (see vite-env.d.ts).
  define: { __LEGAL_VISUALIZER_DETAILS_PRESENTATION__: JSON.stringify('modal') },
  server: { port: 5173, open: false },
  build: { outDir: '../dist-demo', emptyOutDir: true },
})
