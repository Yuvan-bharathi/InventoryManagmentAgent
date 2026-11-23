const { chromium } = require('../frontend/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto('http://127.0.0.1:5173/login')
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')

  console.log('Navigating to dead-stock...')
  await page.goto('http://127.0.0.1:5173/dead-stock')
  await page.waitForTimeout(1500)

  const outPath = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c/dead_stock_page.png'
  await page.screenshot({ path: outPath, fullPage: false })
  console.log('Screenshot saved to:', outPath)

  const text = await page.innerText('body')
  if (text.includes('TypeError') || text.includes('filter is not a function')) {
    console.error('Crash detected!')
    process.exit(1)
  } else {
    console.log('SUCCESS: Dead Stock page rendered cleanly without error!')
  }

  await browser.close()
})().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

