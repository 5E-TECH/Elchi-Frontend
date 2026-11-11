import { useTranslation } from "react-i18next";
import type { ShiftPhotoStatus } from "../../../entities/payments";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import type { Tone } from "../../../shared/ui/primitives";

/**
 * BE-B: karta rasmi holati → ton (`docs/DESIGN_SYSTEM.md` §8): yuklangan — success, kutilmoqda (muddat ichida) —
 * warning, yuklanmagan (muddat tugagan yoki yo'q) — danger, talab qilinmagan — neutral.
 */
export const PHOTO_STATUS_TONE: Record<ShiftPhotoStatus, Tone> = {
  uploaded: "success",
  pending: "warning",
  missing: "danger",
  not_required: "neutral",
};

/** «Bugun, 23:00 gacha» — keyin yuklash muddati (`late_upload_deadline`); yo'q — `null`. */
export const useLateDeadlineText = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (deadline: string | null) =>
    deadline ? t("shiftCheck.report.photoStatus.until", { time: formatDateTimeLocalized(deadline, { language }) }) : null;
};
