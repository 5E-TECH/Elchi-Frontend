import type { OrderListItem } from "../../../entities/order/types/order";

export type CourierBulkAction = "sold" | "cancel" | "tomorrow";

/** Skanerlash rejimi: skanerlangan buyurtma bekor qilishga yoki ertaga qoldirishga belgilanadi. */
export type CourierBulkScanMode = Exclude<CourierBulkAction, "sold">;

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

/**
 * "Kunni yakunlash" da API ga ketadigan buyurtmalar (fix3 FE-CB-09).
 *
 * "Ertaga" belgilangan buyurtma uchun so'rov YUBORILMAYDI — u shunchaki
 * kutilmoqda (WAITING) holatida qoladi. Ilgari POST /orders/:id/could-not-deliver
 * yuborilardi: u `reason` (min 10 belgi) talab qiladi va faqat ON_THE_ROAD
 * buyurtmani qabul qiladi, bu ro'yxat esa faqat WAITING — ya'ni har bir
 * "ertaga" doim 400 berardi va butun yakunlash "xatolik" bilan tugardi.
 */
export const getCourierBulkFinalizeTasks = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): Array<{ order: T; action: Exclude<CourierBulkAction, "tomorrow"> }> =>
  orders.flatMap((order) => {
    const action = getCourierBulkOrderAction(order.id, actions);
    return action === "tomorrow" ? [] : [{ order, action }];
  });

/**
 * Yakunlashdan keyingi belgilar: muvaffaqiyatli bajarilganlar olib
 * tashlanadi, qolganlari (xato bergan buyurtmalar va "ertaga") SAQLANADI.
 *
 * ⚠️ "Ertaga" belgisi o'chirilmaydi: belgilanmagan buyurtma sukut bo'yicha
 * "sotildi" hisoblanadi, ya'ni tugma qayta bosilsa ertaga qoldirilganlar
 * sotilib ketardi. Xato bergan buyurtma ham o'z belgisini saqlaydi —
 * qayta urinishda "bekor" buyurtma "sotildi" bo'lib ketmasin.
 */
export const getCourierBulkActionsAfterFinalize = (
  actions: Record<string, CourierBulkAction>,
  succeededOrderIds: ReadonlySet<string>,
): Record<string, CourierBulkAction> =>
  Object.fromEntries(
    Object.entries(actions).filter(([orderId]) => !succeededOrderIds.has(orderId)),
  ) as Record<string, CourierBulkAction>;

/** Buyurtma qo'lda belgilanganmi (belgilanmagani sukut bo'yicha «sotildi»). */
export const isCourierBulkOrderMarked = (orderId: string, actions: Record<string, CourierBulkAction>) =>
  actions[orderId] !== undefined;

/**
 * Belgilanmagan buyurtmalar soni — «Sotiladi» kartasi va tasdiq oynasidagi «{u} tasi belgilanmagan, sukut
 * bo'yicha» (maket `courier-courier-bulk-confirm-dialog`).
 */
export const getCourierBulkUnmarkedCount = (
  orders: Array<{ id: string }>,
  actions: Record<string, CourierBulkAction>,
) => orders.filter((order) => !isCourierBulkOrderMarked(order.id, actions)).length;

/** «Natija» filtri: barchasi · sotiladi · bekor · ertaga · belgilanmagan (mijoz tomonida). */
export type CourierBulkResultFilter = "all" | CourierBulkAction | "unmarked";

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * Qidiruv (ism, telefon yoki buyurtma raqami) va «Natija» filtri — faqat mijoz tomonida, yangi API parametrisiz.
 * Telefon raqamlar bo'yicha ham solishtiriladi («90 214» → `+998902146631`).
 */
export const filterCourierBulkOrders = <T extends CourierBulkOrder>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
  { query, result }: { query: string; result: CourierBulkResultFilter },
): T[] => {
  const needle = query.trim().toLocaleLowerCase();
  const needleDigits = digitsOf(needle);

  return orders.filter((order) => {
    if (result === "unmarked" && isCourierBulkOrderMarked(order.id, actions)) return false;
    if (result !== "all" && result !== "unmarked" && getCourierBulkOrderAction(order.id, actions) !== result) {
      return false;
    }
    if (!needle) return true;

    const name = order.customer?.name?.toLocaleLowerCase() ?? "";
    const phone = order.customer?.phone_number ?? "";
    const id = String(order.id).toLocaleLowerCase();
    if (name.includes(needle) || id.includes(needle.replace(/^№/, "")) || phone.toLocaleLowerCase().includes(needle)) {
      return true;
    }
    return needleDigits.length > 0 && digitsOf(phone).includes(needleDigits);
  });
};

export type CourierBulkSortKey = "createdAt" | "amount";
export type CourierBulkSort = { key: CourierBulkSortKey; direction: "asc" | "desc" };

const createdTime = (order: CourierBulkOrder) => {
  const time = new Date(order.created_at ?? order.createdAt ?? "").getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** Mijoz tomonidagi saralash (sana yoki summa); `null` — backend tartibi. Barqaror (teng qiymatlar joyida). */
export const sortCourierBulkOrders = <T extends CourierBulkOrder>(orders: T[], sort: CourierBulkSort | null): T[] => {
  if (!sort) return orders;
  const read = sort.key === "amount" ? (order: T) => Number(order.total_price) || 0 : createdTime;
  const sign = sort.direction === "asc" ? 1 : -1;
  return orders
    .map((order, index) => ({ order, index }))
    .sort((a, b) => (read(a.order) - read(b.order)) * sign || a.index - b.index)
    .map(({ order }) => order);
};

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
