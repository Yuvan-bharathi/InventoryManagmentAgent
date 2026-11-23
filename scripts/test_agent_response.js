const { chromium } = require('../frontend/node_modules/playwright')
const path = require('path')

const OUT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c'

async function runTest() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5,
  })
  const page = await context.newPage()

  console.log('1. Logging in...')
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home', { timeout: 10000 })

  console.log('2. Navigating to Ask the Inventory Agent (/agent)...')
  await page.goto('http://127.0.0.1:5173/agent', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  console.log('3. Submitting shortage question...')
  const textarea = page.locator('textarea')
  await textarea.fill('Which materials have a shortage in the next 30 days, and when?')
  await page.keyboard.press('Enter')

  console.log('4. Waiting for answer...')
  await page.waitForSelector('.msg.bot .agent-table, .msg.bot .agent-markdown-body', { timeout: 15000 })
  await page.waitForTimeout(2000)

  // Scroll .agent-body to top of the bot message so the table and header are visible
  await page.evaluate(() => {
    const el = document.querySelector('.agent-body')
    if (el) el.scrollTop = 0
  })
  await page.waitForTimeout(500)

  // 1. Capture top of message (table + summary)
  const shotTop = path.join(OUT_DIR, 'enhanced_agent_shortage_table.png')
  await page.screenshot({ path: shotTop, fullPage: false })
  console.log('Captured top table view:', shotTop)

  // 2. Scroll to bottom of message (citations + workflow details)
  await page.evaluate(() => {
    const el = document.querySelector('.agent-body')
    if (el) el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(500)

  const shotBottom = path.join(OUT_DIR, 'enhanced_agent_shortage_meta.png')
  await page.screenshot({ path: shotBottom, fullPage: false })
  console.log('Captured bottom meta view:', shotBottom)

  await browser.close()
  console.log('Test completed successfully!')
}

runTest().catch((err) => {
  console.error('Error in runTest:', err)
  process.exit(1)
})
