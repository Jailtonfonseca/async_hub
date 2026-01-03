import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        host: true,
        strictPort: true,
        allowedHosts: ['.torado.store', 'localhost', '192.168.1.108'],
        watch: {
            usePolling: true
        },
        proxy: {
            '/api': {
                target: 'http://backend:4000',
                changeOrigin: true
            },
            '/health': {
                target: 'http://backend:4000',
                changeOrigin: true
            }
        }
    }
})
