export const extractScannerToken = (value: string, origin?: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decodeToken = (candidate?: string | null) => {
    if (!candidate) return null;

    try {
      return decodeURIComponent(candidate.trim()) || null;
    } catch {
      return candidate.trim() || null;
    }
  };

  const scanMatch = trimmed.match(/\/scan\/([^/?#\s]+)/i);
  const matchedToken = decodeToken(scanMatch?.[1]);
  if (matchedToken) return matchedToken;

  try {
    const url = new URL(trimmed, origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === "scan");
    const token = decodeToken(scanIndex >= 0 ? parts[scanIndex + 1] : parts.at(-1));

    if (token) return token;
  } catch {
    // Scanner may send only token/id instead of a full URL.
  }

  return /^[A-Za-z0-9_-]{1,}$/u.test(trimmed) ? trimmed : null;
};

export const normalizeScannerCandidates = (value: string, origin?: string) => {
  const trimmed = value.trim();
  const candidates = new Set<string>();

  const addCandidate = (candidate?: string | null) => {
    if (!candidate) return;

    try {
      const decoded = decodeURIComponent(candidate.trim());
      if (decoded) candidates.add(decoded.toLowerCase());
    } catch {
      const fallback = candidate.trim();
      if (fallback) candidates.add(fallback.toLowerCase());
    }
  };

  addCandidate(extractScannerToken(trimmed, origin));
  addCandidate(trimmed);

  const scanMatch = trimmed.match(/\/scan\/([^/?#\s]+)/i);
  addCandidate(scanMatch?.[1]);

  try {
    const url = new URL(trimmed, origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === "scan");
    addCandidate(scanIndex >= 0 ? parts[scanIndex + 1] : parts.at(-1));
  } catch {
    // Scanner may send only token/id instead of a full URL.
  }

  return [...candidates];
};

/**
 * Kirill tartibidagi tugma → o'sha tugmaning US (QWERTY) belgisi: ruscha ЙЦУКЕН va o'zbekcha kirill tartibi
 * (`ў` — O, `қ` — S, `ғ` — minus, `ҳ` — teng). Ikkala tartibda `/` tugmasi «.», Shift bilan «,» beradi.
 */
const CYRILLIC_KEYS: Readonly<Record<string, string>> = {
  ё: "`", ғ: "-", ҳ: "=",
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o", ў: "o", з: "p", х: "[", ъ: "]",
  ф: "a", ы: "s", қ: "s", в: "d", а: "f", п: "g", р: "h", о: "j", л: "k", д: "l", ж: ";", э: "'",
  я: "z", ч: "x", с: "c", м: "v", и: "b", т: "n", ь: "m", б: ",", ю: ".", ".": "/", ",": "?",
};

/** Shift bilan harf emas, belgi chiqadigan tugmalar. */
const CYRILLIC_SHIFTED_KEYS: Readonly<Record<string, string>> = {
  ё: "~", ғ: "_", ҳ: "+", х: "{", ъ: "}", ж: ":", э: '"', б: "<", ю: ">",
};

/**
 * KIRILL KLAVIATURA TARTIBIDA YOZILGAN KODNI LOTINGA QAYTARADI (rQX8TqRV).
 *
 * Skaner tugma kodini yuboradi: OS da rus/o'zbek kirill tartibi yoqiq bo'lsa, maydonga `3с9в1с…` yoziladi
 * (`c` → «с», `d` → «в», `f` → «а»). Aylantirish TOVUSHGA emas, TUGMAGA qarab: kirill «а» lotin «a» ga o'xshaydi,
 * lekin u `F` tugmasida. Fokussiz yo'lda buni `readScannerKey` (`useKeyboardScanner`) tugma kodidan tiklaydi;
 * maydonga yozilgan matnda esa tugma kodi yo'q, faqat belgining o'zi qoladi.
 *
 * Kirill harfi yo'q qiymat o'zgarmaydi, ya'ni lotin kod va uning «.» / «,» belgilari buzilmaydi. Registr saqlanadi.
 */
export const latinizeKeyboardLayout = (value: string) => {
  if (!/\p{Script=Cyrillic}/u.test(value)) return value;

  return Array.from(value, (char) => {
    const lower = char.toLowerCase();
    const latin = CYRILLIC_KEYS[lower];
    if (latin === undefined) return char;
    if (char === lower) return latin;
    return CYRILLIC_SHIFTED_KEYS[lower] ?? latin.toUpperCase();
  }).join("");
};

/**
 * Solishtirish kaliti: kirill tartibi → lotin, keyin kichik harf. Ro'yxatdagi token shu bilan kalitga aylanadi;
 * skanerlangan qiymat `scanKeyCandidates` bilan AYNAN shu shaklga keladi. Serverga kalit emas, asl token ketadi.
 */
export const normalizeScanKey = (token: string) => latinizeKeyboardLayout(token.trim()).toLowerCase();

/**
 * Skanerlangan qiymatning solishtirish kalitlari: `normalizeScannerCandidates` + kirill tartibi. Nomzodlar
 * shu yerda kengaytiriladi, chunki `normalizeScannerCandidates` ni boshqa skan ekranlari ham ishlatadi.
 */
export const scanKeyCandidates = (value: string, origin?: string) =>
  normalizeScannerCandidates(latinizeKeyboardLayout(value), origin);

/**
 * Begona havola: to'liq `http(s)` manzil, unda `/scan/` bo'lagi yo'q va u ilovaning o'z manzili emas
 * (masalan market yoki ishlab chiqaruvchi sayti `https://barakashop.uz/mahsulot/48213`). Bunday QR Elchi
 * yorlig'i emas — `extractScannerToken` uning oxirgi bo'lagini token deb olmasin (maket `courier-scan-invalid`).
 */
export const isForeignScanUrl = (value: string, origin?: string) => {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.pathname.split("/").some((part) => part.toLowerCase() === "scan")) return false;
  return !origin || url.origin !== new URL(origin).origin;
};
