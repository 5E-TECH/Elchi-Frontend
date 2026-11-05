import { readOrderReplacement } from "../../../entities/order/model/orderReplacement";
import type { OrderListItem } from "../../../entities/order/types/order";
import { isCourierHeldOrder } from "../../../entities/orders/custody";
import { isProofRequiredByConditions, toKnownAmount } from "../../../entities/orders/proofRequirement";

export type CourierBulkAction = "sold" | "cancel" | "tomorrow";

/** Skanerlash rejimi: skanerlangan buyurtma bekor qilishga yoki ertaga qoldirishga belgilanadi. */
export type CourierBulkScanMode = Exclude<CourierBulkAction, "sold">;

/** Kim yopyapti: kuryerning o'zi yoki filial menejeri (menejer kuryer qo'lidagini sotmaydi — LC-04). */
export type CourierBulkViewer = "courier" | "manager";

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

export const getCourierBulkCounts = (
  orders: Array<{ id: string }>,
  actions: Record<string, CourierBulkAction>,
  viewer: CourierBulkViewer = "courier",
): CourierBulkCounts => {
  return orders.reduce<CourierBulkCounts>(
    (accumulator, order) => {
      const action = actions[order.id] ?? "sold";
      accumulator.total += 1;
      // Pochtasi qabul qilinmagan posilka (6qypMFeT) hech qaysi natijaga kirmaydi — so'rov ketmaydi.
      if (isCourierBulkAwaitingPost(order)) return accumulator;
      // lQjt6sKP: eski mahsulot olinmagan almashtirish bu yerdan sotilmaydi — «Sotiladi»ga qo'shilmaydi
      // (tasdiq oynasidagi soldCount bilan bir xil); «Kutilayotgan» (total) da qoladi — buyurtma WAITING.
      // Menejerda kuryer qo'lidagi buyurtma ham shunday (LC-04).
      if (action === "sold" && isCourierBulkSellBlocked(order, viewer)) return accumulator;
      accumulator[action] += 1;
      return accumulator;
    },
    { cancel: 0, sold: 0, tomorrow: 0, total: 0 },
  );
};

export const getCourierBulkOrderAction = (
  orderId: string,
  actions: Record<string, CourierBulkAction>,
): CourierBulkAction => actions[orderId] ?? "sold";

const normalizeStatus = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replaceAll("_", " ") : "";

/**
 * Pochtasi hali qabul qilinmagan posilka (6qypMFeT): kuryer uni skan bilan o'zi olgan — ro'yxatga «Kutilayotgan» bilan
 * birga keladi, lekin holati ON_THE_ROAD. Backend sotishda ham, bekor qilishda ham WAITING talab qiladi (400 «…kutilmoqda
 * (waiting) holatida emas») — bunday qator uchun so'rov YUBORILMAYDI, belgilab ham bo'lmaydi. Holati kelmagan qator —
 * kutilmoqda (ro'yxat `status=waiting` bilan so'raladi).
 */
export const isCourierBulkAwaitingPost = (order: unknown) => {
  const status = normalizeStatus((order as { status?: unknown } | null)?.status);
  return status !== "" && status !== "waiting";
};

/** Nega buyurtma bu yerdan sotilmaydi: almashtirish (lQjt6sKP) yoki menejerda kuryer qo'lida (LC-04). */
export type CourierBulkSellBlock = "replacement" | "courierHeld";

/**
 * Almashtirish buyurtmasi (lQjt6sKP) eski mahsulot olinmaguncha «Eski mahsulotni oldim» tasdig'isiz sotilmaydi
 * (backend 400). Ommaviy yopishda bunday tasdiq yo'q — buyurtma «sotildi» bo'lib YUBORILMAYDI, kutilmoqda holatida
 * qoladi; kuryer uni «Buyurtmalar»dan tasdiq bilan sotadi.
 *
 * Menejer kuryer qo'lidagi buyurtmani sotmaydi (LC-04, backend 400 «Bu buyurtma kuryer qo'lida — uni kuryerning o'zi
 * sotadi»; «Buyurtmalar» sahifasidagi `canManagerSellOrder` bilan bir xil) — u ham yuborilmaydi, kutilmoqda qoladi.
 * Ikkala holatda bekor qilish — odatdagidek. Menejerda kuryer qo'lidagi almashtirish ham `courierHeld`: «Buyurtmalar»dan
 * ham uni menejer sotmaydi, to'g'ri yo'l — kuryerning o'zi.
 */
export const getCourierBulkSellBlock = (
  order: unknown,
  viewer: CourierBulkViewer = "courier",
): CourierBulkSellBlock | null => {
  if (viewer === "manager" && isCourierHeldOrder(order)) return "courierHeld";
  if (readOrderReplacement(order).needsOldItemConfirm) return "replacement";
  return null;
};

export const isCourierBulkSellBlocked = (order: unknown, viewer: CourierBulkViewer = "courier") =>
  getCourierBulkSellBlock(order, viewer) !== null;

/** «Sotildi» (aniq yoki sukut) belgisidagi, lekin bu yerdan sotib bo'lmaydigan almashtirish buyurtmalari. */
export const getCourierBulkReplacementHeld = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): T[] => getCourierBulkKept(orders, actions).replacement;

export type CourierBulkKept<T> = {
  /** «Ertaga» belgisi — so'rovsiz kutilmoqda qoladi (FE-CB-09). */
  tomorrow: T[];
  /** «Sotildi», lekin almashtirish — «Buyurtmalar»dan sotiladi. */
  replacement: T[];
  /** «Sotildi», lekin menejerda kuryer qo'lida — kuryerning o'zi sotadi. */
  courierHeld: T[];
  /** Pochtasi qabul qilinmagan — belgidan qat'i nazar o'zgarmaydi. */
  awaitingPost: T[];
};

/**
 * Yakunlashda so'rov KETMAYDIGAN buyurtmalar, sababi bo'yicha (tasdiq oynasi va natija xabari shu bilan). Har buyurtma
 * ko'pi bilan bitta guruhda; `getCourierBulkFinalizeTasks` bilan birga ro'yxatni to'liq qoplaydi.
 */
export const getCourierBulkKept = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
  viewer: CourierBulkViewer = "courier",
): CourierBulkKept<T> => {
  const kept: CourierBulkKept<T> = { tomorrow: [], replacement: [], courierHeld: [], awaitingPost: [] };
  orders.forEach((order) => {
    if (isCourierBulkAwaitingPost(order)) {
      kept.awaitingPost.push(order);
      return;
    }
    const action = getCourierBulkOrderAction(order.id, actions);
    if (action === "tomorrow") {
      kept.tomorrow.push(order);
      return;
    }
    const block = action === "sold" ? getCourierBulkSellBlock(order, viewer) : null;
    if (block) kept[block].push(order);
  });
  return kept;
};

/**
 * "Kunni yakunlash" da API ga ketadigan buyurtmalar (fix3 FE-CB-09).
 *
 * "Ertaga" belgilangan buyurtma uchun so'rov YUBORILMAYDI — u shunchaki
 * kutilmoqda (WAITING) holatida qoladi. Ilgari POST /orders/:id/could-not-deliver
 * yuborilardi: u `reason` (min 10 belgi) talab qiladi va faqat ON_THE_ROAD
 * buyurtmani qabul qiladi, bu ro'yxat esa faqat WAITING — ya'ni har bir
 * "ertaga" doim 400 berardi va butun yakunlash "xatolik" bilan tugardi.
 *
 * Eski mahsulot olinmagan almashtirish buyurtmasi (menejerda — kuryer qo'lidagi ham) «sotildi» bo'lib yuborilmaydi
 * (`isCourierBulkSellBlocked`); pochtasi qabul qilinmagan posilka umuman yuborilmaydi (`isCourierBulkAwaitingPost`).
 */
export const getCourierBulkFinalizeTasks = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
  viewer: CourierBulkViewer = "courier",
): Array<CourierBulkFinalizeTask<T>> =>
  orders.flatMap((order) => {
    if (isCourierBulkAwaitingPost(order)) return [];
    const action = getCourierBulkOrderAction(order.id, actions);
    if (action === "tomorrow") return [];
    if (action === "sold" && isCourierBulkSellBlocked(order, viewer)) return [];
    return [{ order, action }];
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
 * bo'yicha» (maket `courier-courier-bulk-confirm-dialog`). Sukut bo'yicha ham sotilmaydigan almashtirish
 * buyurtmasi (`isCourierBulkSellBlocked`, lQjt6sKP; menejerda — kuryer qo'lidagi ham) va pochtasi qabul qilinmagan
 * posilka bu songa kirmaydi — «Sotiladi» soni bilan mos bo'lsin. «Belgilanmagan» natija filtri va qatordagi belgi
 * ham ularni chiqarmaydi (`filterCourierBulkOrders`, `CourierBulkOrders`).
 */
export const getCourierBulkUnmarkedCount = (
  orders: Array<{ id: string }>,
  actions: Record<string, CourierBulkAction>,
  viewer: CourierBulkViewer = "courier",
) =>
  orders.filter(
    (order) =>
      !isCourierBulkOrderMarked(order.id, actions) &&
      !isCourierBulkAwaitingPost(order) &&
      !isCourierBulkSellBlocked(order, viewer),
  ).length;

/** «Natija» filtri: barchasi · sotiladi · bekor · ertaga · belgilanmagan (mijoz tomonida). */
export type CourierBulkResultFilter = "all" | CourierBulkAction | "unmarked";

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * Qidiruv (ism, telefon yoki buyurtma raqami) va «Natija» filtri — faqat mijoz tomonida, yangi API parametrisiz.
 * Telefon raqamlar bo'yicha ham solishtiriladi («90 214» → `+998902146631`). Pochtasi qabul qilinmagan posilka
 * natijasi yo'q — u faqat «Barchasi»da chiqadi; bu yerdan sotilmaydigani («sotildi» belgisi bilan) «Sotiladi» va
 * «Belgilanmagan» ga kirmaydi — kartalardagi sonlar bilan bir xil.
 */
export const filterCourierBulkOrders = <T extends CourierBulkOrder>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
  {
    query,
    result,
    viewer = "courier",
  }: { query: string; result: CourierBulkResultFilter; viewer?: CourierBulkViewer },
): T[] => {
  const needle = query.trim().toLocaleLowerCase();
  const needleDigits = digitsOf(needle);

  return orders.filter((order) => {
    if (result !== "all" && isCourierBulkAwaitingPost(order)) return false;
    if (
      (result === "sold" || result === "unmarked") &&
      getCourierBulkOrderAction(order.id, actions) === "sold" &&
      isCourierBulkSellBlocked(order, viewer)
    ) {
      return false;
    }
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

/**
 * Qayta yuboriladigan xato turi (`null` — qayta yuborilmaydi, masalan 4xx biznes qoidasi):
 * - `wait` — 429 (gateway IP chegarasi, sukut 60 so'rov / daqiqa har route uchun; so'rov ishlovchiga yetmaydi) yoki
 *   409 «shu `Idempotency-Key` bilan amal hali bajarilmoqda»;
 * - `server` — 5xx yoki javobsiz (tarmoq): kun oxiri yuklamasida order-service DB ulanishini kutib ololmasa 500
 *   qaytaradi va buyurtma «kutilmoqda»da qoladi. Har so'rov barqaror `Idempotency-Key` bilan ketadi — backend amalni
 *   ikkinchi marta bajarmaydi (birinchisi o'tgan bo'lsa, keshdagi javob qaytadi), shuning uchun qayta yuborish xavfsiz.
 */
export type CourierBulkRetryKind = "wait" | "server";

const IDEMPOTENCY_IN_PROGRESS_CODE = "IDEMPOTENCY_IN_PROGRESS";

export const getCourierBulkRetryKind = (error: unknown): CourierBulkRetryKind | null => {
  if (!error || typeof error !== "object") return null;
  const { response, request, code } = error as {
    response?: { status?: unknown; data?: { code?: unknown; message?: unknown } };
    request?: unknown;
    code?: unknown;
  };
  const status = response?.status;
  if (status === 429) return "wait";
  if (status === 409) {
    const data = response?.data;
    const inProgress =
      data?.code === IDEMPOTENCY_IN_PROGRESS_CODE ||
      (typeof data?.message === "string" && data.message.startsWith("Takroriy so'rov"));
    return inProgress ? "wait" : null;
  }
  if (typeof status === "number") return status >= 500 ? "server" : null;
  // Javob kelmagan: tarmoq uzilishi yoki timeout (axios `ERR_NETWORK` / `ECONNABORTED`).
  return request !== undefined || code === "ERR_NETWORK" || code === "ECONNABORTED" ? "server" : null;
};

/** Qayta yuborishdan oldin kutish (ms): jami ~100 s — gateway bloki (60 s) va kalit lease'i (90 s) shu orada tugaydi. */
export const COURIER_BULK_RETRY_DELAYS_MS: readonly number[] = [2_000, 10_000, 30_000, 60_000];
/** `server` xatosi ko'pi bilan shuncha marta qayta yuboriladi: doimiy nosozlikda har buyurtma ~100 s kutmasin. */
export const COURIER_BULK_SERVER_RETRIES = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Amalni vaqtinchalik xatoda (`getCourierBulkRetryKind`) kutib qayta yuboradi; boshqasi — darhol chaqiruvchiga. */
export const withCourierBulkRetry = async <R>(
  task: () => Promise<R>,
  {
    delays = COURIER_BULK_RETRY_DELAYS_MS,
    serverRetries = COURIER_BULK_SERVER_RETRIES,
    wait = sleep,
  }: { delays?: readonly number[]; serverRetries?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<R> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const kind = getCourierBulkRetryKind(error);
      const limit = kind === "server" ? Math.min(serverRetries, delays.length) : delays.length;
      if (!kind || attempt >= limit) throw error;
      await wait(delays[attempt]);
    }
  }
};

/**
 * Bitta yakunlash urinishidagi amal kaliti: qayta yuborishda o'zgarmaydi (backend takrorni tanib oladi), keyingi
 * «Kunni yakunlash» — yangi `runId`, yangi kalit (xato bergan buyurtma qaytadan bajariladi).
 */
export const getCourierBulkIdempotencyKey = (runId: string, action: CourierBulkFinalizeAction, orderId: string) =>
  `courier-bulk:${runId}:${action}:${orderId}`;

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
