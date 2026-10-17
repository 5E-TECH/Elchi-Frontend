import type { Tone } from "../../../shared/ui/primitives";

/**
 * Amal badge'i toni (maket `superadmin-activity-logs-list`, spec G2 §3.1): «Yaratildi» / «Biriktirildi» — info,
 * «Hisob-kitob qilindi» — success, «Bekor qilindi» / «O'chirildi» — danger, qolgani (holat o'zgardi, tahrirlandi,
 * tizimga kirdi, o'tkazildi …) — neutral. Fe'llar ochiq ro'yxat (backend reyestri), shuning uchun kalit so'z bo'yicha.
 */
export const activityActionTone = (action: string): Tone => {
  const tokens = action.toLowerCase().split(/[._\s-]+/).filter(Boolean);
  const has = (re: RegExp) => tokens.some((token) => re.test(token));
  if (has(/^(cancel|cancelled|canceled|delete|deleted|remove|removed)$/)) return "danger";
  if (has(/^settle/)) return "success";
  if (has(/^(create|created|assign|assigned)$/)) return "info";
  return "neutral";
};

/** `order.status_change` → «Order status change» (reyestrda ham, tarjimada ham yo'q fe'l uchun). */
export const humanizeActivityAction = (action: string): string =>
  action
    .replace(/[._]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
