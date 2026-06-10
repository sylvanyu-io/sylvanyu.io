import { defineConfig } from 'astro/config';
import glsl from 'vite-plugin-glsl';

const glslPlugin = await glsl();

export default defineConfig({
  site: 'https://sylvanyu.io',
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [glslPlugin],
    server: {
      allowedHosts: ['.trycloudflare.com', 'yu4321.s.3q.hair'],
    },
  },
});
