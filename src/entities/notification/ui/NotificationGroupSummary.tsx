// dizayn-v2: superadmin-notifications-delete-dialog, superadmin-notifications-deactivate-dialog, superadmin-notifications-activate-dialog
import { memo } from "react";
import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Notification } from "../model/types";
import NotificationGroupTypeBadge from "./NotificationGroupTypeBadge";

/**
 * Tasdiq oynalaridagi ob'ekt kartasi (maketlar `*-delete-dialog`, `*-deactivate-dialog`, `*-activate-dialog`):
 * market belgisi (`.el-stat-icon`, `surface` fonda), «<market> #id», xabar turi va «Guruh ID: …».
 * `ConfirmDialog` `details` ichida (`sunken` qutisi) chiziladi. Market nomi chaqiruvchidan — jadvaldagi bilan bir xil.
 */
const NotificationGroupSummary = ({
  row,
  marketName,
}: {
  row: Pick<Notification, "market_id" | "group_id" | "group_type">;
  marketName: string;
}) => {
  const { t } = useTranslation("notificationGroups");
  // Nom topilmasa sarlavhada `#id` turadi — yonida takrorlanmaydi.
  const showId = Boolean(row.market_id) && marketName !== `#${row.market_id}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
      >
        <Store size={18} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {/* Maket `.el-strong` (14 px) + `.el-cell-sub` (13 px) oddiy bo'sh joy bilan — telefonda tur belgisi bir qatorga sig'adi. */}
          <span className="text-sm font-semibold text-text">
            {marketName}
            {showId ? (
              <>
                {" "}
                <span className="text-[13px] font-normal text-text-muted tabular-nums">#{row.market_id}</span>
              </>
            ) : null}
          </span>
          <NotificationGroupTypeBadge type={row.group_type} />
        </span>
        <span className="text-[13px] text-text-muted tabular-nums [overflow-wrap:anywhere]">
          {t("deleteDialog.groupId", { id: row.group_id })}
        </span>
      </span>
    </div>
  );
};

export default memo(NotificationGroupSummary);
