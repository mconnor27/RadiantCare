import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174, // Fixed port for consistent development (Vite default)
    strictPort: true, // Fail if port is already in use
    host: '0.0.0.0', // Allow external connections
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    exclude: ['plotly.js'],
    include: ['plotly.js-dist-min', '@silevis/reactgrid']
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'plotly.js': 'plotly.js-dist-min'
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
})
