import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'src',
  base: '',
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        'sidepanel/index': resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    emptyOutDir: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: resolve(__dirname, 'src/manifest.json'), dest: '.' },
        { src: resolve(__dirname, 'src/assets/*'), dest: 'assets' },
      ],
    }),
  ],
});
