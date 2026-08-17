import type {
  DashboardOrdersSummary,
  BranchDashboardMarketCard,
  BranchDashboardPayload,
} from "../../../entities/dashboard";

export type BranchOrderSummary = {
  total: number;
  new: number;
  onTheRoad: number;
  delivered: number;
  returned: number;
};

export type BranchMarketSummary = {
  id: string;
  name: string;
  orders: number;
  amount: number;
};

export type BranchPackageSummary = {
  onTheWay: number;
  waiting: number;
};

export type BranchCourierSummary = {
  total: number;
  active: number;
};

export type BranchDashboardSnapshot = {
  orderSummary: BranchOrderSummary;
  markets: BranchMarketSummary[];
  packages: BranchPackageSummary;
  couriers: BranchCourierSummary;
  visibility: {
    orders: boolean;
    markets: boolean;
    packages: boolean;
    couriers: boolean;
  };
  todayOrdersCount: number;
  weekOrdersCount: number;
  activeBatchesCount: number;
  couriersCount: number;
  role: string;
};

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const mapMarket = (market: BranchDashboardMarketCard, index: number): BranchMarketSummary => ({
  id: String(market.id ?? market.name ?? market.title ?? index),
  name: market.name ?? market.title ?? `Market ${index + 1}`,
  orders: toNumber(market.orders ?? market.orders_count ?? market.total),
  amount: toNumber(market.amount ?? market.total_amount ?? market.price),
});

export const createEmptyBranchDashboard = (role: string): BranchDashboardSnapshot => ({
  orderSummary: {
    total: 0,
    new: 0,
    onTheRoad: 0,
    delivered: 0,
    returned: 0,
  },
  markets: [],
  packages: {
    onTheWay: 0,
    waiting: 0,
  },
  couriers: {
    total: 0,
    active: 0,
  },
  visibility: {
    orders: true,
    markets: role === "MANAGER",
    packages: true,
    couriers: role === "MANAGER",
  },
  todayOrdersCount: 0,
  weekOrdersCount: 0,
  activeBatchesCount: 0,
  couriersCount: 0,
  role,
});

export const adaptBranchDashboard = (
  payload?: BranchDashboardPayload | null,
  fallbackRole = "OPERATOR",
  orders?: DashboardOrdersSummary,
  preferOrderSummary = false,
): BranchDashboardSnapshot => {
  const role = payload?.role?.toUpperCase?.() || fallbackRole.toUpperCase();
  const fallback = createEmptyBranchDashboard(role);
  const hasOrdersSummary = Boolean(orders);
  const acceptedCount = toNumber(
    orders?.total ?? orders?.totalOrders ?? orders?.ordersCount ?? orders?.acceptedCount,
  );
  const soldAndPaid = toNumber(orders?.soldAndPaid);
  const cancelled = toNumber(orders?.cancelled);
  const inProgress = Math.max(0, acceptedCount - soldAndPaid - cancelled);
  const totalOrders = acceptedCount;

  const mergeOrderSummary = (snapshot: BranchDashboardSnapshot): BranchDashboardSnapshot => {
    if (!hasOrdersSummary) return snapshot;

    const backendOrderTotal =
      snapshot.orderSummary.total +
      snapshot.orderSummary.new +
      snapshot.orderSummary.onTheRoad +
      snapshot.orderSummary.delivered +
      snapshot.orderSummary.returned;

    if (backendOrderTotal > 0 && !preferOrderSummary) return snapshot;

    return {
      ...snapshot,
      orderSummary: {
        total: totalOrders,
        new: 0,
        onTheRoad: inProgress,
        delivered: soldAndPaid,
        returned: cancelled,
      },
      todayOrdersCount: totalOrders,
      weekOrdersCount: totalOrders,
    };
  };

  if (!payload) {
    return mergeOrderSummary(fallback);
  }

  const cards = payload.cards;

  return mergeOrderSummary({
    orderSummary: {
      total: toNumber(cards?.orders?.total),
      new: toNumber(cards?.orders?.new),
      onTheRoad: toNumber(cards?.orders?.on_the_road),
      delivered: toNumber(cards?.orders?.delivered),
      returned: toNumber(cards?.orders?.returned),
    },
    markets: (cards?.markets ?? []).map(mapMarket),
    packages: {
      onTheWay: toNumber(cards?.packages?.on_the_way),
      waiting: toNumber(cards?.packages?.waiting_for_acceptance),
    },
    couriers: {
      total: toNumber(cards?.couriers?.total ?? payload.couriers_count),
      active: toNumber(
        cards?.couriers?.active ??
          cards?.couriers?.active_today ??
          cards?.couriers?.active_count,
      ),
    },
    visibility: {
      orders: payload.visibility?.orders ?? fallback.visibility.orders,
      markets: payload.visibility?.markets ?? fallback.visibility.markets,
      packages: payload.visibility?.packages ?? fallback.visibility.packages,
      couriers: payload.visibility?.couriers ?? fallback.visibility.couriers,
    },
    todayOrdersCount: toNumber(payload.today_orders_count),
    weekOrdersCount: toNumber(payload.week_orders_count),
    activeBatchesCount: toNumber(payload.active_batches_count),
    couriersCount: toNumber(payload.couriers_count),
    role,
  });
};
