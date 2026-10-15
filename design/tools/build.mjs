// Dizayn v2 maketlarini yig'adi: har ekran = bitta HTML (desktop 1440 / planshet 768 / telefon 390 × kunduzgi | tungi).
//   npm run design:build                          — hammasi (≈410 ta) → design/.build/
//   npm run design:build -- --view manager-orders-list-all
//   npm run design:build -- --only courier
// Manba: design/kit/{roles,views,heights}.json, design/kit/helmet.html, design/fragments/<fragment>.{html,json}.
// ⚠️ Bu fayl dizayn kanvasidan (kit/build-roles.mjs) olingan; maketlar o'zgarsa design/ papkasi birga yangilanadi.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ROLES = JSON.parse(read('kit/roles.json'));
const VIEWS = JSON.parse(read('kit/views.json'));
const HELMET = read('kit/helmet.html').trim().replace('</style>', `
/* side-by-side presentation (generated) */
.pair .el-app{min-height:var(--pair-h)} .pair > div > .el{min-height:var(--pair-h)}
</style>`);
const LOGO_W = '/_blob/6c64e6604f822b10da1545ec86677c82';
const args = process.argv.slice(2);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const ONE = args.includes('--view') ? args[args.indexOf('--view') + 1].replace(/\.dc\.html$/, '').replace(/^tizim-main$/, 'Main') : null;
const NOBUILD = false;
// --adhoc role:viewId:menuKey:kind:fragment[:devices]  → build a view that is not (yet) in views.json (for previews)
const ADHOC = args.includes('--adhoc') ? (() => { const [role, viewId, menuKey, kind, fragment, devices] = args[args.indexOf('--adhoc') + 1].split(':'); return { role, viewId, menuKey, kind, fragment, order: 9999, title: viewId, ...(devices ? { devices: devices.split(',') } : {}) }; })() : null;
if (ADHOC) VIEWS.views.push(ADHOC);
mkdirSync(join(ROOT, '.build'), { recursive: true });

const svg = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ROLES.icons[name] || ''}</svg>`;
const ICON = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
const raw = (paths, size = 20, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${paths}</svg>`;

// view lookup
const byRole = {};
for (const v of VIEWS.views) (byRole[v.role] ||= []).push(v);
const firstViewOf = (role, menuKey) => (byRole[role] || []).filter((v) => v.menuKey === menuKey).sort((a, b) => a.order - b.order)[0];
const fileOf = (role, viewId) => (role === 'tizim' && viewId === 'main' ? 'Main.dc.html' : `${role}-${viewId}.dc.html`);

function resolveLinks(html, role) {
  const has = (r, id) => (byRole[r] || []).some((v) => v.viewId === id);
  // alias: a shared fragment may link to @dashboard-main; roles whose home view has another id (manager: branch-dashboard-main) get their own home
  const home = (byRole[role] || []).filter((v) => v.menuKey === 'dashboard').sort((a, b) => a.order - b.order)[0];
  const base = (id) => id.replace(/-step\d+$/, '');
  const target = (id) => (has(role, id) ? fileOf(role, id) : has(role, base(id)) ? fileOf(role, base(id)) : (/^dashboard/.test(id) && home) ? fileOf(role, home.viewId) : has('common', id) ? fileOf('common', id) : has('tizim', id) ? fileOf('tizim', id) : (role === 'tizim' && has('superadmin', id)) ? fileOf('superadmin', id) : '#');
  return html.replace(/href="@([A-Za-z0-9_-]+)"/g, (_, id) => `href="${target(id)}"`);
}

function sidebar(role, activeKey) {
  const R = ROLES.roles[role];
  let html = `<aside class="el-sidebar" aria-label="Asosiy menyu">\n  <div class="el-brand"><img src="${LOGO_W}" alt="Elchi Pochta" width="96" height="32"></div>\n  <nav class="el-nav">\n`;
  let lastGroup = null;
  for (const it of R.menu) {
    if (R.grouped && it.group && it.group !== lastGroup) { html += `    <div class="el-nav-group">${it.group}</div>\n`; lastGroup = it.group; }
    const fv = firstViewOf(role, it.key);
    const href = fv ? `@${fv.viewId}` : '#';
    const cur = it.key === activeKey ? ' aria-current="page"' : '';
    const count = it.count ? `<span class="el-nav-count">${it.count}</span>` : '';
    html += `    <a class="el-nav-item" href="${href}"${cur}>${svg(it.icon)}${it.label}${count}</a>\n`;
  }
  return html + '  </nav>\n</aside>';
}

function topbar(role) {
  const R = ROLES.roles[role]; const p = R.persona;
  const scan = p.scan
    ? `<button class="el-btn el-btn-secondary el-hide-mobile" type="button">${raw(ICON.scan, 18)}Skanerlash</button>` : '';
  return `<header class="el-topbar">
    <button class="el-iconbtn el-show-tablet" type="button" aria-label="Menyuni ochish">${raw(ICON.menu)}</button>
    <label class="el-search">${raw(ICON.search, 18)}<input class="el-input" type="search" placeholder="Ism, telefon yoki buyurtma raqami" aria-label="Qidiruv"></label>
    <div class="el-topbar-spacer"></div>
    ${scan}
    <button class="el-iconbtn" type="button" aria-label="Bildirishnomalar, 3 ta yangi">${svg('bell')}<span class="el-dotcount">3</span></button>
    <button class="el-user" type="button" aria-label="Profil menyusi"><span class="el-avatar">${p.initials}</span><span class="el-user-text el-hide-tablet"><span class="el-user-name" style="display: block">${p.name}</span><span class="el-user-role" style="display: block">${p.role}</span></span>${raw(ICON.chevron, 16, ' style="color: var(--text-subtle)"')}</button>
  </header>`;
}

const short = (it) => (it.short && it.short.uz) || it.label;
function bottomNav(role, activeKey) {
  const R = ROLES.roles[role];
  const keys = R.bottomNav || R.menu.filter((m) => m.phoneNav !== false).slice(0, 4).map((m) => m.key).concat('@menu');
  const has = (id) => (byRole[role] || []).some((v) => v.viewId === id);
  const links = keys.map((k) => {
    if (k === '@scan') return `<a class="el-bn-scan" href="${has('scan-camera') ? '@scan-camera' : '#'}"${activeKey === 'scan' ? ' aria-current="page"' : ''}><span class="el-bn-fab">${svg('ScanLine', 24)}</span><span class="el-bn-label">Skaner</span></a>`;
    if (k === '@menu') return `<a href="${has('dashboard-mobile-menu') ? '@dashboard-mobile-menu' : '#'}">${raw(ICON.menu, 22)}<span class="el-bn-label">Menyu</span></a>`;
    const it = R.menu.find((m) => m.key === k); if (!it) return '';
    const fv = firstViewOf(role, it.key);
    return `<a href="${fv ? '@' + fv.viewId : '#'}"${it.key === activeKey ? ' aria-current="page"' : ''}>${svg(it.icon, 22)}<span class="el-bn-label">${short(it)}</span></a>`;
  }).join('');
  return `<nav class="el-bottomnav" aria-label="Asosiy bo'limlar">${links}</nav>`;
}

function desktopShell(role, activeKey, content) {
  return `<div class="el-app">\n${sidebar(role, activeKey)}\n<div class="el-main">\n  ${topbar(role)}\n  <main class="el-content">\n${content}\n  </main>\n</div>\n${bottomNav(role, activeKey)}\n</div>`;
}

function phoneShell(role, activeKey, frag) {
  const R = ROLES.roles[role];
  const part = (name) => { const m = frag.match(new RegExp(`<!--${name}-->([\\s\\S]*?)(?=<!--(MTOP|MBODY|MAFTER)-->|$)`)); return m ? m[1].trim() : ''; };
  const items = R.menu.filter((m) => m.phoneNav !== false).slice(0, 5);
  const nav = items.map((it) => {
    const fv = firstViewOf(role, it.key);
    return `  <a href="${fv ? '@' + fv.viewId : '#'}"${it.key === activeKey ? ' aria-current="page"' : ''}>${svg(it.icon, 22)}<span class="el-bn-label">${short(it)}</span></a>`;
  }).join('\n');
  return `<div class="el-phone">\n${part('MTOP')}\n<div class="el-mbody">\n${part('MBODY')}\n</div>\n${part('MAFTER')}\n<nav class="el-mnav" aria-label="Asosiy bo'limlar">\n${nav}\n</nav>\n</div>`;
}

function suffixIds(html, sfx) {
  return html
    .replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls|name|list)="([^"]+)"/g, (_, a, v) => `${a}="${v.split(/\s+/).map((x) => x + sfx).join(' ')}"`)
    .replace(/href="#([A-Za-z][\w-]*)"/g, (_, v) => `href="#${v}${sfx}"`);
}

function buildView(v) {
  const role = v.role;
  const metaPath = join(ROOT, 'fragments', `${v.fragment}.json`);
  const fragPath = join(ROOT, 'fragments', `${v.fragment}.html`);
  if (!existsSync(metaPath) || !existsSync(fragPath)) { console.warn(`MISSING fragment ${v.fragment} for ${role}-${v.viewId}`); return null; }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const frag = readFileSync(fragPath, 'utf8').trim();
  const shellRole = role === 'common' ? (v.shellRole || 'superadmin') : role;
  let inner; let w; let h;
  if (meta.kind === 'phone') { inner = phoneShell(shellRole, v.menuKey, frag); w = 390; h = 844; }
  else if (meta.kind === 'standalone' || meta.kind === 'screen') { inner = frag; w = meta.width ?? 1440; h = meta.height; }
  else { inner = desktopShell(shellRole, v.menuKey, frag); w = 1440; h = meta.height; }
  inner = resolveLinks(inner, shellRole);
  const responsive = meta.kind !== 'phone' && meta.kind !== 'standalone';
  // fragment meta may override the view: "dialog": true (device-height frames), "devices": ["phone"] (phone-only interaction)
  const isDialog = v.kind === 'dialog' || meta.dialog === true || (meta.kind === 'screen' && meta.fixed !== false);
  const devices = meta.devices || v.devices || ['desktop', 'tablet', 'phone'];
  const LBL = 'height: 32px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font: 600 14px/1 Manrope, system-ui, sans-serif; color: #4b5575';
  const half = (dark, width, label, devH) => {
    const style = meta.kind === 'phone' ? 'width: 390px; height: 844px; position: relative'
      : devH ? `position: relative; height: ${devH}px; overflow: hidden; --pair-h: ${devH}px`
      : `position: relative; --pair-h: ${width === w ? h : width === 768 ? 1024 : width === 390 ? 844 : 0}px`;
    return `<div style="width: ${width}px; flex: none">
  <div style="${LBL}">${label} · ${dark ? 'tungi' : 'kunduzgi'}</div>
  <div class="el${dark ? ' dark' : ''}" style="${style}">
${dark ? suffixIds(inner, '-t') : inner}
  </div>
</div>`;
  };
  const sfx = (html, k) => k ? html.replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls|name|list)="([^"]+)"/g, (_, a, val) => `${a}="${val.split(/\s+/).map((x) => x + k).join(' ')}"`) : html;
  let body; let W; let H;
  if (!responsive) {
    W = 2 * w + 48 + 48; H = h + 24 + 32 + 12 + 24;
    body = `<div class="pair" style="display: flex; gap: 48px; padding: 24px; background: #dfe3ea; width: ${W}px; box-sizing: border-box; align-items: flex-start">
${half(false, w, meta.kind === 'phone' ? 'Telefon' : 'Desktop')}
${half(true, w, meta.kind === 'phone' ? 'Telefon' : 'Desktop')}
</div>`;
  } else {
    const devH = { desktop: isDialog ? h : 0, tablet: isDialog ? 1024 : 0, phone: isDialog ? 844 : 0 };
    const rowDesk = devices.includes('desktop') ? `<div style="display: flex; gap: 48px; align-items: flex-start">
${half(false, 1440, 'Desktop', meta.kind === 'screen' && isDialog ? devH.desktop : 0)}
${half(true, 1440, 'Desktop', meta.kind === 'screen' && isDialog ? devH.desktop : 0)}
</div>` : '';
    const small = [];
    if (devices.includes('tablet')) small.push(sfx(half(false, 768, 'Planshet', devH.tablet), '-pl'), sfx(half(true, 768, 'Planshet', devH.tablet), '-pd'));
    if (devices.includes('phone')) small.push(sfx(half(false, 390, 'Telefon', devH.phone), '-ml'), sfx(half(true, 390, 'Telefon', devH.phone), '-md'));
    const rowSmall = small.length ? `<div style="display: flex; gap: 48px; align-items: flex-start">
${small.join('\n')}
</div>` : '';
    W = devices.includes('desktop') ? 2 * 1440 + 48 + 48 : (devices.includes('tablet') ? 2 * 768 + 48 : 0) + (devices.includes('phone') ? 2 * 390 + 48 : 0) + (devices.includes('tablet') && devices.includes('phone') ? 48 : 0) + 48;
    H = (rowDesk ? h + 24 + 44 : 0) + (rowSmall ? 48 + 44 + (isDialog ? 1024 : Math.max(h * 2, 1200)) : 0) + 24; // rough; measure.mjs fixes it
    body = `<div class="pair" style="display: flex; flex-direction: column; gap: 48px; padding: 24px; background: #dfe3ea; width: ${W}px; box-sizing: border-box">
${[rowDesk, rowSmall].filter(Boolean).join('\n')}
</div>`;
  }
  const hp = join(ROOT, 'kit/heights.json');
  const name = fileOf(role, v.viewId);
  if (existsSync(hp)) { const known = JSON.parse(readFileSync(hp, 'utf8'))[name]; if (known && known.w === W) H = known.h; }
  const title = `${ROLES.roles[role] ? ROLES.roles[role].label : role === 'tizim' ? 'Dizayn tizimi' : 'Umumiy'} · ${v.title}`;
  const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body>
<x-dc>
${HELMET}
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${H}}}'>
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}
</script>
</body>
</html>
`;
  writeFileSync(join(ROOT, '.build', name), html);
  return { name, w: W, h: H, title: v.title };
}

// ---------- build ----------
const built = {};
for (const v of VIEWS.views) {
  if (NOBUILD || (ONLY && v.role !== ONLY) || (ONE && fileOf(v.role, v.viewId) !== `${ONE}.dc.html`) || (ADHOC && v !== ADHOC)) continue;
  const r = buildView(v);
  if (r) built[r.name] = { ...r, v };
}
console.log(`built ${Object.keys(built).length} artboards`);
