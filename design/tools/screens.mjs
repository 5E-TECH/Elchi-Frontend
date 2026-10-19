// Ekranlar xaritasi: design/SCREENS.md ni yaratadi (route ↔ dizayn v2 maketi).
//   npm run design:screens              — design/SCREENS.md ni qayta yozadi
//   npm run design:screens -- --check   — yozmaydi: xarita to'liqligi va SCREENS.md yangiligini tekshiradi (CI uchun)
// Manbalar:
//   src/app/lib/routes.tsx       — TypeScript AST: har route'ning to'liq yo'li, guardlari, lazy komponent fayli, yo'naltirishlar
//   design/kit/route-map.json    — QO'LDA: route → fayllar, rol → maket (viewId), izohlar, holat, kodda yo'q maketlar
//   design/kit/views.json        — maketlar ro'yxati (rol, viewId, sarlavha, fragment, tur)
//   design/fragments/*.json      — fragment meta (qurilmalar)
// Xato bo'lsa (routes.tsx dagi route xaritada yo'q, maket hech qaysi route'ga bog'lanmagan, fayl topilmadi …)
// ro'yxatini chiqaradi va exit 1 qiladi — SCREENS.md baribir yoziladi (--check rejimidan tashqari).
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const DESIGN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DESIGN, '..');
const CHECK = process.argv.includes('--check');
const OUT = join(DESIGN, 'SCREENS.md');
const ROUTES_FILE = 'src/app/lib/routes.tsx';

const readJson = (p) => JSON.parse(readFileSync(join(DESIGN, p), 'utf8'));
const MAP = readJson('kit/route-map.json');
const { views: VIEWS } = readJson('kit/views.json');
const ROLES = readJson('kit/roles.json');
const ROLE_ORDER = MAP.roleOrder;
const errors = [];
const warnings = [];
const rel = (abs) => relative(ROOT, abs).split('\\').join('/');
const fileExists = (p) => existsSync(join(ROOT, p)) && !statSync(join(ROOT, p)).isDirectory();

// ───────────── 1. routes.tsx ni o'qish (AST) ─────────────
const src = readFileSync(join(ROOT, ROUTES_FILE), 'utf8');
const sf = ts.createSourceFile(ROUTES_FILE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const text = (n) => n.getText(sf);

function resolveModule(spec, fromDir) {
  const base = resolve(fromDir, spec);
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts'), base]) {
    if (existsSync(c) && !statSync(c).isDirectory()) {
      // Fayl faqat qayta eksportdan iborat bo'lsa (`export { default } from "./ui/X"`) — haqiqiy sahifa fayliga o'tamiz.
      const body = readFileSync(c, 'utf8');
      const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
      const m = body.match(/export\s*\{\s*default\s*\}\s*from\s*["']([^"']+)["']/);
      if (m && lines.every((l) => /^export\s.*\sfrom\s/.test(l))) return resolveModule(m[1], dirname(c)) ?? c;
      return c;
    }
  }
  return null;
}

const lazyFiles = {}; // komponent nomi → fayl (repo nisbiy)
const localComps = {}; // routes.tsx ichida e'lon qilingan komponentlar
for (const st of sf.statements) {
  if (!ts.isVariableStatement(st)) continue;
  for (const d of st.declarationList.declarations) {
    if (!ts.isIdentifier(d.name) || !d.initializer) continue;
    const name = d.name.text;
    const init = d.initializer;
    if (ts.isCallExpression(init) && text(init.expression) === 'lazy') {
      let spec = null;
      (function find(n) {
        if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) spec = n.arguments[0].text;
        else ts.forEachChild(n, find);
      })(init);
      const file = spec && resolveModule(spec, dirname(join(ROOT, ROUTES_FILE)));
      if (file) lazyFiles[name] = rel(file);
      else errors.push(`routes.tsx: lazy komponent \`${name}\` fayli topilmadi (${spec}).`);
    } else if (/^[A-Z]/.test(name) && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      localComps[name] = init;
    }
  }
}

function jsxOpenings(node) {
  const out = [];
  (function visit(n) {
    if (ts.isJsxElement(n)) out.push(n.openingElement);
    else if (ts.isJsxSelfClosingElement(n)) out.push(n);
    ts.forEachChild(n, visit);
  })(node);
  return out;
}
function exprToPath(e) {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) {
    const param = (x) => { let id = null; (function f(n) { if (!id && ts.isIdentifier(n)) id = n.text; else ts.forEachChild(n, f); })(x); return id ? `:${id}` : ':param'; };
    return e.head.text + e.templateSpans.map((s) => param(s.expression) + s.literal.text).join('');
  }
  return text(e);
}
function attrValue(el, name) {
  for (const p of el.attributes.properties) {
    if (!ts.isJsxAttribute(p) || text(p.name) !== name) continue;
    if (!p.initializer) return 'true';
    if (ts.isStringLiteral(p.initializer)) return p.initializer.text;
    if (ts.isJsxExpression(p.initializer) && p.initializer.expression) return exprToPath(p.initializer.expression);
  }
  return null;
}
const propNode = (obj, name) => obj.properties.find((p) => ts.isPropertyAssignment(p) && text(p.name) === name)?.initializer;
const isTrue = (n) => n?.kind === ts.SyntaxKind.TrueKeyword;

const LAYOUT_ONLY = new Set(['Auth', 'ScanLayout', 'DashboardLayout']);
function analyzeElement(expr) {
  const info = { guard: null, guardRedirect: null, navigate: null, names: [] };
  for (const el of jsxOpenings(expr)) {
    const n = text(el.tagName);
    if (n === 'ProtectedRoute') { info.guard = attrValue(el, 'canActivate'); info.guardRedirect = attrValue(el, 'redirectTo'); }
    else if (n === 'Navigate') info.navigate = attrValue(el, 'to');
    else if (n !== 'Outlet') info.names.push(n);
  }
  return info;
}
const joinPath = (parent, p) => (p.startsWith('/') ? p : parent === '' ? (p === '*' ? '*' : `/${p}`) : `${parent === '/' ? '' : parent}/${p}`);

const records = new Map(); // to'liq yo'l → yozuv
function addRecord(path, info, guards, layouts) {
  const comps = [];
  const wrappers = [];
  let redirect = info.navigate;
  for (const n of info.names) {
    if (lazyFiles[n]) comps.push({ name: n, file: lazyFiles[n] });
    else if (localComps[n]) {
      wrappers.push(n);
      const inner = jsxOpenings(localComps[n]);
      if (/^Legacy\w*Redirect$/.test(n)) {
        const nav = inner.find((el) => text(el.tagName) === 'Navigate');
        if (nav) redirect = attrValue(nav, 'to');
        continue;
      }
      for (const t of new Set(inner.map((el) => text(el.tagName)).filter((t) => lazyFiles[t]))) comps.push({ name: t, file: lazyFiles[t], via: n });
    } else if (!LAYOUT_ONLY.has(n)) errors.push(`routes.tsx: \`${path}\` dagi \`<${n}>\` na lazy import, na routes.tsx ichidagi komponent.`);
  }
  const authed = layouts.includes('Auth');
  const rec = {
    path, comps, wrappers, guards, guardRedirect: info.guardRedirect, layouts,
    redirect: comps.length === 0 && redirect ? redirect : null,
    authed, publicToo: !authed,
  };
  const prev = records.get(path);
  if (prev) {
    // Bir yo'l ikki joyda (masalan /403: kirishsiz va qobiq ichida) — birlashtiramiz.
    prev.layouts = [...new Set([...prev.layouts, ...layouts])];
    prev.authed = prev.authed && authed;
    prev.publicToo = prev.publicToo || !authed;
  } else records.set(path, rec);
}
function walk(arr, parent, guards, layouts) {
  for (const obj of arr.elements) {
    if (!ts.isObjectLiteralExpression(obj)) continue;
    const pathNode = propNode(obj, 'path');
    const p = pathNode && ts.isStringLiteral(pathNode) ? pathNode.text : null;
    const full = isTrue(propNode(obj, 'index')) || p === null ? parent : joinPath(parent, p);
    const el = propNode(obj, 'element');
    const info = el ? analyzeElement(el) : { guard: null, names: [] };
    const g = info.guard ? [...guards, info.guard] : guards;
    const children = propNode(obj, 'children');
    if (children && ts.isArrayLiteralExpression(children)) {
      const hasIndex = children.elements.some((c) => ts.isObjectLiteralExpression(c) && isTrue(propNode(c, 'index')));
      if (!hasIndex && info.names.some((n) => !LAYOUT_ONLY.has(n))) addRecord(full, info, g, layouts);
      walk(children, full, g, [...layouts, ...info.names]);
    } else addRecord(full, info, g, layouts);
  }
}
let routesArray = null;
(function find(n) {
  if (ts.isCallExpression(n) && text(n.expression) === 'useRoutes' && n.arguments[0] && ts.isArrayLiteralExpression(n.arguments[0])) routesArray = n.arguments[0];
  else ts.forEachChild(n, find);
})(sf);
if (!routesArray) { console.error('routes.tsx: useRoutes([...]) topilmadi'); process.exit(1); }
walk(routesArray, '', [], []);

// ───────────── 1b. menuConfig.tsx — rol menyulari (AST) ─────────────
// SIDEBAR_CONFIG (menejerdan boshqa rollar) + MANAGER_MENU_ORDER × MANAGER_CAPABILITIES (menejer, filial turiga qarab).
const MENU_FILE = 'src/widgets/Sidebar/model/menuConfig.tsx';
const menuSf = ts.createSourceFile(MENU_FILE, readFileSync(join(ROOT, MENU_FILE), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const mtext = (n) => n.getText(menuSf);
const menuVars = {};
for (const st of menuSf.statements) {
  if (!ts.isVariableStatement(st)) continue;
  for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) menuVars[d.name.text] = d.initializer;
}
const unwrap = (n) => (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isParenthesizedExpression(n)) ? unwrap(n.expression) : n);
const strProp = (obj, name) => { const n = obj && propNodeIn(obj, name); return n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null; };
function propNodeIn(obj, name) { return obj.properties.find((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name)?.initializer; }
const MENU = {}; // rol → [{ to, key, cond }]
{
  const sidebar = unwrap(menuVars.SIDEBAR_CONFIG);
  const order = unwrap(menuVars.MANAGER_MENU_ORDER);
  const caps = unwrap(menuVars.MANAGER_CAPABILITIES);
  if (!sidebar || !ts.isObjectLiteralExpression(sidebar) || !order || !ts.isArrayLiteralExpression(order) || !caps || !ts.isObjectLiteralExpression(caps)) {
    errors.push(`${MENU_FILE}: SIDEBAR_CONFIG / MANAGER_MENU_ORDER / MANAGER_CAPABILITIES topilmadi — screens.mjs dagi menyu o'quvchisini yangilang.`);
  } else {
    const branchesWith = {}; // qobiliyat → [filial turi]
    for (const p of caps.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isArrayLiteralExpression(p.initializer)) continue;
      for (const c of p.initializer.elements) if (ts.isStringLiteral(c)) (branchesWith[c.text] ??= []).push(mtext(p.name));
    }
    const BRANCH_ORDER = ['HQ', 'PICKUP', 'REGIONAL', 'HYBRID'];
    for (const p of sidebar.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isArrayLiteralExpression(p.initializer)) continue;
      const role = mtext(p.name).replace(/['"]/g, '');
      if (role === 'manager') continue; // menejer menyusi MANAGER_MENU_ORDER dan quriladi (menuConfig.tsx izohi)
      MENU[role] = p.initializer.elements.filter(ts.isObjectLiteralExpression).map((o) => ({ to: strProp(o, 'to'), key: strProp(o, 'label'), cond: '' }));
    }
    MENU.manager = order.elements.filter(ts.isObjectLiteralExpression).map((o) => {
      const item = unwrap(propNodeIn(o, 'item'));
      const cap = propNodeIn(o, 'capability');
      const capName = cap && ts.isStringLiteral(cap) ? cap.text : null;
      const cond = capName ? BRANCH_ORDER.filter((b) => (branchesWith[capName] ?? []).includes(b)).join(' · ') : '';
      return { to: item && ts.isObjectLiteralExpression(item) ? strProp(item, 'to') : null, key: item && ts.isObjectLiteralExpression(item) ? strProp(item, 'label') : null, cond, cap: capName };
    });
  }
}
// getSidebarConfigForUser ichidagi shartli bandlar: `if (normalizedRole === "registrator" && !pred(user)) return SIDEBAR_CONFIG.x.filter((item) => item.to !== "/dispatch")`.
// Shart matni — o'sha route guardining shu roldagi sharti (access.ts: menyu va guard bitta predikatdan).
{
  const body = menuVars.getSidebarConfigForUser ? mtext(menuVars.getSidebarConfigForUser) : '';
  const re = /normalizedRole\s*===\s*["'](\w+)["']\s*&&\s*!\s*(\w+)\(user\)\s*\)\s*\{\s*return\s+SIDEBAR_CONFIG\.\w+\.filter\(\s*\(item\)\s*=>\s*item\.to\s*!==\s*["']([^"']+)["']\s*\)/g;
  let m; let found = 0;
  while ((m = re.exec(body))) {
    found += 1;
    const [, role, pred, to] = m;
    const it = (MENU[role] ?? []).find((x) => x.to === to);
    const g = records.get(to)?.guards.at(-1);
    if (it) it.cond = MAP.guards[g]?.roles?.[role] || `${pred}(user)`;
  }
  if ((body.match(/SIDEBAR_CONFIG\.\w+\.filter\(/g) ?? []).length !== found) errors.push(`${MENU_FILE}: getSidebarConfigForUser dagi shartli band o'qilmadi — screens.mjs dagi menyu o'quvchisini yangilang.`);
}
const stripQuery = (p) => p.split('?')[0];
const menuByPath = new Map(); // route → [{ role, key, cond, via }]
for (const role of ROLE_ORDER) {
  for (const it of MENU[role] ?? []) {
    if (!it.to || !it.key) { errors.push(`${MENU_FILE}: ${role} menyusida \`to\` yoki \`label\` o'qilmadi.`); continue; }
    const rec = records.get(it.to);
    if (!rec) { errors.push(`${MENU_FILE}: ${role} menyusidagi \`${it.to}\` routes.tsx da yo'q.`); continue; }
    // routes.tsx dagi <Navigate> yoki komponent ichidagi yo'naltirish (route-map `redirectsTo`, masalan /mails → /mails/today).
    const first = rec.redirect ? stripQuery(rec.redirect) : it.to;
    const target = MAP.routes.find((x) => x.path === first)?.redirectsTo ?? first;
    it.target = target;
    for (const p of new Set([first, target])) menuByPath.set(p, [...(menuByPath.get(p) ?? []), { role, key: it.key, cond: it.cond, via: p !== it.to ? it.to : null }]);
  }
  // Maket menyusi (roles.json) ↔ kod menyusi (menuConfig.tsx): bandlar to'plami bir xil bo'lishi shart (tartib — guruhlash sababli farq qilishi mumkin).
  const designKeys = new Set((ROLES.roles[role]?.menu ?? []).map((m) => m.key));
  const codeKeys = new Set((MENU[role] ?? []).map((m) => m.key));
  // route-map.json → plannedMenu: maketda bor, kodda hali yo'q bandlar (ega tasdiqlagan). Ro'yxat faqat qisqaradi.
  const planned = new Set(MAP.plannedMenu?.[role] ?? []);
  for (const k of planned) {
    if (codeKeys.has(k)) errors.push(`route-map.json: plannedMenu.${role} dagi \`${k}\` endi kodda bor (${MENU_FILE}) — plannedMenu dan olib tashlang.`);
    if (!designKeys.has(k)) errors.push(`route-map.json: plannedMenu.${role} dagi \`${k}\` maket menyusida (design/kit/roles.json) yo'q.`);
  }
  const onlyCode = [...codeKeys].filter((k) => !designKeys.has(k));
  const onlyDesign = [...designKeys].filter((k) => !codeKeys.has(k) && !planned.has(k));
  if (onlyCode.length || onlyDesign.length) {
    errors.push(`${role} menyusi maketdan farq qiladi (design/kit/roles.json ↔ ${MENU_FILE}): ` +
      `${onlyCode.length ? `kodda bor, maketda yo'q: ${onlyCode.join(', ')}` : ''}${onlyCode.length && onlyDesign.length ? '; ' : ''}` +
      `${onlyDesign.length ? `maketda bor, kodda yo'q: ${onlyDesign.join(', ')}` : ''}. Menyu bandi faqat maket bilan birga qo'shiladi yoki olinadi (ega qarori).`);
  }
}
const menuLabel = (role, key) => ROLES.roles[role]?.menu?.find((m) => m.key === key)?.label ?? key;

// ───────────── 2. Maketlar va xaritani tekshirish ─────────────
const stemOf = (v) => (v.role === 'tizim' && v.viewId === 'main' ? 'Main' : `${v.role}-${v.viewId}`);
const keyOf = (role, viewId) => `${role}-${viewId}`;
const viewByKey = new Map(VIEWS.map((v) => [keyOf(v.role, v.viewId), v]));
const fragMeta = {};
for (const v of VIEWS) {
  for (const ext of ['html', 'json']) if (!existsSync(join(DESIGN, 'fragments', `${v.fragment}.${ext}`))) errors.push(`views.json: ${keyOf(v.role, v.viewId)} fragmenti yo'q: design/fragments/${v.fragment}.${ext}`);
  try { fragMeta[v.fragment] ??= JSON.parse(readFileSync(join(DESIGN, 'fragments', `${v.fragment}.json`), 'utf8')); } catch { fragMeta[v.fragment] = {}; }
}
const VIEW_ROLE_KEYS = new Set([...ROLE_ORDER, 'common', 'tizim']);
const sections = new Map(MAP.sections.map((s) => [s.id, s]));
const mapByPath = new Map();
const usedBy = new Map(); // view kaliti → [route path]
for (const r of MAP.routes) {
  if (mapByPath.has(r.path)) errors.push(`route-map.json: \`${r.path}\` ikki marta yozilgan.`);
  mapByPath.set(r.path, r);
  if (!sections.has(r.section)) errors.push(`route-map.json: \`${r.path}\` — noma'lum section \`${r.section}\`.`);
  for (const f of r.components ?? []) if (!fileExists(f)) errors.push(`route-map.json: \`${r.path}\` — fayl topilmadi: ${f}`);
  for (const [role, ids] of Object.entries(r.views ?? {})) {
    if (!VIEW_ROLE_KEYS.has(role)) { errors.push(`route-map.json: \`${r.path}\` — noma'lum rol \`${role}\`.`); continue; }
    for (const id of ids) {
      const k = keyOf(role, id);
      if (!viewByKey.has(k)) errors.push(`route-map.json: \`${r.path}\` — maket \`${k}\` views.json da yo'q.`);
      else usedBy.set(k, [...(usedBy.get(k) ?? []), r.path]);
    }
  }
}
// routes.tsx ↔ route-map.json
for (const rec of records.values()) {
  if (rec.redirect) continue;
  const entry = mapByPath.get(rec.path);
  if (!entry) { errors.push(`routes.tsx dagi \`${rec.path}\` route-map.json da yo'q — route, fayllar va rol → maketni qo'shing.`); continue; }
  for (const c of rec.comps) if (!(entry.components ?? []).includes(c.file)) errors.push(`route-map.json: \`${rec.path}\` — routes.tsx dagi asosiy fayl \`${c.file}\` (${c.name}) components ro'yxatida yo'q.`);
  for (const g of rec.guards) if (!MAP.guards[g]) errors.push(`route-map.json: guard \`${g}\` (${rec.path}) guards bo'limida yo'q — rollarini yozing.`);
}
for (const r of MAP.routes) {
  if (r.redirectsTo && !mapByPath.has(r.redirectsTo)) errors.push(`route-map.json: \`${r.path}\` — redirectsTo \`${r.redirectsTo}\` xaritada yo'q.`);
  if (r.path.startsWith('(')) continue;
  const rec = records.get(r.path);
  if (!rec) errors.push(`route-map.json dagi \`${r.path}\` routes.tsx da topilmadi (o'chirilgan yoki nomi o'zgargan).`);
  else if (rec.redirect) errors.push(`route-map.json dagi \`${r.path}\` routes.tsx da yo'naltirish (→ ${rec.redirect}) — xaritadan olib tashlang.`);
}
// Har maket biror route'ga bog'langan bo'lishi kerak (tizim taxtalari — alohida bo'lim).
for (const v of VIEWS) {
  const k = keyOf(v.role, v.viewId);
  if (v.role === 'tizim') { if (!MAP.tizim?.[v.viewId]) errors.push(`route-map.json: tizim taxtasi \`${v.viewId}\` uchun «tizim» tavsifi yo'q.`); continue; }
  if (!usedBy.has(k)) errors.push(`Maket \`${k}\` («${v.title}») hech qaysi route'ga bog'lanmagan — route-map.json da joyini ko'rsating (kodda yo'q bo'lsa newViews ga ham).`);
}
for (const [kind, obj] of [['newViews', MAP.newViews], ['partialViews', MAP.partialViews], ['viewFiles', MAP.viewFiles]]) {
  for (const k of Object.keys(obj ?? {})) if (k !== '$comment' && !viewByKey.has(k)) errors.push(`route-map.json: ${kind} dagi \`${k}\` views.json da yo'q.`);
}
for (const k of Object.keys(MAP.newViews ?? {})) if (MAP.partialViews?.[k]) errors.push(`route-map.json: \`${k}\` ham newViews, ham partialViews da — bittasini qoldiring.`);
const viewFilesOf = (k) => { const v = MAP.viewFiles?.[k]; return v ? (Array.isArray(v) ? v : [v]) : []; };
for (const k of Object.keys(MAP.viewFiles ?? {})) {
  if (k === '$comment') continue;
  for (const f of viewFilesOf(k)) if (!fileExists(f)) errors.push(`route-map.json: viewFiles \`${k}\` — fayl topilmadi: ${f}`);
}

// Rollar: guard zanjiri kesishmasi (yoki route-map dagi qo'lda `roles`).
function rolesOf(entry, rec) {
  if (entry.roles) return entry.roles;
  if (entry.public || (rec && !rec.authed)) return null; // kirishsiz
  let set = Object.fromEntries(ROLE_ORDER.map((r) => [r, '']));
  for (const g of rec?.guards ?? []) {
    const def = MAP.guards[g];
    if (!def) continue;
    const next = {};
    for (const r of Object.keys(set)) if (r in def.roles) next[r] = [...new Set([set[r], def.roles[r]].filter(Boolean))].join(' ∩ ');
    set = next;
  }
  return set;
}
for (const r of MAP.routes) {
  const roles = rolesOf(r, records.get(r.path));
  for (const role of Object.keys(r.views ?? {})) {
    if (role === 'common' || role === 'tizim') continue;
    if (roles && !(role in roles)) errors.push(`route-map.json: \`${r.path}\` — \`${role}\` maketi bor, lekin guard bu rolni o'tkazmaydi.`);
  }
}

// Holat: route-map `status` yoki sahifa faylining birinchi qatoridagi `// dizayn-v2: <ekran>` belgisi.
// Maketsiz v2 sahifa: `// dizayn-v2: (maket yo'q) <eng yaqin ekran>` — eng yaqin ekran nomi tekshiriladi.
const MARKER = /^\s*\/\/\s*dizayn-v2:\s*(.+)$/;
const NO_MOCKUP = /^\(maket yo['‘’ʻ]q\)\s*/i;
function markerOf(file) {
  if (!fileExists(file) || !/\.(tsx?|jsx?)$/.test(file)) return null;
  const first = readFileSync(join(ROOT, file), 'utf8').split('\n').find((l) => l.trim() !== '');
  const m = first && first.match(MARKER);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : null;
}
const statusOf = new Map();
for (const r of MAP.routes) {
  const rec = records.get(r.path);
  const entryFiles = rec?.comps.length ? rec.comps.map((c) => c.file) : (r.components ?? []).slice(0, 1);
  const marks = entryFiles.map(markerOf);
  const marked = marks.length > 0 && marks.every(Boolean);
  for (const ms of marks.filter(Boolean)) for (const raw of ms) for (const s of [raw.replace(NO_MOCKUP, '')]) if (!viewByKey.has(s) && s !== 'Main' && s !== 'shell' && !VIEWS.some((v) => stemOf(v) === s)) warnings.push(`\`// dizayn-v2:\` belgisida noma'lum ekran \`${s}\` (${r.path}).`);
  if (r.status === 'v2' && !marked) warnings.push(`\`${r.path}\`: route-map da status v2, lekin asosiy faylda \`// dizayn-v2:\` belgisi yo'q.`);
  statusOf.set(r.path, r.status === 'v2' || marked ? 'v2' : 'eski');
}

// ───────────── 3. Markdown ─────────────
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s) => `\`${s}\``;
const KIND = { page: 'sahifa', dialog: 'oyna', standalone: 'taxta' };
const DEV = { desktop: 'desktop', tablet: 'planshet', phone: 'telefon' };
const kindLabel = (v) => {
  const devs = fragMeta[v.fragment]?.devices;
  return KIND[v.kind] + (devs && !devs.includes('desktop') ? ` · faqat ${devs.map((d) => DEV[d]).join(' + ')}` : '');
};
const fragLink = (v) => `[design/fragments/${v.fragment}.html](fragments/${v.fragment}.html)`;
const roleLabel = (r) => (r === 'common' ? 'umumiy' : r);
const rolesText = (roles) => {
  if (roles === null) return 'hamma (kirishsiz)';
  const list = ROLE_ORDER.filter((r) => r in roles).map((r) => (roles[r] ? `${r} (${roles[r]})` : r));
  return list.length ? list.join(', ') : "hech kim (yopiq)";
};
const viewStatus = (k, routeStatus) => (MAP.newViews?.[k] ? 'yangi (kodda yo\'q)' : MAP.partialViews?.[k] ? 'qisman' : routeStatus);
const countViews = (r) => Object.values(r.views ?? {}).reduce((n, ids) => n + ids.length, 0);

const codeHint = (k) => (viewFilesOf(k).length ? `<br>↳ ${viewFilesOf(k).map(code).join(', ')}` : '');
function menuText(path) {
  const items = menuByPath.get(path) ?? [];
  if (!items.length) return `yo'q — ${mapByPath.get(path)?.entry ?? "sahifa ichidagi havola yoki URL orqali ochiladi"}`;
  const byKey = new Map();
  for (const it of items) {
    const label = `«${menuLabel(it.role, it.key)}» (\`${it.key}\`${it.via ? `, \`${it.via}\` orqali` : ''})`;
    byKey.set(label, [...(byKey.get(label) ?? []), it.cond ? `${it.role} (${it.cond})` : it.role]);
  }
  return [...byKey].map(([label, rs]) => `${label} — ${rs.join(', ')}`).join('; ');
}

const L = [];
const nonTizim = VIEWS.filter((v) => v.role !== 'tizim');
const newCount = Object.keys(MAP.newViews ?? {}).length;
const partialCount = Object.keys(MAP.partialViews ?? {}).length;
const routeEntries = MAP.routes.filter((r) => !r.path.startsWith('('));
const v2Count = routeEntries.filter((r) => statusOf.get(r.path) === 'v2').length;
const kinds = VIEWS.reduce((m, v) => ((m[v.kind] = (m[v.kind] ?? 0) + 1), m), {});

L.push('# Ekranlar xaritasi — route ↔ dizayn v2 maketi', '');
L.push('> **Avtomatik yaratilgan fayl — qo\'lda tahrirlamang.** Manba: `design/kit/route-map.json` (route ↔ maket, qo\'lda',
  '> yuritiladi), `src/app/lib/routes.tsx` (yo\'llar va guardlar), `design/kit/views.json` (maketlar). Qayta yaratish:',
  '> `npm run design:screens`; tekshirish: `npm run design:screens -- --check`.', '');
L.push(`**${routeEntries.length} ta route** (+ qobiq) · **${VIEWS.length} ta maket** (${kinds.page ?? 0} sahifa, ${kinds.dialog ?? 0} oyna, ${kinds.standalone ?? 0} tizim taxtasi; ` +
  `${new Set(VIEWS.map((v) => v.fragment)).size} ta fragment fayli) · kodda yo'q: **${newCount}** · qisman: **${partialCount}** · v2 ga ko'chirilgan route: **${v2Count} / ${routeEntries.length}**`, '');

L.push('## Qanday ishlatiladi', '');
L.push('1. **Route\'ni toping.** Brauzerdagi manzil yoki tegayotgan fayl bo\'yicha qidiring:',
  '   `grep -n "src/pages/mails/detail" design/SCREENS.md` yoki `grep -n "/mails/:id" design/SCREENS.md`.',
  '   Fayl qaysi route\'ga tegishli ekanini [6-bo\'lim](#6-fayl--route) beradi.',
  '2. **Rolingizni tanlang.** Bir sahifani bir nechta rol ko\'radi va har rolning o\'z maketi bor (`<rol>-<viewId>`);',
  '   o\'sha sahifaning oynalari (dialog) va holatlari ham shu jadvalda. Maketi yo\'q rol uchun eng yaqin maket izohda.',
  '   Kim ocha olishi — «Rollar» (guardlar), kimning menyusida turgani — «Menyuda» qatori va [7-bo\'lim](#7-rol-menyulari--route).',
  '   Maket ostidagi `↳` — o\'sha maketni chizadigan aniq fayl (rolga xos komponent yoki alohida oyna fayli).',
  '3. **Fragmentni oching:** `design/fragments/<fragment>.html` — bo\'limlar tartibi, aniq matnlar, `el-*` klasslar',
  '   (Tailwind + token + komponentga tarjimasi: `design/CODE-MAP.md`). `.json` — tur, balandlik, qurilmalar.',
  '   Fragment nomi ekran nomidan farq qilishi mumkin (bir nechta rol bitta fragmentni bo\'lishadi).',
  '4. **Ko\'ring:** `npm run design:shot -- <rol>-<viewId>` → `design/shots/<ekran>--<desktop|tablet|phone>-<light|dark>.png`',
  '   (Claude PNG\'ni `Read` qiladi). Bitta ko\'rinish: `-- <ekran> --device phone --theme dark`. Hammasi brauzerda:',
  '   `npm run design:preview` (http://127.0.0.1:4199). Tizim taxtalari: `tizim-<nom>`, bosh taxta — `Main`.',
  '5. **Holat ustuni:** `eski` — sahifa hali v2 ga ko\'chirilmagan (tegsangiz, `AGENTS.md` qaror oqimi bo\'yicha);',
  '   `v2` — ko\'chirilgan (asosiy faylning birinchi qatorida `// dizayn-v2: <ekran>`); `yangi (kodda yo\'q)` — maket bor,',
  '   kod hali yo\'q (qayerga qo\'shilishi route ustunida); `qisman` — kodda bir qismi bor (sababi 4-bo\'limda).',
  '6. **Route qo\'shdingiz, o\'chirdingiz yoki sahifani v2 ga ko\'chirdingizmi?** `design/kit/route-map.json` ni yangilang',
  '   (yo\'l, fayllar, rol → maket; ko\'chirilganda faylga `// dizayn-v2:` belgisi) va `npm run design:screens` ni yuring.',
  '   Skript routes.tsx dagi har route xaritada borligini, har maket biror route\'ga bog\'langanini va fayllar mavjudligini',
  '   tekshiradi. Menyu bandlari (`menuConfig.tsx`) maketdagi menyu (`design/kit/roles.json`) bilan bir xil bo\'lishi shart.',
  '   Maket fayllari (`fragments/`, `views.json`, `roles.json`) qo\'lda o\'zgarmaydi — `route-map.json` bundan mustasno.',
  '   Shu tekshiruv `npm test` ichida ham yuradi (`design/tools/screens.test.mjs`), ya\'ni CI\'da majburiy.', '');

L.push('## Mundarija', '',
  '1. [Qisqa jadval: route → maketlar](#1-qisqa-jadval-route--maketlar)',
  '2. [Route bo\'yicha maketlar (batafsil)](#2-route-boyicha-maketlar-batafsil)',
  '3. [Yo\'naltirishlar (eski havolalar)](#3-yonaltirishlar-eski-havolalar)',
  '4. [Maket → kod (teskari, rollar bo\'yicha)](#4-maket--kod-teskari-rollar-boyicha)',
  '5. [Dizayn tizimi taxtalari](#5-dizayn-tizimi-taxtalari)',
  '6. [Fayl → route](#6-fayl--route)',
  '7. [Rol menyulari → route](#7-rol-menyulari--route)', '');

// 1. Qisqa jadval
L.push('## 1. Qisqa jadval: route → maketlar', '');
L.push('| Route | Bo\'lim | Asosiy fayl | Rollar | Maketlar | Holat |', '|---|---|---|---|---|---|');
for (const s of MAP.sections) {
  for (const r of MAP.routes.filter((x) => x.section === s.id)) {
    const rec = records.get(r.path);
    const main = rec?.comps.length ? rec.comps.map((c) => code(c.file)).join(' + ') : code(r.components[0]);
    L.push(`| ${code(cell(r.path))} | ${cell(s.title.split(' — ')[0])} | ${main} | ${cell(rolesText(rolesOf(r, rec)))} | ${countViews(r)} | ${statusOf.get(r.path)} |`);
  }
}
L.push('');

// 2. Batafsil
L.push('## 2. Route bo\'yicha maketlar (batafsil)', '');
L.push('Har route: fayllar (birinchisi — routes.tsx dagi sahifa), guard zanjiri, kim ocha oladi, izoh va **har rol uchun** maketlar.', '');
for (const s of MAP.sections) {
  const rs = MAP.routes.filter((x) => x.section === s.id);
  if (!rs.length) continue;
  L.push(`### ${s.title}`, '');
  for (const r of rs) {
    const rec = records.get(r.path);
    const roles = rolesOf(r, rec);
    const status = statusOf.get(r.path);
    L.push(`#### ${code(r.path)} — ${r.title}`, '');
    L.push(`- **Fayllar:** ${(r.components ?? []).map(code).join(' · ')}`);
    if (rec) {
      const chain = rec.layouts.filter((n) => n !== 'Auth').map((n) => (lazyFiles[n] && !LAYOUT_ONLY.has(n) ? `${n} (${code(lazyFiles[n])})` : n)).join(' › ');
      const layout = [rec.publicToo ? 'qobiqsiz (kirishsiz)' : null, chain || null].filter(Boolean).join(' va ') || '—';
      const guard = rec.guards.length ? rec.guards.map((g) => `${code(g)}${MAP.guards[g]?.source ? ` (${MAP.guards[g].source})` : ''}`).join(' → ') : (rec.publicToo ? "yo'q (kirishsiz)" : "yo'q (faqat kirish)");
      const extra = [rec.wrappers.length ? `o'rovchi: ${rec.wrappers.map(code).join(', ')}` : null, rec.guardRedirect ? `ruxsat bo'lmasa → ${code(rec.guardRedirect)}` : null].filter(Boolean);
      L.push(`- **Qobiq:** ${layout} · **Guard:** ${guard}${extra.length ? ` · ${extra.join(' · ')}` : ''}`);
    }
    L.push(`- **Rollar:** ${rolesText(roles)}`);
    if (!r.path.startsWith('(') && roles !== null) L.push(`- **Menyuda:** ${menuText(r.path)}`);
    L.push(`- **Holat:** ${status}`);
    if (r.note) L.push(`- **Izoh:** ${r.note}`);
    L.push('');
    const rows = [];
    // Rolga xos maketi bor route'da — guard o'tkazgan har rol uchun qator (maketi yo'q rol ham ko'rinsin).
    // Umumiy (common) maketi bor, faqat tizim maketli yoki maketsiz route'da — faqat o'z maketi/izohi bor rollar.
    const hasRoleViews = ROLE_ORDER.some((x) => r.views?.[x]?.length) && !r.views?.common?.length;
    const roleKeys = roles === null || !hasRoleViews ? [] : ROLE_ORDER.filter((x) => x in roles);
    for (const role of ROLE_ORDER.filter((x) => roleKeys.includes(x) || r.views?.[x] || r.roleNotes?.[x])) {
      const ids = r.views?.[role] ?? [];
      if (ids.length) for (const id of ids) {
        const k = keyOf(role, id); const v = viewByKey.get(k); if (!v) continue;
        rows.push(`| ${code(cell(r.path))} | ${role} | ${code(stemOf(v))} — ${cell(v.title)}${codeHint(k)} | ${fragLink(v)} | ${kindLabel(v)} | ${viewStatus(k, status)} |`);
      } else rows.push(`| ${code(cell(r.path))} | ${role} | — ${cell(r.roleNotes?.[role] ?? "maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos")} | — | — | ${status} |`);
    }
    for (const role of ['common', 'tizim']) for (const id of r.views?.[role] ?? []) {
      const k = keyOf(role, id); const v = viewByKey.get(k); if (!v) continue;
      rows.push(`| ${code(cell(r.path))} | ${role === 'tizim' ? 'tizim taxtasi' : 'umumiy (barcha rollar)'} | ${code(stemOf(v))} — ${cell(v.title)}${codeHint(k)} | ${fragLink(v)} | ${kindLabel(v)} | ${role === 'tizim' ? 'qoida' : viewStatus(k, status)} |`);
    }
    if (rows.length) L.push('| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |', '|---|---|---|---|---|---|', ...rows, '');
  }
}

// 3. Yo'naltirishlar
L.push('## 3. Yo\'naltirishlar (eski havolalar)', '');
L.push('Bu yo\'llar sahifa emas — routes.tsx ularni yangi joyga yo\'naltiradi (xatcho\'p va tashqi havolalar buzilmasin). Maket — yangi joyniki.', '');
L.push('| Eski yo\'l | → Yangi joy | Guard |', '|---|---|---|');
for (const rec of [...records.values()].filter((x) => x.redirect)) L.push(`| ${code(cell(rec.path))} | ${code(cell(rec.redirect))} | ${rec.guards.map(code).join(' → ') || '—'} |`);
L.push('');

// 4. Teskari
L.push('## 4. Maket → kod (teskari, rollar bo\'yicha)', '');
L.push('Har maket qaysi route/faylda yashaydi. `yangi (kodda yo\'q)` — maket chizilgan, kod hali yo\'q: route ustuni u qayerga qo\'shilishini ko\'rsatadi.', '');
for (const role of [...ROLE_ORDER, 'common']) {
  const vs = VIEWS.filter((v) => v.role === role);
  if (!vs.length) continue;
  const label = role === 'common' ? 'umumiy ekranlar (common — barcha rollar)' : `${role} — ${ROLES.roles[role]?.label ?? role}`;
  const built = vs.filter((v) => !MAP.newViews?.[keyOf(v.role, v.viewId)]).length;
  L.push(`### ${label}`, '', `${vs.length} ta maket · kodda bor: ${built} · kodda yo'q: ${vs.length - built}`, '');
  L.push('| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |', '|---|---|---|---|---|---|');
  for (const v of vs) {
    const k = keyOf(v.role, v.viewId);
    const paths = usedBy.get(k) ?? [];
    const files = viewFilesOf(k).length ? viewFilesOf(k) : [...new Set(paths.map((p) => { const rec = records.get(p); return rec?.comps.length ? rec.comps.map((c) => c.file).join(' + ') : mapByPath.get(p)?.components?.[0]; }).filter(Boolean))];
    const st = MAP.newViews?.[k] ? `yangi (kodda yo'q) — ${MAP.newViews[k]}` : MAP.partialViews?.[k] ? `qisman — ${MAP.partialViews[k]}` : [...new Set(paths.map((p) => statusOf.get(p)))].join(', ');
    L.push(`| ${code(stemOf(v))} | ${cell(v.title)} | ${kindLabel(v)} | ${paths.map((p) => code(cell(p))).join(', ') || '—'} | ${files.map(code).join(', ') || '—'} | ${cell(st)} |`);
  }
  L.push('');
}

// 5. Tizim
L.push('## 5. Dizayn tizimi taxtalari', '');
L.push('Sahifa emas — qoidalar va komponent holatlari. Har UI ishida tegishli taxtani ko\'ring (`npm run design:shot -- <taxta>`).', '');
L.push('| Taxta | Sarlavha | Nimani belgilaydi | Kodda | Qayerda qo\'llanadi |', '|---|---|---|---|---|');
for (const v of VIEWS.filter((x) => x.role === 'tizim')) {
  const t = MAP.tizim?.[v.viewId] ?? {};
  const where = (usedBy.get(keyOf('tizim', v.viewId)) ?? []).map((p) => code(cell(p))).join(', ') || 'barcha sahifalar';
  L.push(`| ${code(stemOf(v))} | ${cell(v.title)} | ${cell(t.defines)} | ${cell(t.code)} | ${where} |`);
}
L.push('');

// 6. Fayl → route
L.push('## 6. Fayl → route', '');
L.push('Tegayotgan fayl qaysi route(lar)ga tegishli — o\'sha route\'ning maketlarini 2-bo\'limdan oling.', '');
const byFile = new Map();
for (const r of MAP.routes) for (const f of r.components ?? []) byFile.set(f, [...(byFile.get(f) ?? []), r.path]);
for (const k of Object.keys(MAP.viewFiles ?? {})) for (const f of viewFilesOf(k)) for (const p of usedBy.get(k) ?? []) if (!(byFile.get(f) ?? []).includes(p)) byFile.set(f, [...(byFile.get(f) ?? []), p]);
L.push('| Fayl | Route(lar) |', '|---|---|');
for (const f of [...byFile.keys()].sort()) L.push(`| ${code(f)} | ${byFile.get(f).map((p) => code(cell(p))).join(', ')} |`);
L.push('');

// 7. Rol menyulari
L.push('## 7. Rol menyulari → route', '');
L.push(`Manba: \`${MENU_FILE}\` (kod) va \`design/kit/roles.json\` (maketdagi menyu, yorliq va guruh). Ikkalasidagi bandlar to'plami bir xil bo'lishi shart — skript tekshiradi. ` +
  'Maketda bandlar guruhlangan (Ish, Moliya …), shuning uchun tartib farq qilishi mumkin. Menejer menyusi filial turiga qarab (`MANAGER_CAPABILITIES`), ' +
  'registratorning «Biriktirish» bandi ham (`getSidebarConfigForUser`).', '');
for (const role of ROLE_ORDER) {
  const items = MENU[role] ?? [];
  const plannedItems = MAP.plannedMenu?.[role] ?? [];
  if (!items.length && !plannedItems.length) continue;
  L.push(`### ${role} — ${ROLES.roles[role]?.label ?? role}`, '');
  if (items.length) {
    L.push(`| Band | Kalit | \`to\` | Route | Shart (filial turi) | ${role} maketlari |`, '|---|---|---|---|---|---|');
    for (const it of items) {
      const ids = mapByPath.get(it.target)?.views?.[role] ?? [];
      const first = ids.length ? code(keyOf(role, ids[0])) + (ids.length > 1 ? ` (+${ids.length - 1})` : '') : (mapByPath.get(it.target)?.roleNotes?.[role] ? 'izohga qarang' : '—');
      L.push(`| ${cell(menuLabel(role, it.key))} | ${code(it.key)} | ${code(it.to)} | ${it.target ? code(it.target) : '—'} | ${it.cond || (role === 'manager' ? 'barchasi' : '—')} | ${first} |`);
    }
    L.push('');
  }
  if (plannedItems.length) L.push(`Maketda bor, kodda hali yo'q (\`plannedMenu\`): ${plannedItems.map((k) => `${cell(menuLabel(role, k))} (${code(k)})`).join(', ')}.`, '');
}

const md = `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;

// ───────────── 4. Natija ─────────────
for (const w of warnings) console.warn(`ogohlantirish: ${w}`);
if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : ''; // Windows checkout (autocrlf) ham o'tsin
  if (cur !== md) errors.push('design/SCREENS.md eskirgan — `npm run design:screens` ni yuring va natijani commit qiling.');
} else {
  writeFileSync(OUT, md);
  console.log(`design/SCREENS.md yozildi: ${routeEntries.length} route, ${VIEWS.length} maket (${nonTizim.length} ekran + ${VIEWS.length - nonTizim.length} taxta), kodda yo'q ${newCount}, qisman ${partialCount}.`);
}
if (errors.length) {
  console.error(`\n${errors.length} ta xato:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
if (CHECK) console.log('design/SCREENS.md yangi, xarita to\'liq.');
