// dizayn-v2: superadmin-notifications-telegram-groups, superadmin-notifications-row-menu-inactive
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { inactiveReasonKey } from "../lib/inactiveReason";
import type { Notification } from "../model/types";

export type NotificationInactiveNoteProps = {
  row: Pick<Notification, "is_active" | "inactive_reason" | "inactive_at">;
  /** Matn klassi (sukut — maket `.el-xs .el-muted`). */
  className?: string;
};

/**
 * «Nofaol» belgisi ostidagi izoh (G085w5Qr, NG-C; maket `*-notifications-telegram-groups`, `*-row-menu-inactive`):
 * sababga xos matn — «Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring», «Guruh topilmadi — ulanishni
 * o'chirib, qayta ulang», «Qo'lda nofaol qilingan» …; sabab noma'lum (`null` yoki yangi qiymat) — umumiy neytral
 * izoh (D1). `inactive_at` bo'lsa — ostida «{sana} dan beri» (`<time>`). Faol qatorda hech narsa chizilmaydi.
 */
const NotificationInactiveNote = ({ row, className = "text-xs text-text-muted" }: NotificationInactiveNoteProps) => {
  const { t, i18n } = useTranslation("notificationGroups");
  if (row.is_active) return null;
  const key = inactiveReasonKey(row.inactive_reason);
  const since = toValidDate(row.inactive_at) ? row.inactive_at : null;

  return (
    <span className={cx("flex min-w-0 flex-col gap-0.5", className)} data-inactive-reason={key}>
      <span>{key === "unknown" ? t("status.inactiveHint") : t(`status.reason.${key}`)}</span>
      {since ? (
        <time dateTime={since} className="tabular-nums">
          {t("status.inactiveSince", {
            date: formatDateTimeLocalized(since, { language: i18n.resolvedLanguage ?? i18n.language }),
          })}
        </time>
      ) : null}
    </span>
  );
};

export default memo(NotificationInactiveNote);
