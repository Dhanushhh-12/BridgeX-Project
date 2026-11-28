import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = (env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

  return {
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-motion',
                test: /node_modules[\\/](motion|framer-motion|gsap)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-three',
                test: /node_modules[\\/](three|@react-three|three-stdlib|troika|camera-controls)[\\/]/,
                priority: 25,
              },
            ],
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
