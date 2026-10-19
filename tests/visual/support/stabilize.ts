import type { BrowserContext, Page } from "@playwright/test";

/**
 * Vizual snapshotlar — barqarorlik (docs/DESIGN_SYSTEM.md §12.5).
 *
 * Soat muzlatilgan: `Date` doim shu lahzani qaytaradi, taymerlar esa yuradi (React Query, debounce, skelet
 * kechikishi ishlayveradi). Fixture vaqtlari shu lahzaga nisbatan doimiy qiymatlar — «hozir»dan keyingi sana
 * yozilmaydi (aks holda «N daqiqa oldin» kabi matnlar manfiy bo'ladi).
 */
export const FIXED_NOW = new Date("2026-10-15T10:00:00+05:00");
export const FIXED_NOW_MS = FIXED_NOW.getTime();

/**
 * Brauzer doim «onlayn»: API butunlay soxta (`mockApi.ts`), shuning uchun mashinaning haqiqiy tarmog'i sahifaga
 * ta'sir qilmasligi kerak. Aks holda Wi-Fi bir necha soniya uzilsa Chromium `offline` hodisasini chiqaradi
 * (`navigator.onLine = false`), React Query (`networkMode: "online"`) shu paytda boshlangan so'rovni yubormay
 * to'xtatadi (`fetchStatus: "paused"`) va `QueryBoundary` «Internet aloqasi yo'q» ni chizadi — konsol xatosi ham,
 * mock'lanmagan so'rov ham yo'q, surat jim buziladi (F1: `order-create` yon kartasi «0 ta»). Ilova kodiga
 * tegilmaydi: `online`/`offline` hodisalari ilova tinglovchilaridan oldin (capture) to'xtatiladi.
 */
export const pinOnline = (context: BrowserContext) =>
  context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => true });
    for (const type of ["online", "offline"]) {
      window.addEventListener(type, (event) => event.stopImmediatePropagation(), { capture: true });
    }
  });

/** Sahifa balandligi chegarasi (px): uzun sahifa shundan keyin kesiladi. `ui-kit` — 12 000 (sahna o'zi beradi). */
export const DEFAULT_MAX_HEIGHT = 6000;

/** Barcha sahnalarda niqoblanadigan dinamik elementlar. Ilova kodiga niqob uchun `data-*` qo'shilmaydi. */
export const GLOBAL_MASK = ["video", 'img[src^="blob:"]'];

export interface ReadyOptions {
  /** Qo'shimcha selektor: shu element chiqmaguncha tayyor emas. */
  ready?: string;
  /**
   * Sahifa yuklanish holatlarini ATAYLAB ko'rsatadi (masalan `/ops/ui-kit` — Skeleton, Button `loading`).
   * Berilsa, `<main>` ichidagi `aria-busy` / skelet tekshirilmaydi. Qiymat — sabab.
   */
  allowBusy?: string;
}

/**
 * «Band» shartnomasi — `<main>` ichida shulardan biri bor ekan, sahifa hali tayyor emas:
 *   - `data-query-state="loading"`, `aria-busy="true"`, `data-skeleton-visible` — `QueryBoundary` so'rovi;
 *   - `data-skeleton` — har qanday skelet (`Skeleton`, `SkeletonChart`, `SkeletonLines` …), `QueryBoundary`
 *     dan tashqaridagisi ham: `Suspense` zaxirasi (lazy chunk — masalan «Moliyaviy tahlil» plotining recharts
 *     bo'lagi) va qo'lda chizilgan yuklanish holati;
 *   - `.recharts-responsive-container` ichida `svg` yo'q — recharts o'lchamini (ResizeObserver) hali olmagan.
 * `allowBusy` sahnasida (skeletlarni ataylab ko'rsatadi) bu ro'yxat tekshirilmaydi.
 */
export const BUSY_SELECTOR = [
  '[data-query-state="loading"]',
  '[aria-busy="true"]',
  "[data-skeleton-visible]",
  "[data-skeleton]",
  ".recharts-responsive-container:not(:has(svg.recharts-surface))",
].join(", ");

export type ReadyProbe = { ready: string | null; allowBusy: boolean; busy: string; explain: boolean };

/**
 * Brauzerda bajariladi (o'zi yetarli funksiya): `explain` — nima kutilayotgani matni, aks holda «tayyormi».
 * Oynaga kirgan, lekin hali ochilmagan `DeferredMount` (`data-deferred="waiting"`) ham kutiladi:
 * IntersectionObserver javobi va React commit'i keyingi kadrlarda keladi, shu paytdagi o'lchov va surat
 * joy egallagichniki bo'lardi. Oynadan pastdagisi (`maxHeight` bilan kesilgan sahifa) kutilmaydi — u ochilmaydi.
 * Bu skelet emas (joylashuv hali o'zgaradi), shuning uchun `allowBusy` unga ta'sir qilmaydi.
 */
export const readyProbe = ({ ready, allowBusy, busy, explain }: ReadyProbe): boolean | string => {
  const gap = (() => {
    const main = document.querySelector("main");
    if (!main || main.querySelectorAll("*").length <= 5 || !main.innerText.trim()) return "<main> bo'sh";
    if (document.querySelector("[data-route-progress]")) return "bo'lim yuklanish chizig'i";
    if (!allowBusy) {
      // Faqat chizilgani: `display: none` ostidagi skelet / grafik (yopiq tab, `hidden md:flex` egizagi) hech
      // qachon tayyor bo'lmaydi va sahnani 30 s kutib yiqitardi. `visibility: hidden` (QueryBoundary kechikish
      // bosqichi) joy egallaydi — hisoblanadi. Belgi `display: contents` elementda bo'lsa (qutisiz) ko'rinmaydi —
      // `QueryBoundary` / skelet / `ErrorState` ildiziga `contents` berilmaydi.
      const element = [...main.querySelectorAll(busy)].find((node) => node.getClientRects().length > 0);
      if (element) return `band: ${element.outerHTML.slice(0, 160)}`;
    }
    // Ko'rinadigan maydon — oyna va `<main>` kesishmasi: IntersectionObserver ham `<main>` skroll chegarasi bilan
    // kesadi (telefonda `<main>` pastki menyu joyida tugaydi — u yerdagi joy egallagich ochilmaydi, kutilmaydi).
    const view = main.getBoundingClientRect();
    const viewTop = Math.max(0, view.top);
    const viewBottom = Math.min(window.innerHeight, view.bottom);
    for (const element of main.querySelectorAll('[data-deferred="waiting"]')) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom > viewTop && rect.top < viewBottom) {
        return `DeferredMount ochilmagan (top ${Math.round(rect.top)})`;
      }
    }
    if (ready && !document.querySelector(ready)) return `ready yo'q: ${ready}`;
    return "";
  })();
  return explain ? gap : !gap;
};

/**
 * Sahifa tayyor: `<main>` da kontent bor, bo'lim yuklanish chizig'i yo'q, «band» belgisi (`BUSY_SELECTOR`)
 * yo'q, oynadagi `DeferredMount` ochilgan, tarmoq tinch. Keyin DOM ikki marta ketma-ket bir xil bo'lguncha
 * kutiladi. `timeout` (sukut 30 s) ichida tayyor bo'lmasa — nima kutilayotgani bilan yiqiladi.
 */
export const waitForReady = async (page: Page, options: ReadyOptions = {}, timeout = 30_000) => {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  const probe: ReadyProbe = {
    ready: options.ready ?? null,
    allowBusy: Boolean(options.allowBusy),
    busy: BUSY_SELECTOR,
    explain: false,
  };
  try {
    await page.waitForFunction(readyProbe, probe, { timeout });
  } catch (error) {
    const gap = await page.evaluate(readyProbe, { ...probe, explain: true }).catch(() => "?");
    throw new Error(`Vizual: sahifa tayyor bo'lmadi — ${String(gap)}`, { cause: error });
  }
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // DOM tinchlandi: ketma-ket ikki o'lchov (300 ms oraliq) bir xil.
  let previous = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await page.evaluate(() => {
      const main = document.querySelector("main");
      return `${document.body.innerHTML.length}:${main?.scrollHeight ?? 0}:${document.querySelectorAll("[role=dialog]").length}`;
    });
    if (current === previous) return;
    previous = current;
    await page.waitForTimeout(300);
  }
};

/**
 * Chizilgan xato holatlari, butun hujjatda — oyna (portal) ichida ham: `QueryBoundary` bloki
 * (`data-query-state="error"`: so'rov yiqilgan yoki oflayn kutib turibdi) va `QueryBoundary` siz to'g'ridan-to'g'ri
 * chizilgan `ErrorState` (`data-error-kind`: bosh sahifa qismlari, moliya tablari …). Ichma-ich juftlikdan faqat
 * tashqisi, `display: none` ostidagisi olinmaydi. `forbidden` (403, rolga bog'liq) — xato emas
 * (`ErrorState.tsx`), olinmaydi. Har biri `"<data-error-kind>: «birinchi qator»"`.
 * Soxta API'da so'rov yiqilmasligi kerak: bo'sh bo'lmagan ro'yxat — sahna fixture'i yoki mock xato.
 */
export const queryErrors = (page: Page) =>
  page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll<HTMLElement>('[data-query-state="error"], [data-error-kind]'),
    ].filter((node) => node.getClientRects().length > 0 && node.getAttribute("data-error-kind") !== "forbidden");
    return nodes
      .filter((node) => !nodes.some((other) => other !== node && other.contains(node)))
      .map((node) => {
        const own = node.matches("[data-error-kind]") ? node : node.querySelector("[data-error-kind]");
        const kind = own?.getAttribute("data-error-kind") ?? "?";
        const text = (node.innerText ?? node.textContent ?? "").trim().split("\n")[0] ?? "";
        return `${kind}: «${text.slice(0, 80)}»`;
      });
  });

/**
 * `expandToContent` ichidagi har qayta tinchlanish uchun kutish (ms). Birinchi `waitForReady` (30 s) allaqachon
 * o'tgan — bu yerda faqat oyna cho'zilgach ochilgan bloklar kutiladi. Testning 60 s chegarasidan oldin
 * «sahifa tayyor bo'lmadi — …» sababi bilan yiqilsin, umumiy timeout bilan emas.
 */
const SETTLE_TIMEOUT = 15_000;

/**
 * Qobiq `h-dvh`, kontent `<main>` ichida aylanadi — to'liq sahifa uchun oyna balandligi kontentgacha
 * cho'ziladi (`maxHeight` gacha). Oynani cho'zish o'zi yangi ish boshlaydi: pastdagi `DeferredMount`
 * (IntersectionObserver) ochiladi, uning lazy chunk'i, so'rovi va grafigi keyinroq chiziladi, kontent
 * balandligi o'zgaradi. Shuning uchun har o'lchovdan oldin `waitForReady` (band shartnomasi + DOM tinch)
 * va balandlik ketma-ket ikki o'lchovda o'zgarmaguncha takrorlanadi; barqarorlashmasa — yiqiladi
 * (noto'g'ri balandlikdagi surat jim olinmaydi). 10 urinish: oyna balandligiga bog'liq (`min-h-dvh` kabi) va har
 * cho'zishda bir necha px o'sadigan sahifa ham shu yerda yiqiladi — avval jim kesilardi.
 */
export const expandToContent = async (
  page: Page,
  maxHeight = DEFAULT_MAX_HEIGHT,
  ready: ReadyOptions = {},
) => {
  const viewport = page.viewportSize();
  if (!viewport) return;
  let height = viewport.height;
  let unchanged = 0;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await waitForReady(page, ready, SETTLE_TIMEOUT);
    const needed = await page.evaluate(() => {
      const main = document.querySelector("main");
      const extra = main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
      return Math.max(document.documentElement.scrollHeight, window.innerHeight + extra);
    });
    const next = Math.min(maxHeight, Math.ceil(needed));
    if (next <= height) {
      unchanged += 1;
      if (unchanged >= 2) return;
      continue;
    }
    unchanged = 0;
    height = next;
    await page.setViewportSize({ width: viewport.width, height });
  }
  throw new Error(`Vizual: sahifa balandligi barqarorlashmadi (oxirgi ${height} px, maxHeight ${maxHeight})`);
};
