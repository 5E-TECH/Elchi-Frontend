import {
  RECEIPT_FONT_FAMILY,
  RECEIPT_FONT_METRICS,
  RECEIPT_FONT_PROBES,
  ReceiptFontError,
  receiptFontFaceCss,
} from "./printReceiptFonts";
import type { ReceiptScheduler } from "./receiptScheduler";
import {
  SCISSORS_LINES,
  splitReceiptKerned,
  type ReceiptOp,
  type ReceiptPage,
  type ReceiptTextOp,
} from "./printReceiptLayout";

/**
 * CHEK HTML RENDERERI VA BRAUZER CHOP ETISHI (HJ5sLHiz, TZ F9). PDF bilan bir xil `ReceiptPage[]` dan: har amal mm da
 * mutlaq joylashgan element, shrift — o'sha TTF (`@font-face`, ligaturasiz; kerning — joylash hisoblagan juftliklar,
 * brauzerniki o'chiq), QR — SVG `crispEdges`.
 *
 * Faqat qora va oq (TZ qabul 5): siyoh `--ink: #000`, qog'oz `--paper: #fff` — bitta joyda; QR va chiziqlar
 * `currentColor`. Chop etish chiqishi ilova mavzusidan tashqarida — fayl `OUTPUT_FORMAT_FILES` da
 * (`scripts/design-guard.mjs`), rang qoidalari qo'llanmaydi.
 *
 * Chop etish: yashirin `<iframe>` (`blob:`, CSP `frame-src blob:`), ichida skript yo'q — ota sahifa shriftlar
 * yuklanganini (`document.fonts.load`) kutadi va `contentWindow.print()` ni chaqiradi. Popup yo'q.
 */

const num = (value: number) => String(Math.round(value * 1000) / 1000);
const mm = (value: number) => `${num(value)}mm`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** CSS px (96 / dyuym) — brauzer chop etishda ham shu birlikda joylaydi. */
const CSS_PX_PER_MM = 96 / 25.4;

/**
 * Matn: qator qutisi aynan shrift balandligi (ascent + descent) — bazaviy chiziq `top + ascent` da, PDF bilan bir xil.
 * `@font-face` metrikalari `ascent-override` / `descent-override` bilan qotirilgan; Blink ascent va descent ni butun px
 * ga yaxlitlaydi — shuni oldindan hisobga olamiz (aks holda matn 0,1–0,4 mm yuqori chiqadi). Yaxlitlamaydigan brauzerda
 * farq ≤ 0,5 px (0,13 mm).
 */
const textHtml = (op: ReceiptTextOp) => {
  const fontPx = op.pt * (96 / 72);
  const ascentPx = Math.round(RECEIPT_FONT_METRICS.ascent * fontPx);
  const descentPx = Math.round(RECEIPT_FONT_METRICS.descent * fontPx);
  const style = [
    `left:${mm(op.x)}`,
    `top:${mm(op.baseline - ascentPx / CSS_PX_PER_MM)}`,
    `font-size:${num(op.pt)}pt`,
    `line-height:${ascentPx + descentPx}px`,
    `font-weight:${op.weight}`,
    ...(op.letterSpacing ? [`letter-spacing:${mm(op.letterSpacing)}`] : []),
  ].join(";");
  // Kerning: brauzerniki o'chiq (`font-kerning: none`) — joylash hisoblagan juftliklar `margin-right` bilan (PDF dagidek).
  const content = splitReceiptKerned(op)
    .map(([part, offset]) =>
      offset
        ? `<span style="margin-right:${mm(offset)}">${escapeHtml(part)}</span>`
        : escapeHtml(part),
    )
    .join("");
  return `<span class="t${op.paper ? " w" : ""}" style="${style}">${content}</span>`;
};

/**
 * Chiziq, ramka, qora yorliq, punktir, qaychi va QR — sahifa o'lchamidagi bitta SVG ichida, birlik mm (`viewBox`).
 * Alohida `<span>` / kichik `<svg>` emas: Chromium chop etishda element qutilarini butun CSS px ga (0,26 mm) suradi —
 * SVG geometriyasi esa aniq qoladi (PDF bilan bir xil).
 */
const vectorSvg = (op: ReceiptOp): string => {
  switch (op.kind) {
    case "text":
      return "";
    case "rect":
      return `<rect x="${num(op.x)}" y="${num(op.y)}" width="${num(op.w)}" height="${num(op.h)}"${op.radius ? ` rx="${num(op.radius)}"` : ""}/>`;
    case "frame": {
      // Chiziq tashqi chegaradan ichkariga (CSS `border-box`, PDF bilan bir xil).
      const inset = op.stroke / 2;
      return (
        `<rect x="${num(op.x + inset)}" y="${num(op.y + inset)}" width="${num(op.w - op.stroke)}" ` +
        `height="${num(op.h - op.stroke)}" rx="${num(Math.max(0, op.radius - inset))}" fill="none" stroke="currentColor" ` +
        `stroke-width="${num(op.stroke)}"/>`
      );
    }
    case "dash":
      return (
        `<line x1="${num(op.x1)}" y1="${num(op.y1)}" x2="${num(op.x2)}" y2="${num(op.y2)}" fill="none" stroke="currentColor" ` +
        `stroke-width="${num(op.stroke)}" stroke-dasharray="${num(op.dash)} ${num(op.gap)}"/>`
      );
    case "scissors": {
      const lines = SCISSORS_LINES.map(
        ([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`,
      ).join("");
      return (
        `<g transform="translate(${num(op.x)} ${num(op.y)}) scale(${num(op.size / 24)})" fill="none" stroke="currentColor" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
        `<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>${lines}</g>`
      );
    }
    case "qr": {
      const path = op.symbol.runs
        .map(([row, col, length]) => `M${col} ${row}h${length}v1h-${length}z`)
        .join("");
      return (
        `<path class="qr" transform="translate(${num(op.x)} ${num(op.y)}) scale(${String(op.module)})" ` +
        `shape-rendering="crispEdges" d="${path}"/>`
      );
    }
  }
};

const pageHtml = (page: ReceiptPage) => {
  const vectors = page.ops.map(vectorSvg).join("");
  const texts = page.ops.map((op) => (op.kind === "text" ? textHtml(op) : "")).join("");
  return (
    `<div class="p" style="width:${mm(page.width)};height:${mm(page.height)}">` +
    (vectors
      ? `<svg class="v" style="width:${mm(page.width)};height:${mm(page.height)}" viewBox="0 0 ${num(page.width)} ${num(page.height)}" aria-hidden="true">${vectors}</svg>`
      : "") +
    `${texts}</div>`
  );
};

/** Shrift URL'i — mutlaq (oyna `blob:` manzilda ochiladi). */
const absoluteUrl = (url: string) => new URL(url, document.baseURI).href;

export interface ReceiptHtmlOptions {
  title?: string;
  resolveUrl?: (url: string) => string;
  /**
   * Ekrandagi namuna (`/ops/ui-kit?section=receipts`): 1 mm = shuncha CSS px (termal maket — 5, A5 — 3). Hujjat
   * shu masshtabda chiziladi (`transform`), chop etishga ta'sir qilmaydi; berilmasa — haqiqiy o'lcham (chop etish).
   */
  previewPxPerMm?: number;
}

const documentHtml = (
  body: string,
  first: ReceiptPage | undefined,
  options: ReceiptHtmlOptions,
): string => {
  const width = first?.width ?? 100;
  const height = first?.height ?? 60;
  const preview = options.previewPxPerMm
    ? `html,body{overflow:hidden}body{width:${mm(width)};transform:scale(${num(options.previewPxPerMm / CSS_PX_PER_MM)});transform-origin:0 0}\n`
    : "";
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<title>${escapeHtml(options.title ?? "Elchi chek")}</title>
<style>
${receiptFontFaceCss(options.resolveUrl ?? absoluteUrl)}
@page{size:${mm(width)} ${mm(height)};margin:0}
:root{color-scheme:light only;--ink:#000;--paper:#fff}
*{box-sizing:border-box;margin:0;padding:0;forced-color-adjust:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:var(--paper);color:var(--ink)}
${preview}.p{position:relative;overflow:hidden;break-after:page;page-break-after:always}
.p:last-child{break-after:auto;page-break-after:auto}
.t{position:absolute;white-space:pre;color:var(--ink);font-family:"${RECEIPT_FONT_FAMILY}";font-style:normal;font-kerning:none;font-variant-ligatures:none;font-feature-settings:"kern" 0,"liga" 0,"calt" 0;font-synthesis:none}
.t.w{color:var(--paper)}
.v{position:absolute;left:0;top:0;display:block;overflow:visible;color:var(--ink);fill:currentColor}
</style>
</head>
<body>
${body}
</body>
</html>`;
};

/** Sahifalar → to'liq HTML hujjat (skriptsiz). Hamma sahifa bir xil o'lchamda (`@page`). */
export const renderReceiptHtml = (
  pages: ReadonlyArray<ReceiptPage>,
  options: ReceiptHtmlOptions = {},
): string => documentHtml(pages.map(pageHtml).join("\n"), pages[0], options);

/**
 * `renderReceiptHtml` bo'laklab (TZ qabul 8): har sahifadan keyin `scheduler.checkpoint()` — 200 ta chek yig'ilayotganda
 * UI qotmaydi. Natija `renderReceiptHtml` bilan aynan bir xil.
 */
export const renderReceiptHtmlSliced = async (
  pages: ReadonlyArray<ReceiptPage>,
  scheduler: ReceiptScheduler,
  options: ReceiptHtmlOptions = {},
): Promise<string> => {
  const parts: string[] = [];
  for (const page of pages) {
    parts.push(pageHtml(page));
    await scheduler.checkpoint();
  }
  return documentHtml(parts.join("\n"), pages[0], options);
};

const nextFrame = (win: Window) =>
  new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));

/** Oyna yopilmagan / bekor qilingan chop etish iframe'lari — keyingi chaqiruvda tozalanadi. */
const activeFrames = new Set<() => void>();

/**
 * Hujjatni yashirin iframe'da chop etadi: shriftlar yuklanmaguncha kutadi (yuklanmasa — `ReceiptFontError`,
 * shriftsiz chek chop etilmaydi), keyin `print()`. Iframe `afterprint` da (yoki 10 daqiqadan so'ng) olib tashlanadi.
 */
export const printReceiptHtml = async (html: string): Promise<void> => {
  activeFrames.forEach((cleanup) => cleanup());
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.title = "Chek";
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    activeFrames.delete(cleanup);
    if (timer !== undefined) clearTimeout(timer);
    frame.remove();
    URL.revokeObjectURL(url);
  };
  activeFrames.add(cleanup);

  try {
    await new Promise<void>((resolve, reject) => {
      frame.addEventListener("load", () => resolve(), { once: true });
      frame.addEventListener("error", () => reject(new Error("Chop etish oynasi ochilmadi")), {
        once: true,
      });
      frame.src = url;
      document.body.appendChild(frame);
    });
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) throw new Error("Chop etish oynasi ochilmadi");

    try {
      const loaded = await Promise.all(
        RECEIPT_FONT_PROBES.map((probe) => doc.fonts.load(probe.font, probe.text)),
      );
      if (
        loaded.some((faces) => faces.length === 0 || faces.some((face) => face.status !== "loaded"))
      ) {
        throw new Error("font face missing");
      }
      await doc.fonts.ready;
    } catch (cause) {
      throw new ReceiptFontError("Chek shriftlari yuklanmadi", { cause });
    }
    await nextFrame(win);

    win.addEventListener("afterprint", () => globalThis.setTimeout(cleanup, 0), { once: true });
    timer = globalThis.setTimeout(cleanup, 10 * 60 * 1000);
    win.focus();
    win.print();
  } catch (error) {
    cleanup();
    throw error;
  }
};
