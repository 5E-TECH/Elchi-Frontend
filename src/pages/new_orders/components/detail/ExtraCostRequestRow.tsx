// dizayn-v2: (maket yo'q) superadmin-orders-detail, courier-orders-detail
import { useTranslation } from "react-i18next";
import {
  readExtraCostRequest,
  useFormatExtraCostItems,
} from "../../../../entities/orders/extraCostRequest";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { Badge } from "../../../../shared/ui/primitives";
import {
  EXTRA_COST_STATUS_META,
  extraCostStatusKind,
} from "../../../extra-costs/model/extraCostsView";
import type { OrderDetail } from "./orderDetailModel";

/**
 * «QO'SHIMCHA XARAJAT» qatori (SPEC v2) — «To'lov» kartasining `dl` i ichida: summa, holat («Tasdiq kutilmoqda»,
 * «Tasdiqlandi», «Rad etildi» …), qaysi tovar uchun («Telefon g'ilofi ×1, Zaryadka ×2»), kutilayotganda avtomatik
 * tasdiq muddati, rad etilganda sababi. Manba — buyurtmaning `extra_cost_request` maydoni (har holat va rejimda);
 * yo'q bo'lsa qator chizilmaydi.
 *
 * Maket yo'q — eng yaqini `*-orders-detail` «To'lov» qatorlari (chap — yorliq, o'ng — summa); holat nomi va toni
 * «Qo'shimcha xarajatli buyurtmalar» sahifasidagi bilan bir xil (`extraCostsView`).
 */
export const ExtraCostRequestRow = ({
  order,
  className,
}: {
  order: OrderDetail;
  className?: string;
}) => {
  const { t, i18n } = useTranslation(["orders", "extraCosts", "dashboard"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const formatItems = useFormatExtraCostItems();
  const request = readExtraCostRequest(order.extra_cost_request);
  if (!request) return null;

  const kind = extraCostStatusKind(request);
  const meta = EXTRA_COST_STATUS_META[kind];
  const items = formatItems(request.items, request.action, 5);
  const reason =
    request.status === "rejected"
      ? (request.reject_reason_label ??
        (request.reject_reason
          ? t(`dashboard:market.extra_cost_reject_reasons.${request.reject_reason}`, {
              defaultValue: request.reject_reason,
            })
          : null))
      : null;
  const autoAt =
    request.status === "pending" && request.auto_approve_at
      ? t("extraCosts:autoAt", {
          time: formatDateTimeLocalized(request.auto_approve_at, { language }),
        })
      : null;

  return (
    <div
      data-payment="extraCost"
      className={cx(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 py-3",
        className,
      )}
    >
      <dt className="text-text-muted">{t("orders:orderDetail.extraCost.label")}</dt>
      <dd className="m-0 whitespace-nowrap font-semibold text-text tabular-nums">
        {formatMoneyLocalized(request.amount, { language })}
      </dd>
      <dd className="col-span-2 m-0 flex flex-col items-start gap-1 text-[13px]">
        <Badge tone={meta.tone} icon={meta.icon} data-extra-cost-status={kind}>
          {t(`extraCosts:status.${kind}`)}
        </Badge>
        {items ? (
          <span className="text-text-muted">
            {t("orders:orderDetail.extraCost.items", { items })}
          </span>
        ) : null}
        {autoAt ? <span className="text-text-muted">{autoAt}</span> : null}
        {reason ? (
          <span className="text-text">{t("orders:orderDetail.extraCost.reason", { reason })}</span>
        ) : null}
      </dd>
    </div>
  );
};
