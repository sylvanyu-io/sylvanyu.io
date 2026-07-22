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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/three/build/three.core')) {
              return 'vendor-three-core';
            }
            if (
              id.includes('/node_modules/three/build/three.webgpu')
              || id.includes('/node_modules/three/build/three.tsl')
            ) {
              return 'vendor-three-webgpu';
            }
            if (id.includes('/node_modules/three/build/three.module')) {
              return 'vendor-three-webgl';
            }
            if (id.includes('/node_modules/three/')) return 'vendor-three-addons';
            if (id.includes('/node_modules/@galacean/')) return 'vendor-galacean';
            return undefined;
          },
        },
      },
    },
    server: {
      allowedHosts: ['.trycloudflare.com', 'yu4321.s.3q.hair', 'yu8080.s.3q.hair'],
    },
  },
});
