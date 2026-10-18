// dizayn-v2: (maket yo'q) courier-courier-bulk-confirm-dialog, manager-courier-bulk-main
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { Badge, Button, ButtonIcon, Dialog, TONE_SOFT } from "../../../shared/ui/primitives";
import type { CourierBulkFailure, CourierBulkOrder } from "../model/courierBulk";

/**
 * «Kunni yakunlash» NATIJASI — xato bergan har bir buyurtma backend sababi bilan (j9KFyqlS).
 * Ilgari faqat «N ta buyurtmada xatolik» bildirishnomasi chiqardi (maket `manager-courier-bulk-main`
 * «Kunni yakunlash natijasi» — faqat son): kuryer qaysi buyurtma va nima uchun o'tmaganini bilmasdi.
 * Bajarilganlar belgisi tozalanadi (avvalgidek), xato berganlar belgisi bilan ro'yxatda qoladi.
 *
 * Maket yo'q (ega qarori kerak) — eng yaqini: `courier-courier-bulk-confirm-dialog` (sarlavha,
 * `sunken` ro'yxat qatorlari) + `manager-courier-bulk-main` («Yakunlashda xatolik» matni).
 */

export type CourierBulkResult = {
  failures: ReadonlyArray<CourierBulkFailure<CourierBulkOrder>>;
  succeededCount: number;
  tomorrowCount: number;
};

type Props = {
  open: boolean;
  /** Oyna yopilib bo'lguncha saqlanadi (yopilish harakatida ro'yxat bo'shab qolmasin). */
  result: CourierBulkResult | null;
  onClose: () => void;
  onExited?: () => void;
};

const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]";

export const CourierBulkResultDialog = ({ open, result, onClose, onExited }: Props) => {
  const { t } = useTranslation("courierBulk");
  const failures = result?.failures ?? [];
  const succeededCount = result?.succeededCount ?? 0;
  const tomorrowCount = result?.tomorrowCount ?? 0;

  return (
    <Dialog
      open={open && failures.length > 0}
      onClose={onClose}
      onExited={onExited}
      size="lg"
      icon={CircleX}
      iconTone="danger"
      title={t("finalizeErrorTitle")}
      description={t("resultDescription", { count: failures.length })}
      initialFocus="panel"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t("resultClose")}
        </Button>
      }
    >
      {succeededCount > 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-sunken px-4 py-3">
          <span aria-hidden="true" className={cx(STAT_ICON, TONE_SOFT.success)}>
            <ButtonIcon icon={CircleCheck} px={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-text">
              {t("finalizeSuccessDescription", { count: succeededCount })}
            </span>
            {tomorrowCount > 0 ? (
              <span className="text-[13px] text-text-muted">
                {t("finalizeTomorrowKept", { count: tomorrowCount })}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <ul aria-label={t("resultListLabel")} className="m-0 flex list-none flex-col rounded-xl bg-sunken p-0">
        {failures.map(({ order, action, error }, index) => {
          const name = order.customer?.name?.trim() || `#${order.id}`;
          const reason = getBackendErrorMessage(error) ?? t("resultReasonUnknown");
          return (
            <li
              key={String(order.id)}
              className={cx("flex items-start gap-3 px-4 py-3", index > 0 && "border-t border-border")}
            >
              <span aria-hidden="true" className={cx(STAT_ICON, TONE_SOFT.danger)}>
                <ButtonIcon icon={CircleX} px={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 text-sm font-semibold text-text">
                    {t("orderLabel", { id: order.id, name })}
                  </span>
                  <Badge size="sm" tone={action === "cancel" ? "danger" : "success"}>
                    {t(action === "cancel" ? "actionCancel" : "actionSell")}
                  </Badge>
                </span>
                <span className="break-words text-[13px] text-danger-fg">{reason}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
};
