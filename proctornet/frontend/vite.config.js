import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import path from 'path'

// §4.5 Build Fingerprint Reduction
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress' })
  ],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
        manualChunks: (id) => {
          // Opaque chunk names (§4.5.4)
          if (id.includes('node_modules/face-api.js')) return 'v-fa'
          if (id.includes('node_modules/xlsx')) return 'v-ds'
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'v-doc'
          if (id.includes('node_modules/recharts')) return 'v-ch'
          if (id.includes('node_modules/@tanstack')) return 'v-ts'
          if (id.includes('node_modules/socket.io-client')) return 'v-rt'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'v-core'
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
}))
