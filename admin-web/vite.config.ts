import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from CloudFront at /admin (see infra/lib/web-stack.ts).
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: { outDir: 'dist/admin', emptyOutDir: true },
});
