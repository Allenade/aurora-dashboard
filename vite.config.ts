import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 4317,
    host: '0.0.0.0',
    strictPort: true,
  },
  preview: {
    port: 4317,
    host: '0.0.0.0',
  },
  plugins: [tailwindcss(), tanstackStart(), netlify(), viteReact()],
})

export default config
