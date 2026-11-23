const { chromium } = require('../frontend/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })

  const errors = []
  page.on('pageerror', (err) => {
    console.error('Page error caught:', err.message)
    errors.push(err.message)
  })

  // Login
  await page.goto('http://127.0.0.1:5173/login')
  await page.fill('input[name="username"]', 'buyer')
  await page.fill('input[name="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')

  // Go to /simulation
  console.log('Navigating to simulation page...')
  await page.goto('http://127.0.0.1:5173/simulation', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Click the Run Delay Simulation button
  console.log('Clicking "Run Delay Simulation" button...')
  const runBtn = await page.getByRole('button', { name: 'Run Delay Simulation' })
  await runBtn.click()

  // Wait for simulation result to appear
  await page.waitForTimeout(2000)

  const outPath = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c/simulation_result_page.png'
  await page.screenshot({ path: outPath, fullPage: false })
  console.log('Screenshot saved to:', outPath)

  if (errors.length > 0) {
    console.error('FAILED with errors:', errors)
    process.exit(1)
  }

  const bodyText = await page.innerText('body')
  if (bodyText.includes('Simulation Outcome') && bodyText.includes('Potential Line Stoppages')) {
    console.log('SUCCESS: Simulation executed and outcome rendered smoothly!')
  } else {
    console.warn('Simulation outcome heading not found, text snippet:', bodyText.slice(0, 300))
  }

  await browser.close()
})().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

