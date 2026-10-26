import { expect, test, type Page } from "@playwright/test";

/**
 * JONLI KONTRAST AUDITI (Trello xYWDHMTi «447ec1», OpzLWcqJ). Sahifadagi har KO'RINADIGAN matn elementi (o'z matn
 * tuguni bor) uchun matn rangi va uning ostidagi haqiqiy fon (ota-bobolar fonlari ustma-ust qo'shilib, sahifa
 * kanvasigacha) hisoblash uslublaridan olinadi va WCAG nisbati tekshiriladi — kunduzgi va tungi mavzuda.
 *
 * Talab — maket `tizim-motion` 07 «Kontrast»: matn kamida 4,5:1 (kichik/katta matn farqi qilinmaydi — qat'iyroq);
 * yagona yengillik — maketning o'zi «Faqat yordamchi» degan `--color-text-subtle` (namuna matn, o'chirilgan; kunduzgi
 * 3,68:1) — 3:1. Rang istalgan CSS formatida (`rgb`, `oklch`, `color-mix` …) — 1×1 kanvasda chizib o'qiladi; SVG
 * matnida — `fill`.
 *
 * Hisobga olinmaydi (WCAG 1.4.3 istisnolari, kodda ataylab): ko'rinmas (`display:none`, `visibility:hidden`,
 * `opacity:0`, 1×1 `sr-only`), o'chirilgan boshqaruv ichidagi matn (`disabled` / `aria-disabled="true"`) va
 * dekorativ (`aria-hidden="true"`) bloklar. Fon rasmi yoki gradient ustidagi matn nisbatsiz hisoblanmaydi —
 * `unknown` ro'yxatiga tushadi va test uni ham bo'sh bo'lishini talab qiladi (v2 da gradient yo'q).
 */

export type ContrastIssue = { text: string; ratio: number; min: number; color: string; background: string; selector: string };

/** Maket 07: matn talabi va yordamchi matn (`text-subtle`) talabi. */
export const TEXT_MIN = 4.5;
export const SUBTLE_MIN = 3;

/**
 * Ruxsat etilgan istisnolar: CSS selektor (element yoki uning ajdodi mos kelsa) → YOZMA SABAB. Har yozuv — ochiq
 * ega savoli yoki alohida PR; sabab bo'sh bo'lmaydi (test tekshiradi).
 */
export const CONTRAST_ALLOW_LIST: Record<string, string> = {
  // Faqat yon menyu guruh sarlavhasi tugmasi (`nav` ichidagi yig'iladigan `button`) — boshqa `text-nav-muted` matnlar
  // (mobil menyu bo'lim sarlavhasi va persona izohi, PageLoader) tekshiruvda qoladi (o'z-o'zini tekshirish ushlaydi).
  "nav button[aria-expanded][aria-controls].text-nav-muted":
    "Yon menyu guruh sarlavhalari («Ish», «Moliya» …) — shell tokeni `--color-nav-muted` tungi mavzuda " +
    "rgba(232,235,247,.48) / #0a0e1b = 4.33:1 (maket qiymati; maket tizim-motion 07 ning o'zi «Tungida past» deb " +
    "yozgan istisno). Token va shell faqat o'z bosqichi PR'ida yoki ega roziligi bilan o'zgaradi (AGENTS.md) — ega " +
    "savoli: alfa .48 → .52 (maket taklifi, 4.94:1). Sahifa matni emas.",
};

export const measureTextContrast = (page: Page, allowSelectors: string[] = []) =>
  page.evaluate(
    ({ allowed, textMin, subtleMin }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      type RGBA = [number, number, number, number];
      const parse = (color: string): RGBA => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const over = (top: RGBA, bottom: RGBA): RGBA => {
        const a = top[3] + bottom[3] * (1 - top[3]);
        if (a === 0) return [0, 0, 0, 0];
        const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
        return [mix(0), mix(1), mix(2), a];
      };
      const luminance = ([r, g, b]: RGBA) => {
        const channel = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const ratio = (a: RGBA, b: RGBA) => {
        const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
      };
      const same = (a: RGBA, b: RGBA) => a.every((v, i) => Math.abs(v - b[i]) <= (i === 3 ? 0.01 : 1));
      const describe = (el: Element) => {
        const id = el.id ? `#${el.id}` : "";
        const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
        return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}`;
      };

      const canvasColor = parse(getComputedStyle(document.body).backgroundColor);
      const htmlColor = parse(getComputedStyle(document.documentElement).backgroundColor);
      const pageBackground: RGBA =
        canvasColor[3] > 0 ? over(canvasColor, htmlColor[3] > 0 ? htmlColor : [255, 255, 255, 1]) : htmlColor;
      const subtle = parse(getComputedStyle(document.documentElement).getPropertyValue("--color-text-subtle").trim());

      const issues: Array<{ text: string; ratio: number; min: number; color: string; background: string; selector: string }> = [];
      const unknown: string[] = [];
      let checked = 0;
      let subtleChecked = 0;

      const elements = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim() && node.parentElement) elements.add(node.parentElement);
      }

      for (const el of elements) {
        if (el.closest("script, style, noscript, template, [aria-hidden='true'], [disabled], [aria-disabled='true'], [inert]")) continue;
        if (allowed.some((selector) => el.closest(selector))) continue;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) continue;
        if (style.visibility !== "visible" || style.display === "none") continue;
        let opacity = 1;
        for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
        if (opacity === 0) continue;
        // Ekrandan butunlay tashqarida (yopiq yon panel) — ko'rinmaydi.
        if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth + 2000) continue;

        // Fon: elementdan yuqoriga, birinchi shaffof bo'lmagan qatlamgacha.
        const layers: RGBA[] = [];
        let image = false;
        for (let n: Element | null = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.backgroundImage && s.backgroundImage !== "none") image = true;
          const c = parse(s.backgroundColor);
          if (c[3] > 0) layers.push(c);
          if (c[3] >= 1) break;
        }
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
        if (image) {
          unknown.push(`${text} (${describe(el)})`);
          continue;
        }
        let background = pageBackground;
        for (const layer of layers.reverse()) background = over(layer, background);
        // SVG matni (grafik o'qi, yorliq) rangi — `fill`; `url(…)`/`none` bo'lsa — `color`.
        const paint = el instanceof SVGElement && /^(#|rgb|hsl|oklch|color)/.test(style.fill) ? style.fill : style.color;
        const fg = parse(paint);
        const min = same(fg, subtle) ? subtleMin : textMin;
        if (min === subtleMin) subtleChecked += 1;
        const effective = over([fg[0], fg[1], fg[2], fg[3] * opacity], background);
        const value = ratio(effective, background);
        checked += 1;
        if (value < min) {
          issues.push({
            text,
            ratio: Math.round(value * 100) / 100,
            min,
            color: paint,
            background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
            selector: describe(el),
          });
        }
      }
      return { checked, subtleChecked, issues, unknown };
    },
    { allowed: allowSelectors, textMin: TEXT_MIN, subtleMin: SUBTLE_MIN },
  );

/**
 * Vaqtinchalik namunani ko'rinadigan qatlamga qo'yib o'lchaydi va natijadan uning yozuvini qaytaradi: oyna ochiq
 * bo'lsa — eng ustki oyna ichiga (orqa fon `inert`), aks holda sahifa slotiga.
 */
const measureProbe = async (page: Page, probe: { className?: string; color: string; text: string }, allow: string[] = []) => {
  await page.evaluate(({ className, color, text }) => {
    const node = document.createElement("span");
    node.id = "contrast-probe";
    if (className) node.className = className;
    node.textContent = text;
    node.style.color = color;
    const dialogs = document.querySelectorAll("[role=dialog]");
    (dialogs[dialogs.length - 1] ?? document.querySelector("[data-shell-slot=content]") ?? document.body).append(node);
  }, probe);
  const result = await measureTextContrast(page, allow);
  await page.evaluate(() => document.getElementById("contrast-probe")?.remove());
  return result.issues.find((issue) => issue.text === probe.text);
};

/**
 * O'lchagichning o'zini tekshirish (smoke «hamma narsa o'tdi» deb bo'sh ishlamasin): chegara rangidagi
 * (`--color-border`, ikkala mavzuda fonga yaqin) matn albatta ushlanadi — oddiy matn sifatida ham, ruxsat ro'yxati
 * selektoriga o'xshash `text-nav-muted` sifatida ham (ro'yxat faqat yozilgan elementni o'tkazadi).
 */
const expectProbeCaught = async (page: Page) => {
  const plain = await measureProbe(page, { color: "var(--color-border)", text: "kontrast namunasi" });
  expect(plain, "o'lchagich past kontrastli namunani ushlamadi").toBeTruthy();
  expect(plain!.ratio).toBeLessThan(3);
  expect(plain!.min).toBe(TEXT_MIN);

  const allowed = await measureProbe(
    page,
    { className: "text-nav-muted", color: "var(--color-border)", text: "ruxsat namunasi" },
    Object.keys(CONTRAST_ALLOW_LIST),
  );
  expect(allowed, "ruxsat ro'yxati selektori sababidan kengroq — boshqa text-nav-muted matnni ham yashiradi").toBeTruthy();
};

/** Sahifa to'liq chizilgach (skelet/yuklanish tugagach) o'lchaydi va natijani tekshiradi. */
export const expectContrast = async (page: Page, { minElements = 10 }: { minElements?: number } = {}) => {
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  // Ochilish animatsiyasi (oyna — 250 ms shaffoflikdan) tugaguncha: o'rtasida matn xira o'lchanadi. Cheksizlari
  // (skelet yaltirashi, yuklanish halqasi) kutilmaydi.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running" || animation.effect?.getComputedTiming().iterations === Infinity),
  );
  await expectProbeCaught(page);
  for (const reason of Object.values(CONTRAST_ALLOW_LIST)) expect(reason.length).toBeGreaterThan(40);
  const result = await measureTextContrast(page, Object.keys(CONTRAST_ALLOW_LIST));
  expect(result.checked, "matn elementlari topilmadi — sahifa chizilmagan").toBeGreaterThan(minElements);
  expect(result.unknown).toEqual([]);
  expect(result.issues).toEqual([]);
  test.info().annotations.push({
    type: "contrast",
    description: `${page.url()} — ${result.checked} ta matn elementi (yordamchi: ${result.subtleChecked}) talabda`,
  });
  return result;
};
