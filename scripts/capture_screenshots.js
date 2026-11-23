const { chromium } = require('../frontend/node_modules/playwright')
const path = require('path')

const OUT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c'

async function capture() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5,
  })
  const page = await context.newPage()

  console.log('1. Navigating to login...')
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })

  // Fill login
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')

  // Wait for redirect to /home
  await page.waitForURL('**/home', { timeout: 10000 })
  await page.waitForTimeout(1500)

  // 1. Screenshot Home: Inventory at a Glance
  const homePath = path.join(OUT_DIR, 'walkthrough_1_home.png')
  await page.screenshot({ path: homePath, fullPage: false })
  console.log('Captured 1. Home:', homePath)

  // 2. Shortage Forecast
  console.log('2. Navigating to Shortage Forecast...')
  await page.goto('http://127.0.0.1:5173/shortages', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const shortagesPath = path.join(OUT_DIR, 'walkthrough_2_shortages.png')
  await page.screenshot({ path: shortagesPath, fullPage: false })
  console.log('Captured 2. Shortages:', shortagesPath)

  // 3. Purchase & Transfer Requests (Proposals)
  console.log('3. Navigating to Proposals...')
  await page.goto('http://127.0.0.1:5173/proposals', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const proposalsPath = path.join(OUT_DIR, 'walkthrough_3_proposals.png')
  await page.screenshot({ path: proposalsPath, fullPage: false })
  console.log('Captured 3. Proposals:', proposalsPath)

  // 4. Quality Hold & Rejects
  console.log('4. Navigating to Quality Hold & Rejects...')
  await page.goto('http://127.0.0.1:5173/quality', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const qualityPath = path.join(OUT_DIR, 'walkthrough_4_quality.png')
  await page.screenshot({ path: qualityPath, fullPage: false })
  console.log('Captured 4. Quality Hold:', qualityPath)

  // 5. Build Capacity Calculator
  console.log('5. Navigating to Build Capacity Calculator...')
  await page.goto('http://127.0.0.1:5173/capacity', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const capacityPath = path.join(OUT_DIR, 'walkthrough_5_capacity.png')
  await page.screenshot({ path: capacityPath, fullPage: false })
  console.log('Captured 5. Capacity:', capacityPath)

  // 6. Finished Goods & Dispatch
  console.log('6. Navigating to Finished Goods & Dispatch (/dispatch)...')
  await page.goto('http://127.0.0.1:5173/dispatch', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const dispatchPath = path.join(OUT_DIR, 'walkthrough_6_dispatch.png')
  await page.screenshot({ path: dispatchPath, fullPage: false })
  console.log('Captured 6. Dispatch:', dispatchPath)

  // 7. Batch Traceability
  console.log('7. Navigating to Batch Traceability (/traceability)...')
  await page.goto('http://127.0.0.1:5173/traceability', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const tracePath = path.join(OUT_DIR, 'walkthrough_7_traceability.png')
  await page.screenshot({ path: tracePath, fullPage: false })
  console.log('Captured 7. Traceability:', tracePath)

  await browser.close()
  console.log('All end-to-end acceptance screenshots captured successfully!')
}

capture().catch((err) => {
  console.error('Error during capture:', err)
  process.exit(1)
})
