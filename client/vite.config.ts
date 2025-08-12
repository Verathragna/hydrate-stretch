import { defineConfig } from 'vite'
export default defineConfig({
  base: './',                // allow file:// in Electron
  server: { port: 5173 },
  build: { outDir: 'dist' },
})
