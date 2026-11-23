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

  // 1. Sidebar view on /agents page
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), token);
  
  await page.goto('http://127.0.0.1:5173/agents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'sidebar_agents_moved_and_clean_bg.png'),
    fullPage: false
  });
  console.log('Saved sidebar_agents_moved_and_clean_bg.png');

  // Also scroll sidebar down a bit to see Finished Goods & Dispatch clearly without any glass effect
  await page.evaluate(() => {
    const side = document.querySelector('.side');
    if (side) side.scrollTop = 120;
  });
  await page.waitForTimeout(400);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'sidebar_scrolled_finished_goods_clean.png'),
    fullPage: false
  });
  console.log('Saved sidebar_scrolled_finished_goods_clean.png');

  await browser.close();
}

run().catch(console.error);
