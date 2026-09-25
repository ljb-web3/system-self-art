import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['liveSupabase.spec.mjs', 'persistenceSmoke.spec.mjs'],
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'chrome', headless: true },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config tests/browser/vite.live.config.mjs',
    url: 'http://127.0.0.1:5175',
  },
})
