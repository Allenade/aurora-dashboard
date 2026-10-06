import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const netlifyPlugin =
  process.env.NETLIFY === 'true' || process.env.CI === 'true' ? [netlify()] : []

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
  plugins: [tailwindcss(), tanstackStart(), ...netlifyPlugin, viteReact()],
})

export default config
