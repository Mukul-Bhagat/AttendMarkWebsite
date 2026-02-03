import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        // ✅ CRITICAL: Disable caching in Vite proxy to prevent 304 responses
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Force no-cache headers on every proxied request
            proxyReq.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            proxyReq.setHeader('Pragma', 'no-cache');
            proxyReq.setHeader('Expires', '0');

            // Log proxied requests for debugging
            console.log('🔵 [VITE PROXY]', req.method, req.url);
          });

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // Override response cache headers
            proxyRes.headers['cache-control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
            proxyRes.headers['pragma'] = 'no-cache';
            proxyRes.headers['expires'] = '0';

            // Log response status
            console.log('✅ [VITE PROXY]', req.method, req.url, '→', proxyRes.statusCode);
          });
        },
      },
    },
  },
})


