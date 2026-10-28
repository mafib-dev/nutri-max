import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['src/modules/training/opengym/test-setup.js'],
  },
})
