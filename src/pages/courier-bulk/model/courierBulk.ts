import type { OrderListItem } from "../../../entities/order/types/order";

export type CourierBulkAction = "sold" | "cancel" | "tomorrow";

export type CourierBulkOrder = OrderListItem & {
  created_at?: string;
  region?: { id?: string; name?: string } | null;
};

export type CourierBulkCounts = {
  cancel: number;
  sold: number;
  tomorrow: number;
  total: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const extractCourierBulkOrders = (payload: unknown): CourierBulkOrder[] => {
  const source = asRecord(payload);
  const data = source.data;
  const nestedData = asRecord(data);

  const candidates = [
    data,
    nestedData.data,
    nestedData.items,
    asRecord(nestedData.data).items,
  ];

  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? (list as CourierBulkOrder[]) : [];
};

export const extractCourierBulkTotal = (payload: unknown): number | null => {
  const source = asRecord(payload);
  const data = asRecord(source.data);
  const nestedData = asRecord(data.data);
  const meta = asRecord(data.meta ?? data.pagination ?? nestedData.meta ?? nestedData.pagination);

  const candidates = [
    source.total,
    data.total,
    data.count,
    meta.total,
    meta.count,
    meta.totalItems,
    meta.total_count,
  ];

  const numericValue = candidates
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value >= 0);

  return numericValue ?? null;
};

export const mergeCourierBulkOrders = (pages: CourierBulkOrder[][]): CourierBulkOrder[] => {
  const byId = new Map<string, CourierBulkOrder>();

  pages.flat().forEach((order) => {
    if (!order?.id) return;
    byId.set(String(order.id), order);
  });

  return [...byId.values()];
};

export const findCourierBulkOrderByScanCandidates = (
  orders: CourierBulkOrder[],
  candidates: string[],
) => {
  const normalizedCandidates = new Set(
    candidates.map((candidate) => candidate.trim().toLowerCase()).filter(Boolean),
  );

  return orders.find((order) => {
    if (normalizedCandidates.has(String(order.id).toLowerCase())) return true;

    const token = order.qr_code_token?.trim().toLowerCase();
    return Boolean(token && normalizedCandidates.has(token));
  });
};

export const getCourierBulkCounts = (
  orders: Array<{ id: string }>,
  actions: Record<string, CourierBulkAction>,
): CourierBulkCounts => {
  return orders.reduce<CourierBulkCounts>(
    (accumulator, order) => {
      const action = actions[order.id] ?? "sold";
      accumulator[action] += 1;
      accumulator.total += 1;
      return accumulator;
    },
    { cancel: 0, sold: 0, tomorrow: 0, total: 0 },
  );
};

export const getCourierBulkOrderAction = (
  orderId: string,
  actions: Record<string, CourierBulkAction>,
): CourierBulkAction => actions[orderId] ?? "sold";

export const getCourierBulkFinalizeLabelCounts = (counts: CourierBulkCounts) => ({
  changed: counts.cancel + counts.tomorrow,
  sold: counts.sold,
});

export const runLimited = async <T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
) => {
  const queue = [...items];
  const workerCount = Math.max(1, Math.min(limit, queue.length));
  const results: PromiseSettledResult<unknown>[] = [];

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        results.push(await Promise.allSettled([task(item)]).then(([result]) => result));
      }
    }),
  );

  return results;
};
