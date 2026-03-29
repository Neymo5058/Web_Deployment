import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');

  // ---------- DEV BACKEND (local) ----------
  const DEFAULT_DEV_API_PORT = 5000;
  const parsedDevPort = Number(env.DEV_API_PORT);
  const devApiPort =
    Number.isFinite(parsedDevPort) && parsedDevPort > 0
      ? parsedDevPort
      : DEFAULT_DEV_API_PORT;

  const devProxyTarget =
    env.VITE_DEV_PROXY_TARGET || `http://localhost:${devApiPort}`;

  // ---------- PROD BACKEND (Railway) ----------
  const prodApiUrl =
    env.VITE_API_URL || 'https://test-1-gt6a.onrender.com';

  // ---------- CONFIG ----------
  return {
    plugins: [vue()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    // ---------- DEV SERVER ----------
    server: {
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'local.host',
        '.netlify.app', // ✅ allow Netlify preview domains
      ],
    },

    // ---------- GLOBAL DEFINE ----------
    define: {
      // ✅ Available everywhere as __API_URL__
      __API_URL__: JSON.stringify(
        mode === 'production' ? prodApiUrl : devProxyTarget
      ),
    },

    test: {
      environment: 'jsdom',
      setupFiles: './tests/setupTests.js',
    },
  };
});
