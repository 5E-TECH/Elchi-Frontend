/**
 * ────────────────────────────────────────────────────────────────────────────
 *  YANGI VERSIYANI ANIQLASH (ochiq turgan ilova / tab uchun)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ilova PWA: telefon yoki kompyuterga o'rnatilgani ham saytning o'zi. `index.html` keshlanmaydi
 *  (`public, max-age=0, must-revalidate`), `sw.js` fayllarni keshlamaydi — shuning uchun ilova har OCHILGANDA
 *  oxirgi versiya keladi. Faqat reliz paytida ochiq turgan ilova (fonda turgan PWA, kunlab yopilmagan tab)
 *  qayta yuklanmaguncha eski kodda qoladi. Bu modul shuni aniqlaydi: serverdagi `index.html` ni so'rab, undagi
 *  bundle fayllarini hozir ishlayotganlari bilan solishtiradi.
 *
 *  Nimani solishtiramiz (build fayli ham, versiya raqami ham kerak emas):
 *   - ENTRY skript (`<script type="module" src="/assets/index-<xesh>.js">`). Xesh mazmundan: istalgan bo'lim
 *     (lazy chunk) o'zgarsa ham entry nomi o'zgaradi — entry ularning nomlarini ichida saqlaydi. Ish vaqtida boshqa
 *     `type="module"` skript qo'shilmaydi (Vite `import()` ishlatadi, Telegram SDK — oddiy skript).
 *   - Entry CSS (`<link rel="stylesheet" href="/assets/…css">`): faqat CSS o'zgargan relizda entry JS nomi
 *     o'zgarmasligi mumkin. Joriy hujjatga ish vaqtida bo'limlarning CSS'i ham qo'shiladi, shuning uchun TENGLIK
 *     emas, «serverdagi har stylesheet hozirgi sahifada bormi» tekshiriladi — ortiqcha link soxta «yangi versiya»
 *     bermaydi.
 *  Faqat `/assets/` dagi fayllar hisobga olinadi: dev rejim (`/src/main.tsx`), xato sahifasi yoki Wi‑Fi portalining
 *  HTML'i (entry skripti yo'q) — «noma'lum», banner chiqmaydi.
 */

const ASSET_PREFIX = "/assets/";

export type BundleSignature = {
  /** Entry modul skriptining `src` atributi (aynan HTML'dagidek). */
  entry: string;
  /** `/assets/` dagi `<link rel="stylesheet">` lar `href` i. */
  styles: string[];
};

const isAsset = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.startsWith(ASSET_PREFIX);

/** Hujjatdagi bundle izi; entry skript `/assets/` da bo'lmasa — `null` (dev, begona HTML). */
export const readBundleSignature = (doc: Document): BundleSignature | null => {
  const entry = doc.querySelector('script[type="module"][src]')?.getAttribute("src");
  if (!isAsset(entry)) return null;
  const styles = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'), (link) =>
    link.getAttribute("href"),
  ).filter(isAsset);
  return { entry, styles };
};

/** Serverdagi (`latest`) build hozir ishlayotganidan (`current`) farqlimi. */
export const isNewerBundle = (current: BundleSignature, latest: BundleSignature): boolean => {
  if (latest.entry !== current.entry) return true;
  const loaded = new Set(current.styles);
  return latest.styles.some((href) => !loaded.has(href));
};

/** HTML matnidan bundle izi (skriptlar bajarilmaydi — `DOMParser`). */
export const parseBundleSignature = (html: string): BundleSignature | null =>
  readBundleSignature(new DOMParser().parseFromString(html, "text/html"));

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Serverdagi `index.html` ning bundle izi. Brauzer keshini chetlab (`no-store`) so'raladi; tarmoq xatosi,
 * 2xx bo'lmagan javob yoki HTML emas — `null` (keyingi tekshiruvda qayta urinadi).
 */
export const fetchLatestSignature = async (fetchImpl: FetchLike = fetch): Promise<BundleSignature | null> => {
  try {
    const response = await fetchImpl("/", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    return parseBundleSignature(await response.text());
  } catch {
    return null;
  }
};

/**
 * Serverda yangi versiya bormi: `true` — bor, `false` — yo'q yoki aniqlab bo'lmadi (dev rejim, oflayn, xato).
 * Joriy iz har safar hujjatdan o'qiladi: u faqat o'sadi (bo'lim CSS'lari), entry skripti o'zgarmaydi.
 */
export const checkForNewVersion = async (
  doc: Document = document,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> => {
  const current = readBundleSignature(doc);
  if (!current) return false;
  const latest = await fetchLatestSignature(fetchImpl);
  return latest !== null && isNewerBundle(current, latest);
};
