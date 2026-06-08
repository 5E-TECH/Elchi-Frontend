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

/** Tone aksent rangini qaytaradi (inline style uchun). */
export const toneAccent = (tone: Tone): string => TONE[tone].accent;

/** Tone'ning yumshoq (shaffof) foni — badge/ikona orqa foni uchun. */
export const toneSoftBg = (tone: Tone, percent = 14): string =>
  `color-mix(in srgb, ${TONE[tone].accent} ${percent}%, transparent)`;

// ─── Typografiya shkalasi ────────────────────────────────────────────────────
// Tailwind utility klasslari sifatida — JSX'da `className={TYPO.metricValue}`.
// Bir xil sarlavha/qiymat/yorliq o'lchamlari butun ilova bo'ylab.
export const TYPO = {
  /** Sahifa sarlavhasi */
  pageTitle: "text-[20px] font-bold tracking-tight",
  /** Bo'lim sarlavhasi (widget title) */
  sectionTitle: "text-[15px] font-semibold tracking-[-0.1px]",
  /** Karta sarlavhasi */
  cardTitle: "text-[13px] font-semibold leading-tight",
  /** Katta raqamli ko'rsatkich (KPI value) */
  metricValue: "text-[28px] font-bold leading-none tracking-tight",
  /** O'rta raqamli ko'rsatkich (kichikroq karta) */
  metricValueSm: "text-[22px] font-bold leading-none tracking-tight",
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
  metric: "min-h-[132px]",
  finance: "min-h-[160px]",
} as const;

// ─── Matn rang token'lari (inline style uchun) ───────────────────────────────
export const TEXT = {
  strong: "var(--color-dashboard-text-muted)", // asosiy o'qiladigan matn
  soft: "var(--color-dashboard-text-soft)", // yumshoq yordamchi matn
  borderSoft: "var(--color-border-soft)",
} as const;

// ─── Formatlash yordamchilari ────────────────────────────────────────────────
const nf = new Intl.NumberFormat("uz-UZ");

/** Butun son: 12345 → "12 345" */
export const formatNumber = (value: number): string =>
  nf.format(Math.round(value || 0)).replace(/\s/g, " ");

/** Pul (so'm): minglik ajratgich bilan. */
export const formatMoney = (value: number): string => formatNumber(value);

/**
 * Ixcham pul: katta summalar uchun qisqartma — 1 250 000 → "1.25M".
 * Kartalarda joy tejash uchun.
 */
export const formatCompactMoney = (value: number): string => {
  const v = value || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} mlrd`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} mln`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)} ming`;
  return formatNumber(v);
};

/** Foiz: 42.5 → "42.5%". `digits` — kasr xonalari. */
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
