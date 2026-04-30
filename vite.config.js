import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 5174}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: ['@neondatabase/serverless', 'drizzle-orm', 'bcryptjs', 'jsonwebtoken'],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-zod': ['zod'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
});
