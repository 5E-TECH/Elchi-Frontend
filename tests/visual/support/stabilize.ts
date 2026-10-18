import type { Page } from "@playwright/test";

/**
 * Vizual snapshotlar — barqarorlik (docs/DESIGN_SYSTEM.md §12.5).
 *
 * Soat muzlatilgan: `Date` doim shu lahzani qaytaradi, taymerlar esa yuradi (React Query, debounce, skelet
 * kechikishi ishlayveradi). Fixture vaqtlari shu lahzaga nisbatan doimiy qiymatlar — «hozir»dan keyingi sana
 * yozilmaydi (aks holda «N daqiqa oldin» kabi matnlar manfiy bo'ladi).
 */
export const FIXED_NOW = new Date("2026-10-15T10:00:00+05:00");
export const FIXED_NOW_MS = FIXED_NOW.getTime();

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
 * Sahifa tayyor: `<main>` da kontent bor, bo'lim yuklanish chizig'i yo'q, `<main>` ichida yuklanayotgan
 * so'rov (`QueryBoundary` → `data-query-state="loading"`, `aria-busy="true"`, `data-skeleton-visible`) yo'q,
 * tarmoq tinch. Keyin DOM ikki marta ketma-ket bir xil bo'lguncha kutiladi.
 */
export const waitForReady = async (page: Page, options: ReadyOptions = {}) => {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(
    ({ ready, allowBusy }) => {
      const main = document.querySelector("main");
      if (!main || main.querySelectorAll("*").length <= 5 || !main.innerText.trim()) return false;
      if (document.querySelector("[data-route-progress]")) return false;
      if (
        !allowBusy &&
        main.querySelector('[data-query-state="loading"], [aria-busy="true"], [data-skeleton-visible]')
      ) {
        return false;
      }
      return !ready || Boolean(document.querySelector(ready));
    },
    { ready: options.ready ?? null, allowBusy: Boolean(options.allowBusy) },
    { timeout: 30_000 },
  );
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
 * Qobiq `h-dvh`, kontent `<main>` ichida aylanadi — to'liq sahifa uchun oyna balandligi kontentgacha
 * cho'ziladi (`maxHeight` gacha). Balandlik o'zgargach joylashuv qayta hisoblanadi, shuning uchun 3 martagacha.
 */
export const expandToContent = async (page: Page, maxHeight = DEFAULT_MAX_HEIGHT) => {
  const viewport = page.viewportSize();
  if (!viewport) return;
  let height = viewport.height;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const needed = await page.evaluate(() => {
      const main = document.querySelector("main");
      const extra = main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
      return Math.max(document.documentElement.scrollHeight, window.innerHeight + extra);
    });
    const next = Math.min(maxHeight, Math.ceil(needed));
    if (next <= height) return;
    height = next;
    await page.setViewportSize({ width: viewport.width, height });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
};
