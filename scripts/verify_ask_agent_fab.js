const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  let token = 'demo';
  try {
    const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'planner', password: 'demo' })
    }).then(r => r.json());
    if (loginRes.token) token = loginRes.token;
  } catch (e) {
    console.log('Login fetch error, continuing with fallback token:', e.message);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), token);
  
  await page.goto('http://127.0.0.1:5173/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Default idle state screenshot (centered, only icon)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'ask_agent_fab_default_center.png'),
    fullPage: false
  });
  console.log('Saved ask_agent_fab_default_center.png');

  // 2. Hover state screenshot (expanded with "Ask Agent" text)
  const fab = page.locator('.agent-fab');
  await fab.hover();
  await page.waitForTimeout(400); // allow transition animation to complete

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'ask_agent_fab_hover_expanded.png'),
    fullPage: false
  });
  console.log('Saved ask_agent_fab_hover_expanded.png');

  await browser.close();
}

run().catch(console.error);
