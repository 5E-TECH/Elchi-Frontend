// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan
import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_FG, TONE_SOFT } from "../../../shared/ui/primitives";

export type ScanMessageTone = "success" | "warn" | "error";

export type ScanMessageData = {
  tone: ScanMessageTone;
  /** Qalin qism: «№10263 — ro'yxatga qo'shildi», «Qop: 6 posilkadan 6 tasi belgilandi». */
  text: string;
  /** Kulrang davomi (maketdagi `· Rustam Jo'rayev, Olmazor tumani`). */
  detail?: string;
};

/** Xabar turi → dizayn toni (`tone.ts`). */
const TONE_OF = { success: "success", warn: "warning", error: "danger" } as const;

const ICON: Record<ScanMessageTone, LucideIcon> = {
  success: CircleCheck,
  warn: TriangleAlert,
  error: CircleX,
};

/**
 * OXIRGI SKAN NATIJASI (maket `.el-alert` + ton, `superadmin-neworders-incoming-scan`).
 *
 * Ovoz (`playScanFeedback`) bilan birga operatorga ekranda ham aytadi: qo'shildi (yashil),
 * takroriy yoki qop qisman (sariq), topilmadi / xato (qizil). Sarlavha ton rangida, davomi
 * kulrang. Xato — `role="alert"` (ekran o'quvchi darhol aytadi), qolgani — `role="status"`.
 */
export const ScanMessage = ({ message }: { message: ScanMessageData }) => {
  const tone = TONE_OF[message.tone];
  const Icon = ICON[message.tone];
  return (
    <div
      role={message.tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone])}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <p className="m-0 min-w-0 flex-1 text-text [overflow-wrap:anywhere]">
        <span className={cx("font-bold", TONE_FG[tone])}>{message.text}</span>
        {message.detail ? <span className="text-text-muted"> · {message.detail}</span> : null}
      </p>
    </div>
  );
};

export default ScanMessage;
