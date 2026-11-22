# Vite Bundle Chunking & Code Splitting Reference

This guide details the `vite.config.js` chunking strategy to maintain initial bundles below the 250kB gzipped budget.

## Recommended `vite.config.js` Manual Chunks

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'zod']
        }
      }
    }
  }
})
```

## Verifying Bundle Distribution

Run the build and inspect the emitted chunk table:

```bash
npm run build
```

Verify that no individual chunk exceeds 500kB uncompressed (~150kB gzipped).
