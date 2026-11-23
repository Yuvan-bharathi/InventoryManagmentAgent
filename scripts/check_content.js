const { chromium } = require('../frontend/node_modules/playwright')

async function checkContent() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')

  // Run in browser evaluate to inspect api.get
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/dispatch?status=ALL&carrier=ALL&vehicle_type=ALL&limit=150', {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('inv.token'),
        }
      })
      const status = res.status
      const body = await res.json()
      return { status, ok: res.ok, bodyKeys: Object.keys(body), dataKeys: body.data ? Object.keys(body.data) : null }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('EVAL RESULT:', JSON.stringify(result, null, 2))

  await browser.close()
}

checkContent().catch(console.error)
