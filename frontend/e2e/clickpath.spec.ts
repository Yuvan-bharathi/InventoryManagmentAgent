import { expect, test, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PY = path.join(ROOT, 'backend', '.venv', 'Scripts', 'python')
const ZIP = process.env.DATASET_ZIP
const CSVS = readdirSync(path.join(ROOT, 'data', 'raw')).filter((f) => f.endsWith('.csv')).map((f) => path.join(ROOT, 'data', 'raw', f))

async function login(page: Page, user: string) {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.fill('input[name=username]', user)
  await page.fill('input[name=password]', 'demo')
  await page.click('button[type=submit]')
  await expect(page.getByTestId('refresh-badge')).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test('click path: upload → DQ findings → shortage → proposal → buyer → manager', async ({ page }) => {
  // clean demo state: the upload below regenerates draft proposals
  // Test branch only (playwright.config.ts refuses to run without TEST_DATABASE_URL).
  const db = process.env.E2E_DATABASE_URL
  if (!db) throw new Error('E2E_DATABASE_URL missing: run through playwright.config.ts')
  execSync(`"${PY}" -m app.cli reset-proposals`, { cwd: path.join(ROOT, 'backend'), stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: db, DATABASE_URL_DIRECT: process.env.E2E_DATABASE_URL_DIRECT ?? db } })
  // 1. upload as stores
  await login(page, 'stores')
  await page.goto('/uploads')
  const done = page.waitForResponse((r) => r.url().endsWith('/api/uploads') && r.request().method() === 'POST', { timeout: 90_000 })
  await page.getByTestId('upload-input').setInputFiles(ZIP ? [ZIP] : CSVS)
  const resp = await done
  expect(resp.status()).toBe(200)
  const runId = (await resp.json()).data.run_id as number
  await expect(page.getByTestId('dq-summary')).toContainText(`run #${runId}`)
  await expect(page.getByTestId('dq-summary')).toContainText('issues found in the dataset before any calculation', { timeout: 90_000 })
  // 2. DQ findings + assumptions
  await expect(page.getByTestId('dq-summary')).toContainText('Uncounted future receipts')
  await expect(page.getByTestId('assumptions')).toContainText('A19')
  await expect(page.getByTestId('refresh-badge')).toContainText('Data as of 31-Oct-2026')

  // 3. shortage as buyer
  await login(page, 'buyer')
  await page.goto('/shortages')
  const row = page.locator('table.dg tbody tr', { hasText: 'MAT-SOC-001' }).filter({ hasText: 'IN-TN-01' }).first()
  await expect(row).toContainText('Critical')
  // 4. open its proposal
  await row.getByRole('link', { name: /PR-/ }).click()
  await expect(page.getByTestId('proposal-state')).toHaveText('Draft')
  await expect(page.getByText('Buyer and procurement manager approve', { exact: false })).toBeVisible()
  const url = page.url()
  // 5. buyer submits and approves (level 1)
  await page.getByTestId('act-submit').click()
  await expect(page.getByTestId('proposal-state')).toHaveText('Pending buyer')
  await page.getByTestId('act-approve').click()
  await expect(page.getByTestId('proposal-state')).toHaveText('Pending manager')
  // 6. manager approves (level 2)
  await login(page, 'procmgr')
  await page.goto(url)
  await page.getByTestId('act-approve').click()
  await expect(page.getByTestId('proposal-state')).toHaveText('Approved')
  await expect(page.locator('table', { hasText: 'procmgr' })).toContainText('Pending manager → Approved')
})

test('every MVP page loads in under 2 s on the real data', async ({ page }) => {
  await login(page, 'leader')
  const pages: [string, string][] = [
    ['/overview', 'Needs attention'],
    ['/stock', 'MAT-'],
    ['/material/MAT-SOC-001?plant=IN-TN-01', 'Projection'],
    ['/shortages', 'Heat map'],
    ['/proposals', 'Pending buyer'],
    ['/brief', "Today's brief"],
    ['/uploads', 'issues found'],
  ]
  const pid = await page.evaluate(async () => {
    const r = await fetch('/api/proposals?page_size=1', { headers: { Authorization: `Bearer ${localStorage.getItem('inv.token')}` } })
    return (await r.json()).data.rows[0].id as number
  })
  pages.push([`/proposals/${pid}`, 'Calculation'], ['/material/MAT-PCB-004?plant=IN-KA-01', 'Projection'])
  for (const [url, text] of pages) {
    const t0 = Date.now()
    await page.goto(url)
    await expect(page.locator('main')).toContainText(text, { timeout: 10_000 })
    await expect(page.locator('.skel')).toHaveCount(0)
    const ms = Date.now() - t0
    console.log(`${url}: ${ms} ms`)
    expect(ms, `${url} took ${ms} ms`).toBeLessThan(2000)
  }
})

test('labels: plant selector, refresh badge, scenario tags, assumption hover', async ({ page }) => {
  await login(page, 'leader')
  await page.goto('/overview')
  await expect(page.locator('select[aria-label=Plant]')).toBeVisible()
  await expect(page.locator('.pill.scenario').first()).toHaveText('Planning scenario')
  const aid = page.locator('[data-assumptions]').first()
  await expect(aid).toHaveAttribute('title', /A\d+: /)
  await expect(page.getByTestId('banner-stale')).toBeVisible()
})

test('agent side panel answers with cited links (Domo down → engine template)', async ({ page }) => {
  await login(page, 'leader')
  await page.goto('/material/MAT-SOC-001?plant=IN-TN-01')
  await expect(page.locator('main')).toContainText('Projection')
  await page.getByRole('button', { name: 'Ask the agent why' }).click()
  const panel = page.getByTestId('agent-panel')
  await expect(panel).toContainText('Material 360 · MAT-SOC-001 @ IN-TN-01')
  await expect(panel.locator('.msg.bot .trace')).toContainText('Cites:', { timeout: 30_000 })
  await expect(panel.locator('.msg.bot').last()).toContainText('MAT-SOC-001')
  await expect(panel.locator('.msg.bot a').first()).toHaveAttribute('href', /\/material\/MAT-SOC-001/)
})

test('every scenario-based number carries the Planning scenario tag', async ({ page }) => {
  await login(page, 'leader')
  await page.evaluate(() => localStorage.removeItem('inv.demandView'))
  await page.goto('/overview')
  await expect(page.getByTestId('kpi-strip')).toBeVisible()
  for (const label of ['Inventory Health', 'Critical within 7 days', 'Production orders at risk', 'Excess value', 'Pending approvals']) {
    const tile = page.locator('.kpi', { hasText: label })
    await expect(tile.locator('.pill.scenario'), `${label} tile`).toBeVisible()
  }
  for (const [name, loc] of [['Success measures', page.getByTestId('kpi-strip')],
    ['Health trend', page.locator('.card', { hasText: 'Health trend' })],
    ['Plant comparison', page.locator('.card', { hasText: 'Plant comparison' })]] as const) {
    await expect(loc.locator('.pill.scenario').first(), name).toBeVisible()
  }
  for (const url of ['/stock', '/shortages', '/proposals']) {
    await page.goto(url)
    await expect(page.locator('.page-head .pill.scenario'), url).toBeVisible()
  }
})
