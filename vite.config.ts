import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Ready-made configs: promo/templates.json lists them (order, name, description); the files live in promo/.
// The dev server serves them under /templates/, the build copies them to dist/templates/ — promo/ stays the only copy in git.
const PROMO = resolve(__dirname, 'promo');
function templates(): Plugin {
  const list = (): { file: string }[] => JSON.parse(readFileSync(resolve(PROMO, 'templates.json'), 'utf8'));
  return {
    name: 'bounce-templates',
    configureServer(server) {
      server.middlewares.use('/templates/', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
        const file = name === 'index.json' ? 'templates.json' : list().find((t) => t.file === name)?.file;
        if (!file) return next();
        res.setHeader('content-type', 'application/json');
        res.end(readFileSync(resolve(PROMO, file)));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'templates/index.json', source: readFileSync(resolve(PROMO, 'templates.json')) });
      for (const t of list()) this.emitFile({ type: 'asset', fileName: 'templates/' + t.file, source: readFileSync(resolve(PROMO, t.file)) });
    }
  };
}

// Repo GitHub Pages: the workflow sets BASE_PATH=/repository-name/ automatically.
export default defineConfig({
  plugins: [react(), templates()],
  base: process.env.BASE_PATH || './',
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: { environment: 'node' }
} as any);
