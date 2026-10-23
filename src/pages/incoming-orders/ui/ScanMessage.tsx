// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan, registrator-new-orders-incoming-scan
import { CircleCheck, CircleX, TriangleAlert, Undo2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, IconButton, TONE_FG, TONE_SOFT } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";

export type ScanMessageTone = "success" | "warn" | "error";

export type ScanMessageData = {
  tone: ScanMessageTone;
  /** Qalin qism: «№10263 — ro'yxatga qo'shildi», «Qop: 6 posilkadan 6 tasi belgilandi». */
  text: string;
  /** Kulrang davomi (maketdagi `· Rustam Jo'rayev, Olmazor tumani`). */
  detail?: string;
  /**
   * Shu skan belgilagan posilkalar (id) — «Olib tashlash» faqat ularni oladi (qop skanida qopning shu skan
   * belgilagan a'zolari, oldin bittalab skanerlanganlari emas).
   */
  undoIds?: readonly string[];
};

/** «Olib tashlash» — sahifa beradi, faqat shu skanning belgilari hali turgan bo'lsa. */
export type ScanMessageUndo = {
  /** Tugma nomi (`aria-label`): «№10263 ni ro'yxatdan olib tashlash». */
  label: string;
  onUndo: () => void;
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
 *
 * «Olib tashlash» (maket: desktopda ghost tugma `Undo2` + matn, telefonda 44 px ikonka tugma) — xato skan
 * belgisini darhol olish (eo3eeJxs). Server so'rovi yo'q: belgi faqat ekranda, qabul — «Qabul qilish» bilan.
 */
export const ScanMessage = ({ message, undo }: { message: ScanMessageData; undo?: ScanMessageUndo | null }) => {
  const { t } = useTranslation("common");
  const isPhone = useIsPhone();
  const tone = TONE_OF[message.tone];
  const Icon = ICON[message.tone];
  return (
    <div
      role={message.tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cx(
        "flex min-w-0 gap-3 rounded-xl px-4 py-3 text-sm",
        undo ? "items-center" : "items-start",
        TONE_SOFT[tone],
      )}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <p className="m-0 min-w-0 flex-1 text-text [overflow-wrap:anywhere]">
        <span className={cx("font-bold", TONE_FG[tone])}>{message.text}</span>
        {message.detail ? <span className="text-text-muted"> · {message.detail}</span> : null}
      </p>
      {undo ? (
        isPhone ? (
          <IconButton icon={Undo2} label={undo.label} className="-my-2 -mr-2" onClick={undo.onUndo} />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={Undo2}
            aria-label={undo.label}
            className="-mx-2 -my-1 shrink-0"
            onClick={undo.onUndo}
          >
            {t("incoming.unscan")}
          </Button>
        )
      ) : null}
    </div>
  );
};

export default ScanMessage;
