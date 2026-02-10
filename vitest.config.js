import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'logs/**',
        '**/*.config.js',
        '**/node_modules/**',
        '**/test/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
    },
  },
})
