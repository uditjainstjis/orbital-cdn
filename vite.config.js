import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          globe: ['globe.gl'],
          satellite: ['satellite.js'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['globe.gl', 'satellite.js', 'three'],
  },
})
