// dizayn-v2: (maket yo'q) manager-new-orders-delete-confirm-dialog
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../../../../shared/config/queryKeys";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { useConfirm } from "../../../../shared/ui/primitives";
import { getDistrictName, readOrderMarket, type OrderDetail } from "./orderDetailModel";

/** `useOrders().deleteOrder` (`DELETE /orders/:id`) — sahifa o'zi beradi (ikkinchi `useOrders()` yaratilmaydi). */
type DeleteOrderMutation = { mutateAsync: (orderId: string) => Promise<unknown> };

/**
 * hfkhYrGk №6 — superadmin qabul qilingan (kuryerga berilmagan) ombor buyurtmasini tafsilotdan o'chiradi
 * (ruxsat — `orderDetailAccess.canDelete`). Maket yo'q — eng yaqini: sarlavha tugmasi `manager-orders-detail` dagi
 * «Bekor qilish» (`danger-soft`), tasdiq oynasi `manager-new-orders-delete-confirm-dialog` («Buyurtmani o'chirish»,
 * «№… · mijoz», «market · tuman», «Jami summa», «O'chirish»). Matn ombor bandini aytadi: backend o'chirishda bandni
 * bo'shatadi. Xato oynaning o'zida (backend matni), oyna ochiq qoladi; muvaffaqiyatda ombor keshi yangilanadi,
 * xabar chiqadi va sahifa orqaga qaytadi (buyurtma endi yo'q).
 */
export const useDeleteWarehouseOrder = ({
  order,
  deleteOrder,
  onDeleted,
}: {
  order: OrderDetail | null;
  deleteOrder: DeleteOrderMutation;
  onDeleted: () => void;
}) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!order) return;
    const id = order.id;
    const place = [readOrderMarket(order)?.name ?? null, getDistrictName(order)].filter(Boolean);
    const ok = await confirm({
      tone: "danger",
      icon: Trash2,
      title: t("orderDetail.deleteTitle"),
      description: t("orderDetail.deleteWarehouseDescription"),
      details: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
            <span className="font-semibold">
              №{id} · {order.customer.name || "—"}
            </span>
            {place.length > 0 ? (
              <span className="inline-flex flex-wrap gap-x-1 text-text-muted">
                {place.map((part, index) => (
                  <span key={index} className="whitespace-nowrap">
                    {index > 0 ? <span aria-hidden="true">· </span> : null}
                    {part}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex flex-col gap-0.5 text-right">
            <span className="text-xs text-text-muted">{t("orderDetail.deleteTotal")}</span>
            <span className="whitespace-nowrap font-semibold">
              {formatMoneyLocalized(order.total_price, { language })}
            </span>
          </div>
        </div>
      ),
      irreversible: true,
      confirmLabel: t("orderDetail.deleteConfirm"),
      confirmIcon: Trash2,
      loadingLabel: t("orderDetail.deleting"),
      onConfirm: () => deleteOrder.mutateAsync(id),
    });
    if (!ok) return;
    // Band bo'shadi — ombor qoldig'i, KPI va jurnal yangilansin (`deleteOrder` faqat buyurtmalar keshini yangilaydi).
    void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    notify.success(t("orderDetail.deleted", { id }), { description: t("orderDetail.deletedWarehouseDescription") });
    onDeleted();
  }, [confirm, deleteOrder, language, onDeleted, order, queryClient, t]);
};
