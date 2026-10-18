// dizayn-v2: (maket yo'q) superadmin-notifications-send, superadmin-notifications-create-dialog, superadmin-notifications-sms-report
import type { ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_FG, TONE_SOFT } from "../../../shared/ui/primitives";

export type NoticeAlertTone = "neutral" | "info" | "success" | "warning" | "danger";

export type NoticeAlertProps = {
  /** Ma'no rangi: `info` (ko'rsatma), `success` (natija), `warning` (to'siq), `danger` (xato); `neutral` — `sunken` izoh qutisi. */
  tone: NoticeAlertTone;
  /** Qalin sarlavha (`.el-alert-title`). */
  title?: ReactNode;
  /** Matn (13 px). Sarlavha bo'lmasa — asosiy matn. */
  children?: ReactNode;
  /** Matn ostidagi amal (`Button size="sm"`). */
  action?: ReactNode;
  /** Ikonka (sukut — tonga qarab). */
  icon?: LucideIcon;
  /** Sukut: `danger` → `alert`, qolgani `status`; `note` — doimiy izoh (maketdagi `role="note"`). */
  role?: "status" | "alert" | "note";
  id?: string;
  className?: string;
  "data-testid"?: string;
};

const DEFAULT_ICON: Record<NoticeAlertTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

/**
 * OGOHLANTIRISH QUTISI — maketdagi `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka (18 px), qalin sarlavha,
 * 13 px matn va ixtiyoriy amal. Matn neytral (`text-text`). `neutral` — maketdagi `sunken` izoh qutisi
 * («Reklama faqat roziligi bor raqamlarga ketadi…», «Taxminan 148 ta qabul qiluvchi»): matn `text-muted`.
 *
 * Bildirishnomalar bo'limi (Telegram guruhlari, xabar yuborish, SMS) uchun umumiy — `shared` ga emas, shu entity'da
 * (umumiy primitiv sifatida chiqarish — integrator qarori).
 */
export const NoticeAlert = ({
  tone,
  title,
  children,
  action,
  icon,
  role,
  id,
  className,
  "data-testid": testId,
}: NoticeAlertProps) => {
  const Icon = icon ?? DEFAULT_ICON[tone];
  const hasTitle = title !== undefined && title !== null && title !== false && title !== "";
  const hasBody =
    children !== undefined && children !== null && children !== false && children !== "";
  const neutral = tone === "neutral";

  return (
    <div
      id={id}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      data-testid={testId}
      data-tone={tone}
      className={cx(
        "flex min-w-0 items-start gap-3 rounded-xl text-sm",
        neutral ? "bg-sunken px-3 py-2.5" : cx("px-4 py-3", TONE_SOFT[tone]),
        className,
      )}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={cx("mt-px shrink-0", neutral ? "text-text-muted" : TONE_FG[tone])}
      />
      <div
        className={cx(
          "flex min-w-0 flex-1 flex-col gap-1",
          neutral ? "text-text-muted" : "text-text",
        )}
      >
        {hasTitle ? <div className="font-bold text-text">{title}</div> : null}
        {hasBody ? (
          <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div>
        ) : null}
        {action ? <div className="flex flex-wrap gap-2 pt-1">{action}</div> : null}
      </div>
    </div>
  );
};

export default NoticeAlert;
