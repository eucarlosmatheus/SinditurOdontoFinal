import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BACKEND_URL || 'http://localhost:8001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
        },
        '/socket.io': {
          target: target,
          changeOrigin: true,
          ws: true,
        }
      }
    },
    build: {
      outDir: 'dist'
    }
  }
})
