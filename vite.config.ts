import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Два режима сборки:
//  • обычный (npm run build) — интерфейс для Node-сервера с базой на сервере;
//  • pages (npm run build:pages) — полностью статичный сайт для GitHub Pages:
//    те же маршруты API и SQLite работают прямо в браузере, данные хранятся на устройстве.
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages'
  return {
    root: 'client',
    base: pages ? (process.env.PAGES_BASE ?? '/future/') : '/',
    plugins: [react(), tailwindcss()],
    define: pages ? { 'import.meta.env.VITE_STATIC': JSON.stringify('1') } : {},
    resolve: {
      alias: pages
        ? [
            { find: /^express$/, replacement: r('./client/src/offline/express-shim.ts') },
            { find: /^crypto$/, replacement: r('./client/src/offline/crypto-shim.ts') },
          ]
        : [],
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:3001' },
    },
    build: {
      outDir: pages ? '../.pages-dist' : '../dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
    },
  }
})
