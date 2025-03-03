import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['three'],
    include: [
      'three > webgpu-renderer',
      'three/examples/jsm/controls/OrbitControls'
    ]
  },
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
      timeout: 3000
    },
    watch: {
      usePolling: true // Essential for Docker/WSL2 environments
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/examples/jsm/controls/OrbitControls']
        }
      }
    },
    sourcemap: true
  }
})
