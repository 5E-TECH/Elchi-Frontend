// dizayn-v2: (maket yo'q) superadmin-payments-shift-report
import { Check, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ShiftPhotoStatus } from "../../../entities/payments";
import { Badge } from "../../../shared/ui/primitives";
import { PHOTO_STATUS_TONE } from "./photoStatusMeta";

/**
 * BE-B — smena hisobotidagi karta rasmi holati (`photo_status`). Maketda bu belgi yo'q — eng yaqini
 * `superadmin-payments-shift-report` dagi AI holati belgilari (`docs/DESIGN_SYSTEM.md` §8): «Yuklangan» — success,
 * «Rasm kutilmoqda» — warning (muddat ichida yuklash mumkin), «Rasm yuklanmagan» — danger (muddat tugagan yoki yo'q),
 * «Talab qilinmagan» — neutral. Rang doim matn bilan birga. Kech yuklangan rasm — «Keyin yuklandi» (info).
 */

export const PhotoStatusBadge = ({ status }: { status: ShiftPhotoStatus }) => {
  const { t } = useTranslation("payments");
  return (
    <Badge
      tone={PHOTO_STATUS_TONE[status]}
      icon={status === "uploaded" ? Check : status === "pending" ? Clock : undefined}
      dot={status === "missing"}
    >
      {t(`shiftCheck.report.photoStatus.${status}`)}
    </Badge>
  );
};

/** Rasm smena yopilgandan keyin yuklangan (`late_uploaded`). */
export const LateUploadedBadge = () => {
  const { t } = useTranslation("payments");
  return <Badge tone="info">{t("shiftCheck.report.photoStatus.lateUploaded")}</Badge>;
};
