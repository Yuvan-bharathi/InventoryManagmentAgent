const { chromium } = require('../frontend/node_modules/playwright')
const path = require('path')

const OUT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  })
  const page = await context.newPage()

  page.on('console', msg => console.log('PAGE:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('ERROR:', err.message))

  console.log('Logging in...')
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')

  console.log('Visiting /digital-twin...')
  await page.goto('http://127.0.0.1:5173/digital-twin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Scroll to digital twin card
  await page.evaluate(() => {
    const card = document.querySelector('.card:has(.retail-twin-scope)')
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT_DIR, 'fixed_digital_twin_initial.png') })
  console.log('Saved fixed_digital_twin_initial.png')

  // Find Show Panel View button
  const showPanelBtn = page.locator('button:has-text("Show Panel View")')
  console.log('Found Show Panel View button count:', await showPanelBtn.count())
  if (await showPanelBtn.count() > 0) {
    console.log('Clicking Show Panel View...')
    await showPanelBtn.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(OUT_DIR, 'fixed_panel_view_open.png') })
    console.log('Saved fixed_panel_view_open.png')

    // Find Close button in drawer
    const closeBtn = page.locator('aside.rail-left button:has-text("Close")')
    if (await closeBtn.count() > 0) {
      console.log('Clicking Close on drawer...')
      await closeBtn.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(OUT_DIR, 'fixed_panel_view_closed.png') })
      console.log('Saved fixed_panel_view_closed.png')
    }
  }

  // Check 2D floor plan
  const planBtn = page.locator('button:has-text("2D Floor Plan")')
  console.log('Found 2D Floor Plan button count:', await planBtn.count())
  await page.screenshot({ path: path.join(OUT_DIR, 'fixed_floor_plan_ready.png') })

  // Visit /warehouse-3d
  console.log('Visiting /warehouse-3d...')
  await page.goto('http://127.0.0.1:5173/warehouse-3d', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(OUT_DIR, 'fixed_warehouse_3d.png') })
  console.log('Saved fixed_warehouse_3d.png')

  await browser.close()
  console.log('Test completed successfully!')
}

run().catch(console.error)

