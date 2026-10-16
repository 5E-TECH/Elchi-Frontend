import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canHandoverCancelledToMarket } from "../../../app/lib/access";
import { useBranchesWithSentBatches } from "../../../entities/branch";
import { useIncomingSources } from "../../../entities/incoming-orders";
import { useOrders } from "../../../entities/orders";
import type { TabItem } from "../../../shared/ui/primitives";
import { extractCancelledMarkets, extractCancelledOrders } from "../cancelled/utils";
import {
  resolveNewOrdersActiveTab,
  resolveNewOrdersTabKeys,
  type NewOrdersTabKey,
} from "./newOrdersShell";
import { extractTodayMarkets, listOf } from "./todayMarkets";

/** Rolga qarab ko'rinadigan tablar (so'rovsiz). Bola sahifa: `keys.length > 1` bo'lmasa — o'z karta sarlavhasi. */
export const useNewOrdersTabKeys = (): NewOrdersTabKey[] => {
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  // fix3 CODE-16 / C4: HQ registratori ham bekor qilingan mollarni topshiradi.
  const canSeeCancelled = useSelector(canHandoverCancelledToMarket);
  return useMemo(
    () => resolveNewOrdersTabKeys({ role, roleId, canSeeCancelled }),
    [canSeeCancelled, role, roleId],
  );
};

/** Bitta (yoki undan kam) tab — tablar qatori chizilmaydi (maket `manager-new-orders-markets`). */
export const useHasNewOrdersTabs = (): boolean => useNewOrdersTabKeys().length > 1;

/** So'rov muvaffaqiyatli bo'lsagina son; yuklanish va xatoda — yo'q («0» ko'rsatilmaydi). */
const countOf = <T>(query: { status: string; data?: T }, count: (data: T) => number): number | undefined =>
  query.status === "success" && query.data !== undefined ? count(query.data) : undefined;

/**
 * Tablar va ulardagi sonlar. Har son sahifaning o'z so'rovi bilan BIR XIL kalitda (kesh umumiy — sahifaga
 * o'tganda qayta yuklanmaydi) va faqat tab ko'rinsa so'raladi:
 *  - «Marketlar» — marketlar soni (`orders/markets/new`);
 *  - «Kiruvchi posilkalar» — kutayotgan posilkalar (manbalar `orders_count` yig'indisi);
 *  - «Filial paketlari» — paket yuborgan filiallar soni;
 *  - «Bekor qilinganlar» — marketlar soni; market rolida — o'z buyurtmalari soni;
 *  - market «Yangi buyurtmalar» — bugungi yangi buyurtmalar soni.
 */
export const useNewOrdersTabs = (): { items: TabItem<NewOrdersTabKey>[]; active: NewOrdersTabKey } => {
  const { t } = useTranslation("newOrders");
  const location = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const keys = useNewOrdersTabKeys();
  const show = (key: NewOrdersTabKey) => keys.length > 1 && keys.includes(key);

  const { useGetTodayOrders, useGetTodayOrdersByMarket, useCancelledMarkets, useCancelledOrdersByMarket } =
    useOrders();
  const marketsQuery = useGetTodayOrders(undefined, show("markets"));
  const incomingQuery = useIncomingSources({ enabled: show("incoming") });
  const branchesQuery = useBranchesWithSentBatches(undefined, { enabled: show("branches") });
  const cancelledQuery = useCancelledMarkets(undefined, { enabled: show("cancelled") });
  const marketNewQuery = useGetTodayOrdersByMarket(roleId ? Number(roleId) : 0, undefined, show("marketNew"));
  const marketCancelledQuery = useCancelledOrdersByMarket(roleId ?? "", { enabled: show("marketCancelled") });

  const counts: Record<NewOrdersTabKey, number | undefined> = {
    markets: countOf(marketsQuery, (data) => extractTodayMarkets(data).length),
    incoming: countOf(incomingQuery, (sources) =>
      sources.reduce((sum, source) => sum + (Number(source.orders_count) || 0), 0),
    ),
    branches: countOf(branchesQuery, (rows) => rows.length),
    cancelled: countOf(cancelledQuery, (data) => extractCancelledMarkets(data).length),
    marketNew: countOf(marketNewQuery, (data) => listOf(data).length),
    marketCancelled: countOf(marketCancelledQuery, (data) => extractCancelledOrders(data).length),
  };

  const labels: Record<NewOrdersTabKey, string> = {
    markets: t("marketsTab"),
    incoming: t("shell.incomingTab"),
    branches: t("branchesTab"),
    cancelled: t("cancelledTab"),
    marketNew: t("newOrdersTab"),
    marketCancelled: t("cancelledTab"),
  };

  const links: Record<NewOrdersTabKey, string> = {
    markets: "/new-orders",
    incoming: "/new-orders/incoming",
    branches: "/new-orders/branches",
    cancelled: "/new-orders/cancelled",
    marketNew: roleId ? `/new-orders/${roleId}` : "/new-orders",
    marketCancelled: `/new-orders/cancelled/${roleId ?? ""}`,
  };

  return {
    items: keys.map((key) => ({ value: key, label: labels[key], count: counts[key], to: links[key] })),
    active: resolveNewOrdersActiveTab(location.pathname, role),
  };
};
