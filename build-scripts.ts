import { build } from 'vite';
import { resolve } from 'path';

const __dir = import.meta.dirname ?? resolve('.');

const entries = [
  { name: 'background/index', input: resolve(__dir, 'src/background/index.ts') },
  { name: 'content/index', input: resolve(__dir, 'src/content/index.ts') },
];

async function buildScripts() {
  for (const entry of entries) {
    await build({
      configFile: false,
      base: '',
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: entry.input,
          output: {
            format: 'iife',
            entryFileNames: `${entry.name}.js`,
            assetFileNames: 'assets/[name].[ext]',
          },
        },
        reportCompressedSize: false,
      },
    });
  }
}

buildScripts().catch((err) => {
  console.error(err);
  process.exit(1);
});
