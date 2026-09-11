import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { generateContentManifest } from './scripts/content-manifest.js';

import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = `http://localhost:${env.PORT || 3001}`;
  return {
    plugins: [{ name: 'content-manifest', buildStart: generateContentManifest }, sveltekit()],
    server: {
      port: Number(env.CLIENT_PORT || 5173),
      strictPort: true,
      fs: {
        allow: [resolve('shared')],
      },
      proxy: {
        '/api': apiTarget,
        '/og': apiTarget,
        '/sitemap.xml': apiTarget,
        '/sitemaps/': apiTarget,
        '/socket.io': {
          target: apiTarget,
          ws: true,
        },
      },
    },
  };
});
