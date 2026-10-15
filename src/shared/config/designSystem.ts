import { formatCompactMoneyLocalized, formatNumberLocalized } from "../lib/formatMoney";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  ELCHI DESIGN SYSTEM — yagona stil manbasi (single source of truth)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  MAQSAD: Har bir sahifa bir xil rang, shrift, oraliq (spacing), radius va
 *  formatlash standartidan foydalanishi uchun. Yangi UI yozayotganda ranglarni
 *  yoki o'lchamlarni "qo'lda" yozma — shu fayldagi token'lardan foydalan.
 *
 *  Ranglar `src/index.css` dagi `@theme` CSS o'zgaruvchilariga bog'langan, shuning
 *  uchun light/dark rejim avtomatik ishlaydi. Bu yerda faqat "semantik nom →
 *  CSS o'zgaruvchi" xaritasi va matnli (inline style uchun) qiymatlar saqlanadi.
 *
 *  KENGAYTIRISH: yangi semantik tone yoki o'lcham kerak bo'lsa — shu yerga qo'sh,
 *  komponentlarda esa token nomidan foydalan.
 *
 *  ⚠️ DIZAYN v2 HOLATI (docs/DESIGN_SYSTEM.md §7):
 *   - v2 da RUXSAT: `formatNumber`, `formatMoney`, `formatCompactMoney`, `formatCompactAxisMoney` (formatMoney.ts
 *     ustidagi yupqa o'ramlar), `ratio`.
 *   - v1 (@deprecated, yangi kodda yo'q — design guard `v1-helper` qoidasi sanaydi): `TONE`, `toneAccent`,
 *     `toneSoftBg`, `TYPO`, `TEXT`, `formatPercent`. O'rniga: `*-fg` / `*-soft` tokenlari, Tailwind tipografiya
 *     (§4), `formatPercentLocalized`. Sahifalar 4-bosqichda ko'chiriladi.
 */

// ─── Tone (semantik rang variantlari) ───────────────────────────────────────
// Har bir "tone" — bir metrikaning ma'nosi (ijobiy/salbiy/neytral/ogohlantirish).
export type Tone =
  | "brand" // asosiy brend (ko'k-binafsha) — neytral asosiy ko'rsatkich
  | "info" // ma'lumot (ko'k) — umumiy sonlar
  | "success" // ijobiy (yashil) — sotilgan, foyda, o'sish
  | "danger" // salbiy (qizil) — bekor qilingan, yo'qotish
  | "warning" // ogohlantirish (sariq/to'q sariq) — jarayonda, kutilmoqda
  | "neutral"; // betaraf (kulrang) — yordamchi ko'rsatkichlar

/**
 * Tone → CSS `var(--color-*)` xaritasi.
 * `accent` — asosiy aksent (chiziq, ikona foni).
 * `softBg` — yumshoq fon (badge, ikona orqa foni uchun color-mix bilan).
 */
/** @deprecated v1 — eski `--color-main/error/dashboard-*` nomlariga boradi. v2: `text-*-fg`, `bg-*-soft` tokenlari. */
export const TONE: Record<Tone, { accent: string; cssVar: string }> = {
  brand: { accent: "var(--color-main)", cssVar: "--color-main" },
  info: { accent: "var(--color-info)", cssVar: "--color-info" },
  success: { accent: "var(--color-success)", cssVar: "--color-success" },
  danger: { accent: "var(--color-error)", cssVar: "--color-error" },
  warning: { accent: "var(--color-warning)", cssVar: "--color-warning" },
  neutral: {
    accent: "var(--color-dashboard-text-muted)",
    cssVar: "--color-dashboard-text-muted",
  },
};

/** @deprecated v1 — v2: `text-*-fg` / `bg-*` tokenlari. Tone aksent rangini qaytaradi (inline style uchun). */
export const toneAccent = (tone: Tone): string => TONE[tone].accent;

/** @deprecated v1 — v2: `bg-*-soft` tokenlari. Tone'ning yumshoq (shaffof) foni — badge/ikona orqa foni uchun. */
export const toneSoftBg = (tone: Tone, percent = 14): string =>
  `color-mix(in srgb, ${TONE[tone].accent} ${percent}%, transparent)`;

// ─── Typografiya shkalasi ────────────────────────────────────────────────────
// Tailwind utility klasslari sifatida — JSX'da `className={TYPO.metricValue}`.
// Bir xil sarlavha/qiymat/yorliq o'lchamlari butun ilova bo'ylab.
/** @deprecated v1 — v2 tipografiyasi: docs/DESIGN_SYSTEM.md §4 (Tailwind klasslari + tokenlar). */
export const TYPO = {
  /** Sahifa sarlavhasi */
  pageTitle: "text-[18px] font-bold tracking-tight sm:text-[20px]",
  /** Bo'lim sarlavhasi (widget title) */
  sectionTitle: "text-[15px] font-semibold tracking-[-0.1px]",
  /** Karta sarlavhasi */
  cardTitle: "text-[13px] font-semibold leading-tight",
  /** Katta raqamli ko'rsatkich (KPI value) */
  metricValue: "text-[23px] font-bold leading-none tracking-tight sm:text-[28px]",
  /** O'rta raqamli ko'rsatkich (kichikroq karta) */
  metricValueSm: "text-[20px] font-bold leading-none tracking-tight sm:text-[22px]",
  /** Yorliq / izoh matni */
  label: "text-[12px] font-semibold",
  /** Yumshoq yordamchi matn */
  muted: "text-[11px] font-medium",
  /** Badge (foiz, trend) */
  badge: "text-[11px] font-bold",
} as const;

// ─── O'lchov shkalasi (radius / spacing / minHeight) ─────────────────────────
export const RADIUS = {
  card: "rounded-2xl", // 16px — kartalar
  control: "rounded-xl", // 12px — tugma, ikona qutisi
  pill: "rounded-full", // badge / pill
} as const;

export const GAP = {
  grid: "gap-4", // kartalar orasidagi standart oraliq
  tight: "gap-2",
  section: "mb-5", // bo'limlar orasidagi vertikal oraliq
} as const;

export const CARD_MIN_H = {
  metric: "min-h-[118px] sm:min-h-[132px]",
  finance: "min-h-[160px]",
} as const;

// ─── Matn rang token'lari (inline style uchun) ───────────────────────────────
/** @deprecated v1 — v2: `text-text`, `text-text-muted`, `text-text-subtle` tokenlari. */
export const TEXT = {
  strong: "var(--color-dashboard-text-muted)", // asosiy o'qiladigan matn
  soft: "var(--color-dashboard-text-soft)", // yumshoq yordamchi matn
  borderSoft: "var(--color-border-soft)",
} as const;

// ─── Formatlash yordamchilari ────────────────────────────────────────────────
// Dizayn v2: hammasi `shared/lib/formatMoney.ts` ga tayanadi — joriy tilga mos
// (uz "12 345", en "12,345") va brauzer ICU'siga bog'liq emas (Chrome'da `uz`
// yo'q, `Intl.NumberFormat("uz-UZ")` u yerda "12,345" berardi).

/** Butun son: 12345 → uz "12 345" / en "12,345". */
export const formatNumber = (value: number): string =>
  formatNumberLocalized(Math.round(value || 0));

/** Pul (valyutasiz raqam) — valyuta yorlig'i chaqiruvchi tomonda qo'shiladi. */
export const formatMoney = (value: number): string => formatNumber(value);

/**
 * Ixcham pul (valyutasiz): 1 250 000 → uz "1,3 mln" / ru "1,3 млн" / en "1.3M".
 * Kartalar va grafik o'qlari uchun; valyuta bilan kerak bo'lsa —
 * `formatCompactMoneyLocalized` (shared/lib/formatMoney).
 */
export const formatCompactMoney = (value: number): string =>
  formatCompactMoneyLocalized(value || 0, { withCurrency: false });

/**
 * Grafik o'qi uchun ixcham son — 2 xonagacha (ortiqcha nollar tashlanadi):
 * 1 050 000 → "1,05 mln", 3 000 000 → "3 mln". KPI kartalarda `formatCompactMoney`.
 */
export const formatCompactAxisMoney = (value: number): string =>
  formatCompactMoneyLocalized(value || 0, { withCurrency: false, fractionDigits: 2 });

/** @deprecated v1 — har tilda nuqta ("42.5%"). v2: `formatPercentLocalized` (formatMoney.ts) → uz "42,5%". */
export const formatPercent = (value: number, digits = 1): string =>
  `${(value || 0).toFixed(digits)}%`;

/** Soat → o'qiladigan davomiylik: 1.5 → "1 soat 30 daq", 0.5 → "30 daq". */
export const formatHours = (hours: number): string => {
  const h = Math.max(0, hours || 0);
  if (h === 0) return "—";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (whole === 0) return `${mins} daq`;
  if (mins === 0) return `${whole} soat`;
  return `${whole} soat ${mins} daq`;
};

/**
 * Nisbat (foiz) — payda / butun. 0 ga bo'linishdan himoyalangan.
 * Masalan success rate = sold / accepted * 100.
 */
export const ratio = (part: number, total: number): number =>
  total > 0 ? (part / total) * 100 : 0;
