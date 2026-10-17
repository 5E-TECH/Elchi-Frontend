import type { OrderListItem } from "../../../entities/order/types/order";
import { isProofRequiredByConditions, toKnownAmount } from "../../../entities/orders/proofRequirement";

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
): Array<CourierBulkFinalizeTask<T>> =>
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

export const getCourierBulkFinalizeLabelCounts = (counts: CourierBulkCounts) => ({
  changed: counts.cancel + counts.tomorrow,
  sold: counts.sold,
});

/**
 * Vazifalarni ko'pi bilan `limit` tadan parallel bajaradi. Natijalar KIRISH tartibida
 * (`results[i]` — `items[i]` niki), tugash tartibida emas: xato bergan buyurtma aynan o'z
 * vazifasiga bog'lanadi.
 */
export const runLimited = async <T, R = unknown>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = { status: "fulfilled", value: await task(items[index]) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }),
  );

  return results;
};

export type CourierBulkFinalizeAction = Exclude<CourierBulkAction, "tomorrow">;

export type CourierBulkFinalizeTask<T> = { order: T; action: CourierBulkFinalizeAction };

/** Isbotsiz buyurtmalar — avvalgidek 6 tadan parallel. */
export const COURIER_BULK_CONCURRENCY = 6;
/** Isbotli buyurtmalar (fayl yuklash + amal) — ko'pi bilan 2 tadan parallel (j9KFyqlS). */
export const COURIER_BULK_PROOF_CONCURRENCY = 2;

/**
 * Ommaviy yopish so'rovlari sarlavhasi: backend ularni audit jurnalida ommaviy amal deb yozadi
 * (`activity_logs.metadata.request_source = "courier-bulk"`).
 */
export const COURIER_BULK_REQUEST_HEADERS = { "X-Request-Source": "courier-bulk" } as const;

type ProofCheckOrder = {
  total_price?: unknown;
  market?: { expense_proof_conditions?: readonly string[] | null } | null;
};

/**
 * Market sozlamasi (`market.expense_proof_conditions`) bo'yicha shu amal uchun isbot majburmi.
 * Ommaviy yopishda qo'shimcha xarajat yo'q (`extraCost: 0`), summa — buyurtma summasi
 * (backend `enforceOperationProof` bilan bir xil).
 */
export const isCourierBulkProofRequired = (order: ProofCheckOrder, action: CourierBulkFinalizeAction) =>
  isProofRequiredByConditions(order.market?.expense_proof_conditions, {
    action: action === "cancel" ? "cancel" : "sell",
    extraCost: 0,
    totalPrice: toKnownAmount(order.total_price),
  });

/** Vazifalarni ikkiga ajratadi: isbot talab qilinadiganlar va qolganlari (tartib saqlanadi). */
export const splitCourierBulkTasksByProof = <T extends ProofCheckOrder>(
  tasks: ReadonlyArray<CourierBulkFinalizeTask<T>>,
) => {
  const proofTasks: CourierBulkFinalizeTask<T>[] = [];
  const plainTasks: CourierBulkFinalizeTask<T>[] = [];
  tasks.forEach((task) => {
    (isCourierBulkProofRequired(task.order, task.action) ? proofTasks : plainTasks).push(task);
  });
  return { proofTasks, plainTasks };
};

/**
 * Tanlangan isbot kaliti — buyurtma VA amal: bekor qilish uchun tanlangan rasm buyurtma keyin
 * «sotildi» qilinsa sotish isboti bo'lib ketmasin.
 */
export const getCourierBulkProofKey = (task: { order: { id: string }; action: CourierBulkFinalizeAction }) =>
  `${task.order.id}:${task.action}`;

/** Har isbotli buyurtmaga fayl tanlanganmi (yakunlash tugmasi shungacha o'chiq). */
export const hasAllCourierBulkProofs = (
  proofTasks: ReadonlyArray<{ order: { id: string }; action: CourierBulkFinalizeAction }>,
  proofs: Readonly<Record<string, File | undefined>>,
) => proofTasks.every((task) => proofs[getCourierBulkProofKey(task)] instanceof File);

export type CourierBulkFailure<T> = CourierBulkFinalizeTask<T> & { error: unknown };

/** Vazifa ↔ natija (bir xil tartibda) → bajarilgan buyurtmalar va xato berganlar (sababi bilan). */
export const summarizeCourierBulkResults = <T extends { id: string }>(
  tasks: ReadonlyArray<CourierBulkFinalizeTask<T>>,
  results: ReadonlyArray<PromiseSettledResult<unknown>>,
) => {
  const succeededOrderIds = new Set<string>();
  const failures: CourierBulkFailure<T>[] = [];
  tasks.forEach((task, index) => {
    const result = results[index];
    if (result?.status === "fulfilled") {
      succeededOrderIds.add(String(task.order.id));
      return;
    }
    failures.push({ ...task, error: result?.status === "rejected" ? result.reason : undefined });
  });
  return { succeededOrderIds, failures };
};
