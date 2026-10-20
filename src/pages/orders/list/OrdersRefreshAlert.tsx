// dizayn-v2: superadmin-orders-list-refresh-error, manager-orders-list-all-refresh-error, courier-orders-pending-refresh-error
import { TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, IconButton, TONE_SOFT } from "../../../shared/ui/primitives";

/**
 * «Ro'yxat yangilanmadi» (OR-1, maket `*-orders-list-refresh-error`, taxta `tizim--main` «Xabar bloklari»):
 * yangilash yiqildi, eski qatorlar ko'rinib turadi. «Qayta urinish» — ro'yxat va tab sonlarini qayta so'raydi;
 * × — yopadi (ega javobi S3). Xom backend matni ko'rsatilmaydi.
 *
 * `withCounts` — kuryer (tab sonlari bor): «Ro'yxat va tab sonlari eskirgan bo'lishi mumkin.»; boshqa rollarda
 * tab sonlari yo'q (OR-2) — «Ro'yxat eskirgan bo'lishi mumkin.»
 */
export const OrdersRefreshAlert = ({
  withCounts = false,
  retrying,
  onRetry,
  onDismiss,
  className,
}: {
  withCounts?: boolean;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  className?: string;
}) => {
  const { t } = useTranslation("orders");
  return (
    <div
      role="status"
      className={cx("flex items-center gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning, className)}
    >
      <TriangleAlert aria-hidden="true" size={20} strokeWidth={2} className="mt-px shrink-0 self-start" />
      <div className="flex min-w-0 flex-auto flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_220px] text-text">
          <p className="font-bold">{t("ordersList.refreshErrorTitle")}</p>
          <p className="text-[13px] text-text-muted">
            {withCounts ? t("ordersList.refreshErrorTextWithCounts") : t("ordersList.refreshErrorText")}
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
          {t("states.retry", { ns: "ui" })}
        </Button>
      </div>
      <IconButton
        icon={X}
        label={t("ordersList.refreshDismiss")}
        className="-m-2.5 self-start"
        onClick={onDismiss}
      />
    </div>
  );
};
