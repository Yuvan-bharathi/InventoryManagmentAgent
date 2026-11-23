const { chromium } = require('../frontend/node_modules/playwright')

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('API RESPONSE:', res.status(), res.url())
    }
  })

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')

  console.log('Testing /dispatch...')
  await page.goto('http://127.0.0.1:5173/dispatch', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('Testing /traceability...')
  await page.goto('http://127.0.0.1:5173/traceability', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await browser.close()
}

debug().catch(console.error)

