import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Test isolation: Playwright starts its own backend on :8100 against TEST_DATABASE_URL (a Neon test branch).
// It never points at main, where ORG-01 holds the demo data. Build the frontend first (`npm run build`).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function envFile(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(path.join(ROOT, '.env'), 'utf-8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]))
  } catch { return {} }
}
const fileEnv = envFile()
const TEST_DB = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? ''
const MAIN_DB = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? ''
if (!TEST_DB) throw new Error('TEST_DATABASE_URL is not set: Playwright runs only against the Neon test branch, never main.')
if (TEST_DB === MAIN_DB) throw new Error('TEST_DATABASE_URL equals DATABASE_URL: use a separate Neon branch for tests.')

// Shared with the spec (CLI calls such as reset-proposals must hit the test branch too).
process.env.E2E_DATABASE_URL = TEST_DB
process.env.E2E_DATABASE_URL_DIRECT = process.env.TEST_DATABASE_URL_DIRECT ?? fileEnv.TEST_DATABASE_URL_DIRECT ?? TEST_DB
const PORT = 8100

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `"${path.join(ROOT, 'backend', '.venv', 'Scripts', 'python')}" -m uvicorn app.main:app --host 127.0.0.1 --port ${PORT}`,
    cwd: path.join(ROOT, 'backend'),
    url: `http://127.0.0.1:${PORT}/api/demo-users`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: TEST_DB, DATABASE_URL_DIRECT: process.env.E2E_DATABASE_URL_DIRECT!, PYTHONIOENCODING: 'utf-8' },
  },
})
