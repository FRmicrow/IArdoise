import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    // Vitest's default include glob also matches "*.spec.ts", which picks up
    // the Playwright E2E file under tests/e2e/ and fails on its
    // Playwright-only test.describe() API. Scope Vitest to this project's
    // own "*.test.ts" convention instead.
    include: ['tests/**/*.test.ts'],
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Drawing Game',
        short_name: 'DrawGame',
        description: 'A real-time multiplayer drawing game',
        display: 'standalone',
        start_url: '/',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // vite-plugin-pwa defaults this to 'index.html', which registers a
        // NavigationRoute that wins over the NetworkFirst rule below for every
        // navigation — silently pinning every page load to whatever index.html
        // (and therefore whatever JS bundle) was precached at install time,
        // even after a new deploy. Explicitly unset so NetworkFirst actually
        // runs for navigations.
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
            },
          },
          {
            urlPattern: /\.(?:js|css|png|jpg|svg|ico|woff2?)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
