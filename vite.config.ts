import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Единственный источник правды о поддержке — `.browserslistrc`;
    // Vite его сам не читает, поэтому переводим запросы в esbuild-таргеты.
    target: browserslistToEsbuild(),
  },
});
