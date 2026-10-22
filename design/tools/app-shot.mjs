// Ilova skrinshoti — HAQIQIY ilova route'larini ko'rish uchun (odam ham, Claude ham: PNG'ni Read qiladi).
// Haqiqiy akkaunt va backend KERAK EMAS: Vite shu jarayon ichida ishga tushadi, API so'rovlari brauzerda
// ushlanib bo'sh (lekin to'g'ri shakldagi) JSON bilan javob beriladi, sessiya soxta token bilan ochiladi.
//
//   npm run app:shot -- /ops/ui-kit                                   (6 PNG: desktop/tablet/phone × light/dark)
//   npm run app:shot -- "/ops/ui-kit?section=buttons" --device phone --theme dark
//   npm run app:shot -- /orders /mails --role manager --lang ru
//   npm run app:shot -- /ops/ui-kit --device phone --split 1200      (uzun sahifa: + -1.png, -2.png … bo'laklar)
//   npm run app:shot -- / /orders --role manager --branch-type REGIONAL  (menejer/kuryer/registrator menyusi filial turiga bog'liq)
//
// Bayroqlar: --device desktop|tablet|phone · --theme light|dark · --role superadmin|admin|manager|registrator|market|courier|logist|market_operator|investor
//            (sukut superadmin) · --lang uz|ru|en (sukut uz) · --split <px>
//            · --branch-type HQ|REGIONAL|HYBRID|PICKUP — profildagi filial turi (`menuConfig.tsx` →
//              `getUserBranchType`). Sukut: manager HYBRID (maketdagi to'liq menyu), registrator HQ, courier REGIONAL;
//              boshqa rollarda filial yo'q. `--branch-type none` — filial turi aniqlanmagan holat (menejer ogohlantirishi).
//            · --wait <css-selektor> (shu element chiqquncha kutadi; sukut: <main> ichida kontent)
//            · --width <px> — qurilma oynasining kengligi (masalan 375 telefon, 1024 kichik desktop); balandlik va
//              sensorli rejim `--device` dan qoladi. Fayl nomiga `-w<px>` qo'shiladi.
// Natija: design/shots/app/<route>--<qurilma>-<mavzu>.png (rol/til sukutdan farq qilsa nomga qo'shiladi:
// <route>-<rol>[-<filial turi>]-<til>--…; filial turi faqat sukutdan farq qilsa). design/shots git'ga kirmaydi.
// Har shot uchun JSON hisobot:
//   finalPath        — yo'naltirishdan keyingi yo'l (/403 yoki /login bo'lsa — guard o'tkazmadi)
//   overflowX        — documentElement.scrollWidth − innerWidth (0 bo'lishi kerak)
//   contentOverflowX — <main> ichidagi gorizontal toshish (qobiq h-dvh, kontent <main> ichida aylanadi)
//   smallTargets     — faqat telefonda: 44px dan kichik ko'rinadigan bosiladigan elementlar (jami va <main> ichida + namuna)
//   tinyText         — 12px dan kichik matnli elementlar (jami va <main> ichida)
//   consoleErrors    — konsol xatolari va ushlanmagan istisnolar
// Qobiq (yon menyu, yuqori panel, pastki menyu) 2-bosqichda v2 ga o'tkaziladi; sahifaning o'zi uchun `…InMain` sonlariga qarang.
// Rasm olishdan oldin yuqori chiziq (`[data-route-progress]`, bo'lim yuklanishi) yo'qolishi kutiladi.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DESIGN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DESIGN, '..');
const OUT_DIR = join(DESIGN, 'shots', 'app');

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 768, height: 1024 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const THEMES = ['light', 'dark'];
// Yangi rollar (ROL-0): logist, market_operator, investor — qobiq, 403 va pastki menyuni ko'rish uchun.
const ROLES = ['superadmin', 'admin', 'manager', 'registrator', 'market', 'courier', 'logist', 'market_operator', 'investor'];
const LANGS = ['uz', 'ru', 'en'];
const BRANCH_TYPES = ['HQ', 'REGIONAL', 'HYBRID', 'PICKUP'];
/** Rol → sukut filial turi (maketdagi persona menyusi: menejer — to'liq, registrator — «Toshkent HQ»). */
const DEFAULT_BRANCH_TYPE = { manager: 'HYBRID', registrator: 'HQ', courier: 'REGIONAL' };
/** API yo'qligini bildiruvchi soxta manzil — hech qachon tarmoqqa chiqmaydi, brauzerda ushlanadi. */
const MOCK_API = 'http://api.app-shot.test';

// ───────────── argumentlar ─────────────
const args = process.argv.slice(2);
const FLAGS = ['--device', '--theme', '--role', '--lang', '--split', '--wait', '--branch-type', '--width'];
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const fail = (message) => { console.error(message); process.exit(1); };
const device = opt('--device');
const theme = opt('--theme');
const role = opt('--role') ?? 'superadmin';
const lang = opt('--lang') ?? 'uz';
const split = Number(opt('--split')) || 0;
const waitFor = opt('--wait');
const branchTypeArg = opt('--branch-type');
const widthArg = opt('--width');
const width = widthArg ? Number(widthArg) : 0;
const branchType = branchTypeArg === 'none' ? null : (branchTypeArg ?? DEFAULT_BRANCH_TYPE[role] ?? null);
const routes = args.filter((a, i) => !a.startsWith('--') && !FLAGS.includes(args[i - 1]));
if (!routes.length) fail("Route bering, masalan: npm run app:shot -- /ops/ui-kit [--device phone] [--theme dark]");
if (device && !DEVICES[device]) fail(`--device: ${Object.keys(DEVICES).join(' | ')}`);
if (theme && !THEMES.includes(theme)) fail(`--theme: ${THEMES.join(' | ')}`);
if (!ROLES.includes(role)) fail(`--role: ${ROLES.join(' | ')}`);
if (!LANGS.includes(lang)) fail(`--lang: ${LANGS.join(' | ')}`);
if (branchTypeArg && branchTypeArg !== 'none' && !BRANCH_TYPES.includes(branchTypeArg)) fail(`--branch-type: ${BRANCH_TYPES.join(' | ')} | none`);
if (widthArg && !(Number.isInteger(width) && width >= 320 && width <= 3840)) fail('--width: 320…3840 oralig\'idagi butun son (px)');
for (const r of routes) if (!r.startsWith('/')) fail(`Route "/" bilan boshlanadi: ${r}`);

const slugOf = (route) => {
  const base = route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home';
  const branchSlug = branchTypeArg && branchType !== (DEFAULT_BRANCH_TYPE[role] ?? null) && (branchType ?? 'none').toLowerCase();
  return [base, role !== 'superadmin' && role, branchSlug, lang !== 'uz' && lang].filter(Boolean).join('-');
};

// ───────────── soxta API ─────────────
// Ro'yxat qaytaradigan endpointlar (`data: []`); qolganlari sahifalangan obyekt.
const ARRAYISH = /(^|\/)(regions?|districts?|markets?|couriers?|branches|categories|tariffs|sato|logists?|sources|partners|statuses|roles)(\/|$|\?)/;
/** Ro'yxat endpointi (`GET orders`) — tanasi `{ data: [], meta }` (sahifa `data.data` ni massiv deb o'qiydi). */
const ARRAY_LIST = /(^|\/)orders$/;
const profile = (themeName) => ({
  statusCode: 200,
  data: {
    id: '1',
    role,
    name: 'Ilova skrinshoti',
    phone_number: '+998900000000',
    status: 'active',
    settings: { appearance: { theme: themeName, themeChosen: true, language: lang } },
    // Filial turi: menejer/registrator menyusi va guardlari shundan (`getUserBranchType` o'qiydigan shakllar).
    ...(branchType
      ? { branch_id: '1', branch_type: branchType, branch: { id: '1', name: 'Namuna filiali', type: branchType, branch_type: branchType } }
      : {}),
  },
});
/**
 * IN-1: investor kabineti (`investors/me/*`) — maketdagi namunaviy qiymatlar (`investor-dashboard-home`), oylar joriy
 * oydan orqaga hisoblanadi: shunda bosh sahifa bo'sh holat emas, to'liq ko'rinishda chiziladi.
 */
const investorMock = (path) => {
  const now = new Date();
  const key = (back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const paid = [0, 0, 2.4, 3.1, 3.6, 4.4, 5, 5.3, 4.9, 5.6, 0, 0];
  if (path.startsWith('investors/me/dashboard')) {
    const items = Array.from({ length: 12 }, (_, i) => {
      const p = paid[i] * 1_000_000;
      const u = i === 10 ? 6_200_000 : 0;
      return { month: key(11 - i), paid_amount: p, unpaid_amount: u, total_amount: p + u };
    });
    return {
      statusCode: 200,
      data: {
        investor: { id: '7', name: 'Habibulla Nazirov', status: 'active' },
        summary: {
          total_invested: 450_000_000, investments_count: 5, last_invested_at: '2026-08-01T00:00:00+05:00',
          total_paid_profit: 34_300_000, total_unpaid_profit: 6_200_000, total_profit: 40_500_000,
          profit_shares_count: 9, current_percentage: 12.5, last_paid_at: '2026-09-05T10:00:00+05:00',
        },
        monthly: { months: 12, items },
      },
    };
  }
  if (path.startsWith('investors/me/investments')) {
    const rows = [['2026-08-01', 100_000_000], ['2026-06-20', 50_000_000], ['2026-04-12', 100_000_000]];
    return {
      statusCode: 200,
      data: {
        items: rows.map(([date, amount], i) => ({ id: String(i + 1), amount, invested_at: `${date}T00:00:00+05:00` })),
        meta: { page: 1, limit: 3, total: 5, totalPages: 2 },
        summary: { total_amount: 450_000_000 },
      },
    };
  }
  if (path.startsWith('investors/me/profits')) {
    const rows = [[9, 30, 6_200_000, null], [8, 31, 5_600_000, '2026-09-05'], [7, 31, 4_900_000, '2026-08-05'], [6, 30, 5_300_000, '2026-07-05'], [5, 31, 5_000_000, '2026-06-05']];
    const mm = (m) => String(m).padStart(2, '0');
    return {
      statusCode: 200,
      data: {
        items: rows.map(([m, last, amount, paidAt], i) => ({
          id: String(20 - i), amount, percentage: 12.5,
          period_start: `2026-${mm(m)}-01T00:00:00+05:00`, period_end: `2026-${mm(m)}-${last}T23:59:59+05:00`,
          is_paid: paidAt != null, paid_at: paidAt ? `${paidAt}T10:00:00+05:00` : null,
        })),
        meta: { page: 1, limit: 5, total: 9, totalPages: 2 },
        summary: { total_paid_amount: 34_300_000, total_unpaid_amount: 6_200_000 },
      },
    };
  }
  return null;
};

/**
 * EP-3: `GET auth/sessions` — profil «Sessiyalar» kartasi to'liq ko'rinishda (bo'sh holat emas): shu qurilma,
 * boshqa kompyuter va nomi aniqlanmagan qurilma. Vaqtlar «hozir» dan orqaga hisoblanadi (sintetik ma'lumot).
 */
const sessionsMock = () => {
  const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
  const row = (id, device_name, ip, loggedMin, seenMin, current = false, user_agent = null) => ({
    id, device_name, device_id: null, user_agent, ip, logged_in_at: ago(loggedMin), last_seen_at: ago(seenMin),
    expires_at: ago(-24 * 60), current,
  });
  return {
    statusCode: 200,
    message: 'success',
    data: {
      active_count: 3,
      sessions: [
        row('s-2', 'Kompyuter · Windows · Edge', '84.54.70.12', 2 * 24 * 60 + 95, 7),
        row('s-1', 'Telefon · Android · Chrome', '213.230.64.10', 26 * 60, 42, true),
        row('s-3', null, null, 5 * 24 * 60, 3 * 24 * 60, false, 'PostmanRuntime/7.39.0'),
      ],
    },
  };
};

const mockBody = (path, themeName) => {
  if (path.endsWith('auth/my-profile')) return profile(themeName);
  if (path === 'auth/sessions') return sessionsMock();
  if (role === 'investor' && path.startsWith('investors/me')) return investorMock(path) ?? { statusCode: 200, data: {} };
  if (ARRAYISH.test(path)) return { statusCode: 200, data: [] };
  if (ARRAY_LIST.test(path)) return { statusCode: 200, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 }, total: 0 };
  return { statusCode: 200, data: { items: [], data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 }, total: 0 } };
};

// ───────────── Vite (shu jarayon ichida) ─────────────
// .env fayllaridagi qiymatdan ustun: ilova haqiqiy backendga emas, soxta manzilga murojaat qiladi.
process.env.VITE_BASE_URL = MOCK_API;
process.env.VITE_USE_POLLING = 'false';
/** Bo'sh port (ishlab turgan `npm run dev` bilan to'qnashmasin). */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  clearScreen: false,
  server: { host: '127.0.0.1', port: await freePort(), strictPort: false },
});
await server.listen();
const BASE = `http://127.0.0.1:${server.httpServer.address().port}`;

// ───────────── o'lchovlar (brauzerda) ─────────────
/** Ichki skroll konteynerini (qobiq h-dvh, kontent <main> ichida) to'liq ko'rsatish uchun oyna balandligi. */
const fullHeight = () => {
  const main = document.querySelector('main');
  const extra = main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  return Math.max(document.documentElement.scrollHeight, window.innerHeight + extra);
};

const measure = (isPhone) => {
  const main = document.querySelector('main');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false; // sr-only
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} «${name}» ${Math.round(r.width)}×${Math.round(r.height)}`;
  };
  const textEls = [...document.body.querySelectorAll('*')].filter(
    (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && visible(el),
  );
  const tiny = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12);
  const report = {
    finalPath: location.pathname + location.search,
    overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    contentOverflowX: main ? Math.max(0, main.scrollWidth - main.clientWidth) : null,
    tinyText: tiny.length,
    tinyTextInMain: main ? tiny.filter((el) => main.contains(el)).length : null,
  };
  // Qobiqdagi (<main> tashqarisidagi) mayda matn — 2-bosqich qobig'i uchun 0 bo'lishi kerak.
  const tinyShell = main ? tiny.filter((el) => !main.contains(el)) : [];
  if (tinyShell.length) report.tinyTextShellSample = tinyShell.slice(0, 8).map(describe);
  if (isPhone) {
    const targets = [
      ...document.querySelectorAll(
        'a[href], button, [role=button], [role=tab], [role=radio], [role=switch], [role=checkbox], input:not([type=hidden]), select, textarea, summary',
      ),
    ].filter(visible);
    const small = targets.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    });
    const inMain = main ? small.filter((el) => main.contains(el)) : small;
    report.smallTargets = small.length;
    report.smallTargetsInMain = inMain.length;
    report.smallTargetsSample = inMain.slice(0, 8).map(describe);
    const shellSmall = main ? small.filter((el) => !main.contains(el)) : [];
    if (shellSmall.length) report.smallTargetsShellSample = shellSmall.slice(0, 8).map(describe);
  }
  return report;
};

/** Sahifa tinchlanguncha kutadi (Vite birinchi ochilishda bog'liqliklarni optimallashtirib qayta yuklashi mumkin). */
const settle = async (page, navCount) => {
  for (let i = 0; i < 4; i += 1) {
    const before = navCount();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForTimeout(700);
    if (navCount() === before) return;
  }
};

// ───────────── skrinshotlar ─────────────
mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const devices = device ? [device] : Object.keys(DEVICES);
const themes = theme ? [theme] : THEMES;
const results = [];
try {
  for (const themeName of themes) {
    for (const deviceName of devices) {
      const base = DEVICES[deviceName];
      const spec = width ? { ...base, viewport: { ...base.viewport, width } } : base;
      const context = await browser.newContext({ ...spec, deviceScaleFactor: 1 });
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === BASE) return route.continue();
        if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.continue();
        const isApi = url.origin === MOCK_API || ['xhr', 'fetch'].includes(request.resourceType());
        if (!isApi) return route.abort();
        const headers = {
          'access-control-allow-origin': BASE,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const body = mockBody(url.pathname.replace(/^\//, ''), themeName);
        return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(body) });
      });
      await context.addInitScript(({ themeName, lang, role }) => {
        const far = Date.now() + 86_400_000;
        try {
          if (!location.pathname.startsWith('/login')) {
            sessionStorage.setItem('accessToken', 'e2e.local.token');
            sessionStorage.setItem(
              'authSessionMetadata',
              JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
            );
            sessionStorage.setItem('role', role);
          }
          localStorage.setItem('theme', themeName);
          localStorage.setItem('theme-version', '2');
          localStorage.setItem('app-language', lang);
        } catch {
          /* saqlash yopiq bo'lsa ham sahifa ochiladi */
        }
      }, { themeName, lang, role });

      const page = await context.newPage();
      let navigations = 0;
      page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });
      let errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)); });
      page.on('pageerror', (error) => errors.push(`pageerror: ${String(error.message ?? error).slice(0, 300)}`));

      for (const route of routes) {
        errors = [];
        await page.setViewportSize(spec.viewport);
        await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push(`goto: ${e.message}`));
        await settle(page, () => navigations);
        // Yuklanish ekranini (splash) suratga olmaslik: kontent chiqquncha kutamiz. Kelmasa — ogohlantirish, xato emas.
        const ready = await page
          .waitForFunction(
            (selector) => {
              if (selector) return Boolean(document.querySelector(selector));
              const main = document.querySelector('main');
              return Boolean(main && main.querySelectorAll('*').length > 5 && main.innerText.trim().length > 0);
            },
            waitFor,
            { timeout: 30000 },
          )
          .then(() => true)
          .catch(() => false);
        if (!ready) errors.push(`wait: ${waitFor ?? '<main> kontenti'} 30 s ichida chiqmadi (splash yoki xato sahifasi)`);
        else await page.waitForTimeout(300);
        // Bo'lim yuklanish chizig'i (shell `RouteProgress`) so'nguncha — u suratda qolmasin.
        await page.waitForFunction(() => !document.querySelector('[data-route-progress]'), null, { timeout: 10000 }).catch(() => {});
        const report = await page.evaluate(measure, deviceName === 'phone');
        // Qobiq balandligi oynaga teng (h-dvh): <main> ichidagi kontent to'liq tushishi uchun oynani cho'zamiz.
        const height = Math.min(16000, await page.evaluate(fullHeight));
        if (height > spec.viewport.height) {
          await page.setViewportSize({ width: spec.viewport.width, height });
          await page.waitForTimeout(400);
        }
        const file = join(OUT_DIR, `${slugOf(route)}--${deviceName}${width ? `-w${width}` : ''}-${themeName}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const tiles = [];
        if (split > 0) {
          const total = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0, k = 1; y < total; y += split, k += 1) {
            const tile = file.replace(/\.png$/, `-${k}.png`);
            await page.screenshot({ path: tile, fullPage: true, clip: { x: 0, y, width: spec.viewport.width, height: Math.min(split, total - y) } });
            tiles.push(tile.slice(ROOT.length + 1));
          }
        }
        const entry = {
          route,
          role,
          ...(branchType ? { branchType } : {}),
          lang,
          device: deviceName,
          width: spec.viewport.width,
          theme: themeName,
          shot: file.slice(ROOT.length + 1),
          ...(tiles.length ? { tiles } : {}),
          ...report,
          consoleErrors: [...new Set(errors)],
        };
        results.push(entry);
        console.log(JSON.stringify(entry, null, 1));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
const redirected = results.filter((r) => r.finalPath.split('?')[0] !== r.route.split('?')[0]);
if (redirected.length) {
  console.error(`Diqqat: ${redirected.length} ta shot boshqa sahifaga yo'naltirildi (guard yoki rol): ` +
    [...new Set(redirected.map((r) => `${r.route} → ${r.finalPath}`))].join(', '));
}
