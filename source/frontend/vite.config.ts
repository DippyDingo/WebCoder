import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Гарантируем, что Vite знает, что это корень
  root: '.', 
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9080",
        changeOrigin: true,
      }
    }
  }
})