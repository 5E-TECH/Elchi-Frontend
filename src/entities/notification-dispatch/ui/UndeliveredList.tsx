// dizayn-v2: superadmin-notifications-send-result, superadmin-notifications-sent-detail-dialog
import { useTranslation } from "react-i18next";
import { getUserRoleLabelKey } from "../../user/lib/role";
import { cx } from "../../../shared/lib/cx";
import { Badge, DataTable, type DataTableColumn } from "../../../shared/ui/primitives";
import { failureReasonKey } from "../model/reasons";
import type { UndeliveredItem } from "../model/types";
import { FailureBadge } from "./DispatchBadges";

export type UndeliveredListProps = {
  items: readonly UndeliveredItem[];
  /** Jadval / ro'yxat nomi (sukut «Yetkazilmaganlar»). */
  label?: string;
  /**
   * Chekka: `card` — karta ichida chetma-chet (qatorlar 20 px chekka bilan, natija kartasi); `dialog` — oyna
   * tanasida (chekkasiz).
   */
  inset?: "card" | "dialog";
  busy?: boolean;
  className?: string;
};

/** Bir kanal: «Telegram  [O'tkazib yuborildi]  Telegram ulanmagan». */
const FailureLines = ({ item }: { item: UndeliveredItem }) => {
  const { t } = useTranslation("notifications");
  return (
    <div className="flex min-w-0 flex-col gap-1.5 py-1">
      {item.failures.map((failure) => {
        const reasonKey = failureReasonKey(failure.channel, failure.status, failure.reason);
        return (
          <span
            key={`${failure.channel}-${failure.status}`}
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
            data-failure={failure.channel}
          >
            <span className="min-w-[72px] text-sm font-semibold text-text">{t(`dispatch.channel.${failure.channel}`)}</span>
            <FailureBadge status={failure.status} />
            {reasonKey ? <span className="text-[13px] text-text-muted">{t(reasonKey)}</span> : null}
          </span>
        );
      })}
    </div>
  );
};

/**
 * «YETKAZILMAGANLAR» (maket `*-send-result`, `*-sent-detail-dialog`): qabul qiluvchi · rol · yetmagan kanal va
 * sabab. Telefonda (< 768) — kartalar: ism + rol, ostida kanallar. Sabab — faqat kod xaritasi (`reasons.ts`),
 * telefon raqami backenddan kelmaydi.
 */
export const UndeliveredList = ({ items, label, inset = "dialog", busy, className }: UndeliveredListProps) => {
  const { t } = useTranslation("notifications");
  const { t: tUsers } = useTranslation("users");
  const name = (item: UndeliveredItem) => item.name?.trim() || t("dispatch.undelivered.noName", { id: item.recipient_id });
  const role = (item: UndeliveredItem) => {
    const value = item.role?.split(",")[0]?.trim();
    return value ? <Badge>{tUsers(getUserRoleLabelKey(value))}</Badge> : null;
  };

  const columns: DataTableColumn<UndeliveredItem>[] = [
    {
      id: "recipient",
      header: t("dispatch.undelivered.colRecipient"),
      cell: (item) => <span className="whitespace-nowrap font-semibold text-text">{name(item)}</span>,
    },
    { id: "role", header: t("dispatch.undelivered.colRole"), cell: role },
    { id: "failures", header: t("dispatch.undelivered.colFailures"), cell: (item) => <FailureLines item={item} /> },
  ];

  return (
    <DataTable
      rows={items}
      columns={columns}
      getRowKey={(item, index) => item.notification_id || `${item.recipient_id}-${index}`}
      label={label ?? t("dispatch.undelivered.title")}
      density="compact"
      busy={busy}
      className={className}
      renderCard={(item) => (
        <div className={cx("flex min-w-0 flex-col gap-1.5 py-3", inset === "card" ? "px-5 max-md:px-4" : "px-0")}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 font-semibold text-text [overflow-wrap:anywhere]">{name(item)}</span>
            {role(item)}
          </div>
          <FailureLines item={item} />
        </div>
      )}
    />
  );
};
