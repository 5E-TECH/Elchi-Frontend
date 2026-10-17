/**
 * Ixcham pulni maketdagidek ikkiga bo'ladi: katta raqam va kichik birlik (`24,6` + `mln so'm`,
 * `.el-kpi-value` / `.el-kpi-unit`). Matnni `formatCompactMoneyLocalized` yozadi, bu yer faqat
 * raqam qismini ajratadi (en: `24.6M UZS` → `24.6` + `M UZS`). Namuna: `ui-kit` CardsSection.
 */
export const splitCompact = (formatted: string): { value: string; unit?: string } => {
  const match = /^([−-]?[\d\s.,]*\d)\s*(.*)$/u.exec(formatted);
  return match ? { value: match[1], unit: match[2] || undefined } : { value: formatted };
};

/** Reyting avatari: ism va familiyaning bosh harflari («Baraka Shop» → «BS»). */
export const toInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("") || "—";

/** Ulush (0..100) — maxraj 0 bo'lsa 0. */
export const sharePercent = (part: number, total: number) => (total > 0 ? (Math.max(0, part) / total) * 100 : 0);
