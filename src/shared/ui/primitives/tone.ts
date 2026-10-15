/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TON (holat rangi) — dizayn v2 primitivlari uchun yagona klass xaritasi
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Badge, StatusBadge, StatCard va boshqalar holat rangini FAQAT shu yerdan
 *  oladi — har komponent o'z `bg-success-soft text-success-fg` satrini
 *  o'ylab topmasin. Ma'nosi: `docs/DESIGN_SYSTEM.md` §8, `design/CODE-MAP.md` 2.3.
 *
 *  Kontrast `tone.test.ts` da `SEMANTIC_TOKENS` bo'yicha ikkala mavzuda
 *  tekshiriladi (12–14px matn uchun ≥ 4.5:1). Tokenlar mavzuga o'zi
 *  moslashadi — `dark:` jufti yozilmaydi.
 *
 *  Holat rangi doim matn yoki ikonka bilan birga ishlatiladi (faqat rang bilan
 *  ma'no berilmaydi).
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Barcha tonlar (namuna sahifasi va testlar uchun tartib bilan). */
export const TONES: readonly Tone[] = ["neutral", "info", "success", "warning", "danger"];

/**
 * Yumshoq fon + o'qiladigan matn (badge, ikonka foni, xabar). Asosiy ko'rinish.
 * neutral — rangsiz: «Nofaol», yetkazish turi, «Yopilgan».
 */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-sunken text-text-muted",
  info: "bg-info-soft text-info-fg",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
};

/** Faqat matn/ikonka rangi (yuza ustida: `surface`, `raised`, `bg`, `sunken`). */
export const TONE_FG: Record<Tone, string> = {
  neutral: "text-text-muted",
  info: "text-info-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
};

/**
 * To'liq rangli fon + o'qiladigan matn. Maket bilan bir xil: tungi mavzuda
 * holat ranglari ochiq (`#4fc58e`, `#f1b24e`, `#ff7182`, `#6bb6f3`) va matn
 * to'q `on-solid`; kunduzgida to'q rang va oq `on-solid`. Hammasi ikkala
 * mavzuda AA (≥ 4.5:1) — `tone.test.ts` tekshiradi.
 */
export const TONE_SOLID: Record<Tone, string> = {
  neutral: "bg-text-muted text-surface",
  info: "bg-info text-on-solid",
  success: "bg-success text-on-solid",
  warning: "bg-warning text-on-solid",
  danger: "bg-danger text-on-solid",
};

/**
 * Ichki chegara (halqa) — tonning shaffof rangi bilan. Matn emas, bezak:
 * outline badge, tonli karta chegarasi. Tailwind v4 shaffoflik modifikatori
 * tokenda `color-mix()` ga aylanadi, shuning uchun mavzu bilan birga almashadi.
 * neutral — oddiy `border` tokeni (CODE-MAP: `.el-tone-neutral`).
 */
export const TONE_RING: Record<Tone, string> = {
  neutral: "ring-1 ring-inset ring-border",
  info: "ring-1 ring-inset ring-info-fg/30",
  success: "ring-1 ring-inset ring-success-fg/30",
  warning: "ring-1 ring-inset ring-warning-fg/30",
  danger: "ring-1 ring-inset ring-danger-fg/30",
};
