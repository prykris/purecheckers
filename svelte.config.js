import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import { strategyIntro } from './scripts/strategy-intro.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],
  preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'], remarkPlugins: [strategyIntro] })],
  kit: {
    adapter: adapter({ out: 'build' }),
    files: {
      assets: 'src/static',
      routes: 'src/routes',
      lib: 'src/lib',
    },
  },
};

export default config;
