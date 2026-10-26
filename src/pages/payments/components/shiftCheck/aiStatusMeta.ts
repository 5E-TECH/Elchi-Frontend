import type { ShiftAiStatus } from "../../../../entities/payments";
import type { Tone } from "../../../../shared/ui/primitives";

/** AI holati → ton (kiZgTybn; `docs/DESIGN_SYSTEM.md` §8): mos — success, mos emas / xato — danger, kutilmoqda — warning. */
export const AI_STATUS_TONE: Record<ShiftAiStatus, Tone> = {
  match: "success",
  mismatch: "danger",
  pending: "warning",
  unreadable: "warning",
  error: "danger",
  disabled: "neutral",
  not_required: "neutral",
};

/** «Agrobank · ··1234» — bank va oxirgi 4 raqam (bo'lmasa — faqat borini). */
export const cardSubtitle = (card: { bank_name?: string | null; last4?: string | null } | null | undefined) =>
  [card?.bank_name?.trim() || null, card?.last4 ? `··${card.last4}` : null].filter(Boolean).join(" · ");
