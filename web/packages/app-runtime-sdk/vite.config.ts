import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'AgentStudioRuntime',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'agentstudio-runtime.global.js')
    }
  }
})
