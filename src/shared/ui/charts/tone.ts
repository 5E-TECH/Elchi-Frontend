// dizayn-v2: tizim-charts
/**
 * GRAFIK TONLARI — `src/shared/ui/charts` bo'laklari uchun yagona rang xaritasi.
 *
 *  Ranglar faqat tokenlardan (`--color-*`), hex yo'q. Status (success/warning/danger) faqat
 *  yaxshi-yomon ma'nosida va doim so'z yoki ikonka bilan; `action` — «Siz» qatori, menejer
 *  hbar'lari; `neutral` — boshqa qatorlar (`chart-muted`). Ma'nosi: `design/CODE-MAP.md` §2.9.
 */

export type ChartTone = "success" | "warning" | "danger" | "info" | "neutral" | "action";

/** Muvaffaqiyat zonasi (spidometr, reyting): ≥ 70 — yaxshi, 40–70 — o'rtacha, < 40 — past. */
export const successZoneTone = (rate: number): "success" | "warning" | "danger" => {
  const value = Number.isFinite(rate) ? rate : 0;
  if (value >= 70) return "success";
  if (value >= 40) return "warning";
  return "danger";
};

/** To'liq rang (meter to'ldirishi, segment, hbar, legenda belgisi). */
export const CHART_FILL: Record<ChartTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-chart-muted",
  action: "bg-action",
};

/** Meter izi (`--meter-track`): ton yumshoq rangi; neytral — `sunken`. */
export const CHART_TRACK: Record<ChartTone, string> = {
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  info: "bg-info-soft",
  neutral: "bg-sunken",
  action: "bg-action-soft",
};

/** SVG `stroke`/`fill` uchun CSS o'zgaruvchisi (mavzu bilan o'zi almashadi). */
export const CHART_STROKE: Record<ChartTone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  neutral: "var(--color-chart-muted)",
  action: "var(--color-action)",
};

/** SVG yumshoq rang (spidometr izi, halqa izi). */
export const CHART_SOFT_STROKE: Record<ChartTone, string> = {
  success: "var(--color-success-soft)",
  warning: "var(--color-warning-soft)",
  danger: "var(--color-danger-soft)",
  info: "var(--color-info-soft)",
  neutral: "var(--color-sunken)",
  action: "var(--color-action-soft)",
};

/** Ikonka chipi (`.el-gauge-stat-icon`, `.el-stat-icon` + ton). */
export const CHART_SOFT: Record<ChartTone, string> = {
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
  info: "bg-info-soft text-info-fg",
  neutral: "bg-sunken text-text-muted",
  action: "bg-action-soft text-action-fg",
};

/** 0..100 oralig'iga qisish (NaN → 0). */
export const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};
