import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['liveSupabase.spec.mjs', 'persistenceSmoke.spec.mjs'],
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config tests/browser/vite.config.mjs --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
  },
})
