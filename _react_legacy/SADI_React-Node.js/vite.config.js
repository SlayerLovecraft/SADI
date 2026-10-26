import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 3000,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/scheduler/')) {
              return 'vendor-react-core';
            }
            if (normalized.includes('react-router') || normalized.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (normalized.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (normalized.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (normalized.includes('jspdf') || normalized.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (normalized.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (normalized.includes('@supabase') || normalized.includes('axios')) {
              return 'vendor-supabase';
            }
            if (normalized.includes('@radix-ui')) {
              return 'vendor-radix';
            }
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  }
})
