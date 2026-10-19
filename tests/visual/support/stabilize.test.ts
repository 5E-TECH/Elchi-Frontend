import type { BrowserContext, Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUSY_SELECTOR, expandToContent, pinOnline, queryErrors, readyProbe, waitForReady } from "./stabilize";

/**
 * Vizual snapshotlar barqarorligi (docs/DESIGN_SYSTEM.md §12.5): oflayn hodisasi, kech o'sadigan balandlik va
 * chizilmagan xato holati surat oldidan ushlanadi. Playwright `Page` — soxta, brauzer funksiyalari jsdom'da.
 */

const HEIGHT_PROBE = "documentElement.scrollHeight";

/** Soxta sahifa: `heights` — `expandToContent` ning ketma-ket o'lchovlari (oxirgisi takrorlanadi). */
const fakePage = (heights: number[], { ready = true, gap = "" } = {}) => {
  let viewport = { width: 1440, height: 900 };
  let measured = 0;
  const resized: number[] = [];
  const page = {
    viewportSize: () => viewport,
    setViewportSize: async (size: { width: number; height: number }) => {
      viewport = size;
      resized.push(size.height);
    },
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    waitForFunction: vi.fn(async () => {
      if (!ready) throw new Error("Timeout 15000ms exceeded");
    }),
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: { explain?: boolean }) => {
      if (arg?.explain) return gap;
      if (String(fn).includes(HEIGHT_PROBE)) {
        const value = heights[Math.min(measured, heights.length - 1)];
        measured += 1;
        return value;
      }
      return "dom-tinch";
    },
  };
  return { page: page as unknown as Page, resized, waits: page.waitForFunction, measures: () => measured };
};

describe("expandToContent — balandlik ketma-ket ikki o'lchovda o'zgarmaguncha", () => {
  it("kech o'sgan kontentni kutadi (F2: 2451 → 2547, eskisi 2451 da to'xtardi)", async () => {
    const { page, resized } = fakePage([2451, 2451, 2547, 2547, 2547]);
    await expandToContent(page, 6000);
    expect(resized).toEqual([2451, 2547]);
    expect(page.viewportSize()?.height).toBe(2547);
  });

  it("har o'lchovdan oldin sahifa tayyorligini qayta tekshiradi", async () => {
    const { page, waits, measures } = fakePage([2515, 2547, 2547, 2547]);
    await expandToContent(page, 6000);
    expect(waits).toHaveBeenCalledTimes(measures());
  });

  it("maxHeight dan oshmaydi va unda to'xtaydi", async () => {
    const { page, resized } = fakePage([9000]);
    await expandToContent(page, 6000);
    expect(resized).toEqual([6000]);
  });

  it("balandlik barqarorlashmasa jim surat olmaydi — yiqiladi", async () => {
    const { page } = fakePage(Array.from({ length: 12 }, (_, index) => 1000 + index * 100));
    await expect(expandToContent(page, 6000)).rejects.toThrow(/balandligi barqarorlashmadi/);
  });

  it("tayyor bo'lmasa nima kutilayotganini aytadi", async () => {
    const { page } = fakePage([2547], { ready: false, gap: "DeferredMount ochilmagan (top 1907)" });
    await expect(waitForReady(page, {}, 15_000)).rejects.toThrow(
      "Vizual: sahifa tayyor bo'lmadi — DeferredMount ochilmagan (top 1907)",
    );
  });
});

/** jsdom joylashuv hisoblamaydi: `data-hidden` ostidagi element «chizilmagan» (`display: none`). */
const stubLayout = () => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.closest("[data-hidden]") ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList;
  });
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent ?? "";
    },
  });
};

const mainWith = (inner: string) => {
  document.body.innerHTML = `<main><h1>Moliya</h1><p>a</p><p>b</p><p>c</p><p>d</p><p>e</p>${inner}</main>`;
};

const probe = (allowBusy = false) => readyProbe({ ready: null, allowBusy, busy: BUSY_SELECTOR, explain: true });

const cleanup = () => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { innerText?: string }).innerText;
  document.body.innerHTML = "";
};

describe("readyProbe — «band» shartnomasi", () => {
  afterEach(cleanup);

  it("ko'rinadigan skelet (Suspense zaxirasi ham) sahifani band qiladi", () => {
    stubLayout();
    mainWith('<div data-skeleton-preset="chart"><span data-skeleton></span></div>');
    expect(probe()).toMatch(/^band: <span data-skeleton/);
  });

  it("svg'siz recharts konteyneri — grafik hali chizilmagan", () => {
    stubLayout();
    mainWith('<div class="recharts-responsive-container"></div>');
    expect(probe()).toMatch(/^band: .*recharts-responsive-container/);
    mainWith('<div class="recharts-responsive-container"><svg class="recharts-surface"></svg></div>');
    expect(probe()).toBe("");
  });

  it("display: none ostidagi skelet kutilmaydi (yopiq tab, telefon egizagi)", () => {
    stubLayout();
    mainWith('<div data-hidden><span data-skeleton></span></div>');
    expect(probe()).toBe("");
  });

  it("allowBusy sahnasida skelet kutilmaydi", () => {
    stubLayout();
    mainWith("<span data-skeleton></span>");
    expect(probe(true)).toBe("");
  });
});

describe("queryErrors — chizilgan xato holatlari", () => {
  afterEach(cleanup);

  const evaluatingPage = { evaluate: async (fn: () => unknown) => fn() } as unknown as Page;

  it("QueryBoundary bloki va to'g'ridan-to'g'ri ErrorState — har biri bir marta, tashqisi bilan", async () => {
    stubLayout();
    document.body.innerHTML = `
      <section data-query-state="error"><div data-error-kind="offline">Internet aloqasi yo'q</div></section>
      <div data-error-kind="server">Ma'lumotni yuklab bo'lmadi</div>
      <div data-error-kind="forbidden">Bu ma'lumotni ko'rishga ruxsatingiz yo'q</div>
      <div data-hidden><div data-error-kind="generic">Yashirin</div></div>`;
    await expect(queryErrors(evaluatingPage)).resolves.toEqual([
      "offline: «Internet aloqasi yo'q»",
      "server: «Ma'lumotni yuklab bo'lmadi»",
    ]);
  });

  it("xato holati yo'q — bo'sh ro'yxat", async () => {
    stubLayout();
    document.body.innerHTML = '<section data-query-state="ready">3 ta</section>';
    await expect(queryErrors(evaluatingPage)).resolves.toEqual([]);
  });
});

describe("pinOnline — xost tarmog'i sahifaga ta'sir qilmaydi (F1)", () => {
  it("navigator.onLine doim true, online/offline hodisalari ilovaga yetmaydi", async () => {
    let script: (() => void) | undefined;
    const context = {
      addInitScript: async (fn: () => void) => {
        script = fn;
      },
    } as unknown as BrowserContext;
    await pinOnline(context);

    // Xost oflayn; ilova tinglovchisi skriptdan OLDIN yozilgan — capture bosqichi baribir undan oldin to'xtatadi.
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    const appListener = vi.fn();
    window.addEventListener("offline", appListener);
    window.addEventListener("online", appListener);
    script?.();
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));

    expect(navigator.onLine).toBe(true);
    expect(appListener).not.toHaveBeenCalled();
  });
});
