import { useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PostOrder } from "../../../../entities/mails";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { Badge } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { readCustomerName, readCustomerPhone } from "../lib/mailSearch";

/**
 * Pochta buyurtmasi qatorining ko'rinish ma'lumoti — jadval kataklari (`OrdersTable`) va telefon kartasi
 * (`OrderRow`) bir xil matnni oladi: mijoz (turli API shakllari), telefon (`formatPhone`), tuman, manzil,
 * market, sana (`formatDateTimeLocalized`; tarixda — faqat kun), yetkazish badge'i («Uygacha» / «Markazgacha»).
 */
const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};

/** Sana ustuni va saralash — buyurtmaning oxirgi yangilangan vaqti (v1 dagidek). */
export const orderRowDate = (order: PostOrder) => order.updatedAt ?? order.createdAt;

export type OrderRowView = {
  customerName: (order: PostOrder) => string;
  customerPhone: (order: PostOrder) => string;
  district: (order: PostOrder) => string | null;
  address: (order: PostOrder) => string | null;
  /** Telefon kartasi va planshet katagi uchun: tuman, bo'lmasa manzil. */
  place: (order: PostOrder) => string | null;
  market: (order: PostOrder) => string | null;
  date: (order: PostOrder) => string;
  deliveryBadge: (order: PostOrder) => ReactNode;
  money: (value: unknown) => string;
};

export const useOrderRowView = ({ history = false }: { history?: boolean } = {}): OrderRowView => {
  const { t, i18n } = useTranslation(["mails", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const customerName = useCallback((order: PostOrder) => readCustomerName(order) || "—", []);

  const customerPhone = useCallback(
    (order: PostOrder) => {
      const raw = readCustomerPhone(order);
      return raw ? formatPhone(raw) || raw : t("mails:phoneUnavailable");
    },
    [t],
  );

  return useMemo<OrderRowView>(() => {
    const district = (order: PostOrder) => firstText(order.district?.name) || null;
    const address = (order: PostOrder) => firstText(order.address) || null;
    return {
      customerName,
      customerPhone,
      district,
      address,
      place: (order) => district(order) ?? address(order),
      market: (order) => firstText(order.market?.name) || null,
      date: (order) =>
        history
          ? formatDateLocalized(orderRowDate(order), { language })
          : formatDateTimeLocalized(orderRowDate(order), { language }),
      deliveryBadge: (order) => {
        const key = getDeliveryLabelKey(order.where_deliver);
        return key ? <Badge>{t(key, { ns: "orders" })}</Badge> : null;
      },
      money: (value) => formatMoneyLocalized(value, { language }),
    };
  }, [customerName, customerPhone, history, language, t]);
};
