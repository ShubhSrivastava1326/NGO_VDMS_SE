import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await page.screenshot({ path: 'artifacts/home-desktop.png' });
for (let y = 0; y < await page.locator('body').evaluate(el => el.scrollHeight); y += 650) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await page.waitForTimeout(230);
}
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/home-full.png', fullPage: true });
console.log(JSON.stringify({ errors, width: await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth })), images: await page.locator('img').evaluateAll(imgs => imgs.map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 }))) }));
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1700);
await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: false });
console.log(JSON.stringify({ mobile: await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth })) }));
await browser.close();

