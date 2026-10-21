import type { Tone } from "../../../../shared/ui/primitives";

/**
 * Smena farqi (sanalgan − kutilgan) holati: manfiy — «Kamomad» (danger), musbat — «Ortiqcha» (warning),
 * nol — «Mos keldi» (success), sanalmagan (`null`) — «Sanalmadi» (neutral). Maketlar: `*-shift-dialog`,
 * `*-shift-result-dialog`. Butun so'mga yaxlitlab solishtiriladi (backend `numeric(20,2)`).
 */
export type ShiftDiffKind = "shortage" | "surplus" | "match" | "notCounted";

export const SHIFT_DIFF_TONE: Record<ShiftDiffKind, Tone> = {
  shortage: "danger",
  surplus: "warning",
  match: "success",
  notCounted: "neutral",
};

export const shiftDiffKind = (diff: number | null | undefined): ShiftDiffKind => {
  if (diff === null || diff === undefined || !Number.isFinite(diff)) return "notCounted";
  const rounded = Math.round(diff);
  if (rounded === 0) return "match";
  return rounded < 0 ? "shortage" : "surplus";
};

/** Sanalgan summa bo'yicha farq: sanalmagan (`null`) yoki kutilgan noma'lum — `null`. */
export const computeShiftDiff = (counted: number | null, expected: number | null | undefined): number | null =>
  counted === null || expected === null || expected === undefined || !Number.isFinite(expected)
    ? null
    : counted - expected;
