// Maket skrinshoti — dizaynni KO'RISH uchun (odam ham, Claude ham: PNG'ni Read qiladi).
//   npm run design:shot -- manager-orders-list-all            (6 ta PNG: desktop/tablet/phone × light/dark)
//   npm run design:shot -- manager-orders-list-all --device phone --theme light
//   npm run design:shot -- manager-branch-dashboard-main --device phone --split 1200
//     (uzun ekran: to'liq PNG + <ekran>--phone-light-1.png, -2.png … bo'laklari — Read katta rasmni kichraytiradi,
//      bo'laklarda matn o'qiladi)
// Natija: design/shots/<ekran>--<qurilma>-<mavzu>.png + JSON hisobot (gorizontal toshish, 12px dan kichik matn).
// Ekran nomlari: design/SCREENS.md yoki design/kit/views.json (<role>-<viewId>).
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DESIGN, startServer } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const device = opt('--device'); const theme = opt('--theme');
const split = Number(opt('--split')) || 0;
const stems = args.filter((a, i) => !a.startsWith('--') && !['--device', '--theme', '--split'].includes(args[i - 1])).map((s) => s.replace(/\.dc\.html$/, '')).map((s) => (s === 'tizim-main' ? 'Main' : s)); // tizim--main fayli Main.dc.html
if (!stems.length) { console.error('Ekran nomini bering, masalan: npm run design:shot -- superadmin-orders-list'); process.exit(1); }
mkdirSync(join(DESIGN, 'shots'), { recursive: true });
for (const stem of stems) {
  if (!existsSync(join(DESIGN, '.build', `${stem}.dc.html`))) execFileSync('node', [join(DESIGN, 'tools/build.mjs'), '--view', stem], { stdio: 'inherit' });
  if (!existsSync(join(DESIGN, '.build', `${stem}.dc.html`))) { console.error(`Topilmadi: ${stem} (design/kit/views.json da yo'q)`); process.exitCode = 1; continue; }
}
const server = await startServer();
const port = server.address().port;
const browser = await chromium.launch();
for (const stem of stems) {
  const f = join(DESIGN, '.build', `${stem}.dc.html`);
  if (!existsSync(f)) continue;
  const m = readFileSync(f, 'utf8').match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
  const page = await browser.newPage({ viewport: { width: +m[1], height: Math.max(+m[2], 900) } });
  await page.goto(`http://127.0.0.1:${port}/.build/${stem}.dc.html`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const report = [];
  for (const h of await page.$$('.pair .el')) {
    const info = await h.evaluate((el) => {
      const w = el.getBoundingClientRect().width;
      return {
        device: w > 1000 ? 'desktop' : w > 500 ? 'tablet' : 'phone',
        theme: el.classList.contains('dark') ? 'dark' : 'light',
        overflowX: Math.max(0, el.scrollWidth - el.clientWidth),
        tiny: [...el.querySelectorAll('*')].filter((c) => [...c.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(c).fontSize) < 12).length,
      };
    });
    if ((device && info.device !== device) || (theme && info.theme !== theme)) continue;
    const shot = join('design', 'shots', `${stem}--${info.device}-${info.theme}.png`);
    await h.screenshot({ path: join(DESIGN, '..', shot) });
    const tiles = [];
    if (split > 0) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await h.boundingBox();
      if (box && box.height > split) {
        for (let y = 0, k = 1; y < box.height; y += split, k += 1) {
          const tile = shot.replace(/\.png$/, `-${k}.png`);
          await page.screenshot({ path: join(DESIGN, '..', tile), fullPage: true, clip: { x: box.x, y: box.y + y, width: box.width, height: Math.min(split, box.height - y) } });
          tiles.push(tile);
        }
      }
    }
    report.push({ shot, ...(tiles.length ? { tiles } : {}), ...info });
  }
  await page.close();
  console.log(JSON.stringify({ screen: stem, files: report }, null, 1));
}
await browser.close(); server.close();
