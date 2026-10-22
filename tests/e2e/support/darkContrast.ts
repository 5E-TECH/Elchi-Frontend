import { expect, test, type Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * TUNGI MAVZU KONTRAST SMOKE'I (Trello xYWDHMTi «447ec1»). Sahifadagi har KO'RINADIGAN matn elementi (o'z matn
 * tuguni bor) uchun matn rangi va uning ostidagi haqiqiy fon (ota-bobolar fonlari ustma-ust qo'shilib, sahifa
 * kanvasigacha) hisoblash uslublaridan olinadi va WCAG nisbati ≥ 4.5:1 tekshiriladi (kichik/katta matn farqi
 * qilinmaydi — qat'iyroq).
 *
 * Rang istalgan CSS formatida (`rgb`, `oklch`, `color-mix` …) — 1×1 kanvasda chizib o'qiladi.
 *
 * Hisobga olinmaydi (WCAG 1.4.3 istisnolari, kodda ataylab): ko'rinmas (`display:none`, `visibility:hidden`,
 * `opacity:0`, 1×1 `sr-only`), o'chirilgan boshqaruv ichidagi matn (`disabled` / `aria-disabled="true"`) va
 * dekorativ (`aria-hidden="true"`) bloklar. Fon rasmi yoki gradient ustidagi matn nisbatsiz hisoblanmaydi —
 * `unknown` ro'yxatiga tushadi va test uni ham bo'sh bo'lishini talab qiladi (v2 da gradient yo'q).
 */

export type ContrastIssue = { text: string; ratio: number; color: string; background: string; selector: string };

/**
 * Ruxsat etilgan istisnolar: CSS selektor (element yoki uning ajdodi mos kelsa) → YOZMA SABAB. Har yozuv — ochiq
 * ega savoli yoki alohida PR; sabab bo'sh bo'lmaydi (test tekshiradi).
 */
export const CONTRAST_ALLOW_LIST: Record<string, string> = {
  // Faqat yon menyu guruh sarlavhasi tugmasi (`nav` ichidagi yig'iladigan `button`) — boshqa `text-nav-muted` matnlar
  // (mobil menyu bo'lim sarlavhasi va persona izohi, PageLoader) tekshiruvda qoladi (o'z-o'zini tekshirish ushlaydi).
  "nav button[aria-expanded][aria-controls].text-nav-muted":
    "Yon menyu guruh sarlavhalari («Ish», «Moliya» …) — shell tokeni `--color-nav-muted` tungi mavzuda " +
    "rgba(232,235,247,.48) / #0a0e1b = 4.33:1 (maket qiymati). Token va shell faqat o'z bosqichi PR'ida yoki ega " +
    "roziligi bilan o'zgaradi (AGENTS.md) — ega savoli: alfa .48 → .50 (4.66:1). Sahifa matni emas.",
};

export const openDarkPage = async (page: Page, path: string, handlers: Record<string, unknown> = {}) => {
  // Mavzu serverdagi `appearance.theme` dan sinxronlanadi (SettingsSync) — localStorage yetarli emas.
  const session = await setupShellSession(page, "superadmin", "Bosh admin", handlers, {
    settings: { appearance: { theme: "dark", themeChosen: true } },
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("theme-version", "2");
  });
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  // Tungi kanvas haqiqatan chizilgan (yorug' `#f4f6fb` emas) — sozlama sinxronidan keyin ham.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), { timeout: 30_000 })
    .not.toBe("rgb(244, 246, 251)");
  await page.waitForTimeout(500);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  return session;
};

export const measureTextContrast = (page: Page, allowSelectors: string[] = []) =>
  page.evaluate((allowed) => {
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
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
      return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}`;
    };

    const canvasColor = parse(getComputedStyle(document.body).backgroundColor);
    const htmlColor = parse(getComputedStyle(document.documentElement).backgroundColor);
    const pageBackground: RGBA = canvasColor[3] > 0 ? over(canvasColor, htmlColor[3] > 0 ? htmlColor : [255, 255, 255, 1]) : htmlColor;

    const issues: Array<{ text: string; ratio: number; color: string; background: string; selector: string }> = [];
    const unknown: string[] = [];
    let checked = 0;

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
      const fg = parse(style.color);
      const effective = over([fg[0], fg[1], fg[2], fg[3] * opacity], background);
      const value = ratio(effective, background);
      checked += 1;
      if (value < 4.5) {
        issues.push({
          text,
          ratio: Math.round(value * 100) / 100,
          color: style.color,
          background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
          selector: describe(el),
        });
      }
    }
    return { checked, issues, unknown };
  }, allowSelectors);

/**
 * O'lchagichning o'zini tekshirish: sahifaga eski binafsha (`#7c3aed`) matnli namuna qo'yiladi — u albatta
 * < 4.5:1 deb topilishi kerak (smoke «hamma narsa o'tdi» deb bo'sh ishlamasin), keyin olib tashlanadi.
 */
const expectProbeCaught = async (page: Page) => {
  await page.evaluate(() => {
    const probe = document.createElement("p");
    probe.id = "contrast-probe";
    probe.textContent = "kontrast namunasi";
    probe.style.color = "#7c3aed";
    (document.querySelector("[data-shell-slot=content]") ?? document.body).append(probe);
  });
  const { issues } = await measureTextContrast(page);
  await page.evaluate(() => document.getElementById("contrast-probe")?.remove());
  const probe = issues.find((issue) => issue.text === "kontrast namunasi");
  expect(probe, "o'lchagich binafsha namunani ushlamadi").toBeTruthy();
  expect(probe!.ratio).toBeLessThan(3.5);

  // Ruxsat ro'yxati faqat yozilgan sababdagi elementni o'tkazib yuboradi: guruh sarlavhasi bo'lmagan `text-nav-muted`
  // matn (masalan mobil menyu izohi) baribir o'lchanadi va ushlanadi.
  await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.id = "contrast-probe-allow";
    probe.className = "text-nav-muted";
    probe.textContent = "ruxsat namunasi";
    probe.style.color = "#7c3aed";
    (document.querySelector("[data-shell-slot=content]") ?? document.body).append(probe);
  });
  const allowed = await measureTextContrast(page, Object.keys(CONTRAST_ALLOW_LIST));
  await page.evaluate(() => document.getElementById("contrast-probe-allow")?.remove());
  expect(
    allowed.issues.find((issue) => issue.text === "ruxsat namunasi"),
    "ruxsat ro'yxati selektori sababidan kengroq — boshqa text-nav-muted matnni ham yashiradi",
  ).toBeTruthy();
};

/** Sahifa to'liq chizilgach (skelet/yuklanish tugagach) o'lchaydi va natijani tekshiradi. */
export const expectDarkContrast = async (page: Page, { minElements = 10 }: { minElements?: number } = {}) => {
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await expectProbeCaught(page);
  for (const reason of Object.values(CONTRAST_ALLOW_LIST)) expect(reason.length).toBeGreaterThan(40);
  const result = await measureTextContrast(page, Object.keys(CONTRAST_ALLOW_LIST));
  const issues = result.issues;
  expect(result.checked, "matn elementlari topilmadi — sahifa chizilmagan").toBeGreaterThan(minElements);
  expect(result.unknown).toEqual([]);
  expect(issues).toEqual([]);
  test.info().annotations.push({ type: "contrast", description: `${page.url()} — ${result.checked} ta matn elementi ≥ 4.5:1` });
  return result;
};
