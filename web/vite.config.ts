import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
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
