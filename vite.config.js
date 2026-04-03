import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { resolve } from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    fs: {
      allow: [resolve('shared')],
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
