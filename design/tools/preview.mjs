// Barcha maketlarni yig'adi va brauzerda ko'rish uchun ro'yxat sahifasini ochadi.
//   npm run design:preview          → http://127.0.0.1:4199  (rol → bo'lim → ekran)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN, startServer } from './serve.mjs';

execFileSync('node', [join(DESIGN, 'tools/build.mjs')], { stdio: 'inherit' });
const { views, groupTitles = {} } = JSON.parse(readFileSync(join(DESIGN, 'kit/views.json'), 'utf8'));
const roles = JSON.parse(readFileSync(join(DESIGN, 'kit/roles.json'), 'utf8'));
const label = (r) => (r === 'tizim' ? 'Dizayn tizimi' : r === 'common' ? 'Umumiy ekranlar' : roles.roles[r]?.label ?? r);
const file = (v) => (v.role === 'tizim' && v.viewId === 'main' ? 'Main.dc.html' : `${v.role}-${v.viewId}.dc.html`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const order = ['tizim', ...roles.order, 'common'];
let body = '';
for (const r of order) {
  const vs = views.filter((v) => v.role === r);
  if (!vs.length) continue;
  body += `<h2>${esc(label(r))} <small>${vs.length} ta ekran</small></h2>`;
  const keys = [...new Set(vs.map((v) => v.menuKey))];
  for (const k of keys) {
    body += `<h3>${esc(groupTitles[r]?.[k] ?? k)}</h3><ul>` + vs.filter((v) => v.menuKey === k).map((v) => `<li><a href="/.build/${file(v)}">${esc(v.title)}</a> <code>${v.role}-${v.viewId}</code></li>`).join('') + '</ul>';
  }
}
writeFileSync(join(DESIGN, '.build/index.html'), `<!doctype html><meta charset="utf-8"><title>Elchi dizayn v2 — maketlar</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 16px;color:#101733}h2{margin-top:40px;border-bottom:1px solid #e1e6f0}small,code{color:#4b5575}a{color:#2b50d8}li{margin:4px 0}</style>
<h1>Elchi CRM — dizayn v2 maketlari</h1><p>Har ekran: Desktop 1440 · Planshet 768 · Telefon 390, kunduzgi | tungi. Qoidalar: <code>docs/DESIGN_SYSTEM.md</code>, ekran ↔ route: <code>design/SCREENS.md</code>.</p>${body}`);
const server = await startServer(Number(process.env.PORT || 4199));
console.log(`\nMaketlar: http://127.0.0.1:${server.address().port}  (to'xtatish: Ctrl+C)`);
