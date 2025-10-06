import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections (needed for ngrok)
    strictPort: false,
    allowedHosts: ["068d58167fe6.ngrok-free.app"], // Allow all hosts (including ngrok domains)
    hmr: {
      clientPort: 443, // Use HTTPS port for ngrok
      protocol: 'wss', // Use secure websocket for HMR
    },
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
