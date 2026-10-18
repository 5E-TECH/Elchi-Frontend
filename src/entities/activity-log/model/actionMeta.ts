import type { Tone } from "../../../shared/ui/primitives";
import type { ActivityActionMeta, ActivityLog } from "./types";

/**
 * BeePost tonlari (Tailwind rang oilasi nomi: `green`, `rose`, `slate` …) → v2 badge toni
 * (`docs/DESIGN_SYSTEM.md` §8). Ma'noli nomlar (`success` …) ham qabul qilinadi; noma'lum — neytral.
 */
const TONE_BY_NAME: Record<string, Tone> = {
  success: "success",
  green: "success",
  emerald: "success",
  teal: "success",
  lime: "success",
  danger: "danger",
  error: "danger",
  red: "danger",
  rose: "danger",
  pink: "danger",
  warning: "warning",
  amber: "warning",
  orange: "warning",
  yellow: "warning",
  info: "info",
  blue: "info",
  sky: "info",
  cyan: "info",
  indigo: "info",
  violet: "info",
  purple: "info",
  neutral: "neutral",
  slate: "neutral",
  gray: "neutral",
  zinc: "neutral",
  stone: "neutral",
};

export const actionBadgeTone = (tone?: string | null): Tone =>
  TONE_BY_NAME[String(tone ?? "").trim().toLowerCase()] ?? "neutral";

/** Yorliq na qatorda, na reyestrda bor (eski backend): «order.sell» → «Order sell». */
export const humanizeAction = (action: string): string => {
  const text = action.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** Badge uchun yorliq va ton: avval qatordagi `action_meta`, keyin reyestr, oxiri — humanize. */
export const resolveActionMeta = (
  log: Pick<ActivityLog, "action" | "action_meta">,
  registry?: ReadonlyMap<string, ActivityActionMeta>,
): { label: string; tone: Tone } => {
  const meta = log.action_meta ?? registry?.get(log.action) ?? null;
  return { label: meta?.label || humanizeAction(log.action), tone: actionBadgeTone(meta?.tone) };
};
