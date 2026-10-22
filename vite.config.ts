import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Repo GitHub Pages: the workflow sets BASE_PATH=/repository-name/ automatically.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || './',
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: { environment: 'node' }
} as any);
