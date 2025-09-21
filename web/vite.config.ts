import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/RadiantCare/',
  plugins: [react()],
  build: {
    // Ensure assets are properly referenced
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Ensure consistent asset naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})
