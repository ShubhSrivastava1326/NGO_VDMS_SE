import { chromium } from '@playwright/test';
import { writeFile, stat } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173');
const encoded = await page.evaluate(async () => {
  const img = new Image();
  img.src = '/images/community-hero.png';
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/webp', 0.9).split(',')[1];
});
await writeFile('public/images/community-hero.webp', Buffer.from(encoded, 'base64'));
console.log('Optimized hero: ' + (await stat('public/images/community-hero.webp')).size + ' bytes');
await browser.close();

