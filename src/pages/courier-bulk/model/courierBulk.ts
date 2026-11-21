import { readOrderReplacement } from "../../../entities/order/model/orderReplacement";
import type { OrderListItem } from "../../../entities/order/types/order";
import { isProofRequiredByConditions, toKnownAmount } from "../../../entities/orders/proofRequirement";

export type CourierBulkAction = "sold" | "cancel" | "tomorrow";

/** Skanerlash rejimi: skanerlangan buyurtma bekor qilishga yoki ertaga qoldirishga belgilanadi. */
export type CourierBulkScanMode = Exclude<CourierBulkAction, "sold">;

/**
 * Kim yopyapti: kuryerning o'zi yoki filial menejeri. Menejer kuryer qo'lidagi buyurtmani KURYER NOMIDAN sotadi
 * (BE LC-04, 2026-11-21: pul kuryer kassasi orqali) — natija qoidalari ikkalasida bir xil.
 */
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

/**
 * Natijalar soni. Belgilanmagan buyurtma «Sotiladi»ga kiradi — sukut natija «sotildi» (BeePost modeli, ega
 * 2026-11-21: «kunni yakunlash xuddi BeePost'nikiday ishlashi kerak»; 2026-11-05 dagi «sukut yo'q» qarori bekor).
 */
export const getCourierBulkCounts = (
  orders: Array<{ id: string }>,
  actions: Record<string, CourierBulkAction>,
): CourierBulkCounts => {
  return orders.reduce<CourierBulkCounts>(
    (accumulator, order) => {
      const action = getCourierBulkOrderAction(order.id, actions);
      accumulator.total += 1;
      // lQjt6sKP: eski mahsulot olinmagan almashtirish bu yerdan sotilmaydi — «Sotiladi»ga qo'shilmaydi
      // (tasdiq oynasidagi soldCount bilan bir xil); «Kutilayotgan» (total) da qoladi — buyurtma WAITING.
      if (action === "sold" && isCourierBulkSellBlocked(order)) return accumulator;
      accumulator[action] += 1;
      return accumulator;
    },
    { cancel: 0, sold: 0, tomorrow: 0, total: 0 },
  );
};

/**
 * Qator natijasi. Belgilanmagan — «sotildi» (sukut, BeePost modeli): kun oxirida skaner bilan faqat qaytgan
 * (bekor) va ertaga qoladigan posilkalar belgilanadi, qolgani sotiladi.
 */
export const getCourierBulkOrderAction = (
  orderId: string,
  actions: Record<string, CourierBulkAction>,
): CourierBulkAction => actions[orderId] ?? "sold";

/*
 * COURIER-SCAN (ega, 2026-11-17): kuryer skani = qabul — skan bilan olingan posilka darhol «Kutilmoqda» (WAITING).
 * 6qypMFeT dagi «pochtasi qabul qilinmagan» (ON_THE_ROAD) to'sig'i olib tashlandi: kuryerning o'z buyurtmalari
 * to'siqsiz belgilanadi (sotish / bekor yo'ldagini backend o'zi qabul qiladi).
 */

/** Nega buyurtma bu yerdan sotilmaydi: almashtirish (lQjt6sKP). */
export type CourierBulkSellBlock = "replacement";

/**
 * Almashtirish buyurtmasi (lQjt6sKP) eski mahsulot olinmaguncha «Eski mahsulotni oldim» tasdig'isiz sotilmaydi
 * (backend 400). Ommaviy yopishda bunday tasdiq yo'q — buyurtma «sotildi» bo'lib YUBORILMAYDI, kutilmoqda holatida
 * qoladi; kuryer uni «Buyurtmalar»dan tasdiq bilan sotadi. Bekor qilish — odatdagidek.
 *
 * Menejerda kuryer qo'lidagi buyurtma endi to'silmaydi: backend uni kuryer nomidan sotadi (LC-04, 2026-11-21 —
 * pul kuryer kassasi va qarzi orqali, kuryer sotganidagidek).
 */
export const getCourierBulkSellBlock = (order: unknown): CourierBulkSellBlock | null =>
  readOrderReplacement(order).needsOldItemConfirm ? "replacement" : null;

export const isCourierBulkSellBlocked = (order: unknown) => getCourierBulkSellBlock(order) !== null;

/** «Sotildi» belgisidagi, lekin bu yerdan sotib bo'lmaydigan almashtirish buyurtmalari. */
export const getCourierBulkReplacementHeld = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): T[] => getCourierBulkKept(orders, actions).replacement;

export type CourierBulkKept<T> = {
  /** «Ertaga» belgisi — so'rovsiz kutilmoqda qoladi (FE-CB-09). */
  tomorrow: T[];
  /** «Sotildi» (belgilanmagani ham), lekin almashtirish — «Buyurtmalar»dan sotiladi. */
  replacement: T[];
};

/**
 * Yakunlashda so'rov KETMAYDIGAN buyurtmalar, sababi bo'yicha (tasdiq oynasi va natija xabari shu bilan). Har buyurtma
 * ko'pi bilan bitta guruhda; `getCourierBulkFinalizeTasks` bilan birga ro'yxatni to'liq qoplaydi.
 */
export const getCourierBulkKept = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): CourierBulkKept<T> => {
  const kept: CourierBulkKept<T> = { tomorrow: [], replacement: [] };
  orders.forEach((order) => {
    const action = getCourierBulkOrderAction(order.id, actions);
    if (action === "tomorrow") {
      kept.tomorrow.push(order);
      return;
    }
    const block = action === "sold" ? getCourierBulkSellBlock(order) : null;
    if (block) kept[block].push(order);
  });
  return kept;
};

/**
 * "Kunni yakunlash" da API ga ketadigan buyurtmalar (fix3 FE-CB-09; BeePost modeli 2026-11-21).
 *
 * "Ertaga" belgilangan buyurtma uchun so'rov YUBORILMAYDI — u shunchaki
 * kutilmoqda (WAITING) holatida qoladi. Ilgari POST /orders/:id/could-not-deliver
 * yuborilardi: u `reason` (min 10 belgi) talab qiladi va faqat ON_THE_ROAD
 * buyurtmani qabul qiladi, bu ro'yxat esa faqat WAITING — ya'ni har bir
 * "ertaga" doim 400 berardi va butun yakunlash "xatolik" bilan tugardi.
 *
 * Belgilanmagan buyurtma — «sotildi» (sukut): BeePost'dagidek, «Bekor» va «Ertaga» skanerlanganidan tashqari hammasi
 * sotiladi. Tasdiq oynasida bu alohida aytiladi va belgilash katagi bilan tasdiqlanadi.
 *
 * Eski mahsulot olinmagan almashtirish buyurtmasi «sotildi» bo'lib yuborilmaydi (`isCourierBulkSellBlocked`).
 */
export const getCourierBulkFinalizeTasks = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): Array<CourierBulkFinalizeTask<T>> =>
  orders.flatMap((order) => {
    const action = getCourierBulkOrderAction(order.id, actions);
    if (action === "tomorrow") return [];
    if (action === "sold" && isCourierBulkSellBlocked(order)) return [];
    return [{ order, action }];
  });

/** «Faqat bekorlarni bajarish» (BeePost «Faqat bekor»): faqat «Bekor» belgilanganlar, sotuv so'rovi ketmaydi. */
export const getCourierBulkCancelOnlyTasks = <T extends { id: string }>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
): Array<CourierBulkFinalizeTask<T>> =>
  orders.flatMap((order) => (actions[order.id] === "cancel" ? [{ order, action: "cancel" as const }] : []));

/**
 * Yakunlashdan keyingi belgilar: muvaffaqiyatli bajarilganlar olib
 * tashlanadi, qolganlari (xato bergan buyurtmalar va "ertaga") SAQLANADI —
 * kuryer nimani tanlagani ko'rinib tursin, qayta urinishda qayta belgilash
 * shart bo'lmasin (xato bergan "bekor" — "bekor"ligicha qayta yuboriladi).
 */
export const getCourierBulkActionsAfterFinalize = (
  actions: Record<string, CourierBulkAction>,
  succeededOrderIds: ReadonlySet<string>,
): Record<string, CourierBulkAction> =>
  Object.fromEntries(
    Object.entries(actions).filter(([orderId]) => !succeededOrderIds.has(orderId)),
  ) as Record<string, CourierBulkAction>;

/** Buyurtma qo'lda / skan bilan belgilanganmi (belgilanmagani yakunlashda sotiladi — sukut). */
export const isCourierBulkOrderMarked = (orderId: string, actions: Record<string, CourierBulkAction>) =>
  actions[orderId] !== undefined;

/**
 * Belgilanmagan buyurtmalar soni — yakunlashda SUKUT bo'yicha sotiladiganlar: «Sotiladi» kartasi izohi, tasdiq
 * oynasi (belgilash katagi) va kameradagi «Belgilanmagan N ta — sotiladi». «Belgilanmagan» natija filtri va
 * qatordagi belgi ham shu ta'rif bilan (`filterCourierBulkOrders`, `CourierBulkOrders`).
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
 * Telefon raqamlar bo'yicha ham solishtiriladi («90 214» → `+998902146631`). Bu yerdan sotilmaydigani («sotildi»
 * belgisi bilan) «Sotiladi» ga kirmaydi — kartalardagi sonlar bilan bir xil. «Sotiladi» — belgilanmaganlar ham
 * (sukut); «Belgilanmagan» — hech qanday belgi qo'yilmaganlar (ular ham sotiladi).
 */
export const filterCourierBulkOrders = <T extends CourierBulkOrder>(
  orders: T[],
  actions: Record<string, CourierBulkAction>,
  { query, result }: { query: string; result: CourierBulkResultFilter },
): T[] => {
  const needle = query.trim().toLocaleLowerCase();
  const needleDigits = digitsOf(needle);

  return orders.filter((order) => {
    if (
      result === "sold" &&
      getCourierBulkOrderAction(order.id, actions) === "sold" &&
      isCourierBulkSellBlocked(order)
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
 * Bitta bulk so'rovdagi buyurtmalar soni (BE chegarasi 50). Server bo'lakni KETMA-KET bajaradi: ~20 ta sotuv bir necha
 * soniya — brauzer kutish chegarasidan (`LONG_REQUEST_TIMEOUT_MS`) ancha past; 100 ta buyurtma = 5 so'rov (ilgari 100).
 */
export const COURIER_BULK_CHUNK_SIZE = 20;

export const chunkCourierBulk = <T>(items: readonly T[], size = COURIER_BULK_CHUNK_SIZE): T[][] => {
  const step = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += step) chunks.push(items.slice(index, index + step));
  return chunks;
};

/** BE bulk javobidagi xato bergan buyurtma. */
export type CourierBulkServerFailure = { order_id: string; status_code: number; message: string };

/** BE `POST /orders/bulk/*` javobi (`{ statusCode, data: { succeeded, failed } }` yoki ichki `data`) → natija. */
export const extractCourierBulkServerResult = (
  payload: unknown,
): { succeeded: string[]; failed: CourierBulkServerFailure[] } | null => {
  const source = asRecord(payload);
  const data = Array.isArray(source.succeeded) ? source : asRecord(source.data);
  if (!Array.isArray(data.succeeded) || !Array.isArray(data.failed)) return null;
  return {
    succeeded: data.succeeded.map((id) => String(id)),
    failed: data.failed.map((raw) => {
      const failure = asRecord(raw);
      return {
        order_id: String(failure.order_id ?? ""),
        status_code: Number(failure.status_code) || 0,
        message: typeof failure.message === "string" ? failure.message : "",
      };
    }),
  };
};

/**
 * Server qaytargan bitta buyurtma xatosi — axios xatosi SHAKLIDA: natija oynasi (`getBackendErrorMessage`) backend
 * sababini, `getCourierBulkRetryKind` esa qayta yuborish turini (429 / 5xx / 409 «Takroriy so'rov») o'qiydi.
 */
export const toCourierBulkOrderError = (failure: Pick<CourierBulkServerFailure, "status_code" | "message">) => ({
  response: {
    status: failure.status_code,
    data: failure.message ? { message: failure.message } : {},
  },
});

/**
 * Bitta amal (sotish YOKI bekor) buyurtmalarini bulk so'rovlar bilan bajaradi: 20 tadan bo'lak, bo'laklar KETMA-KET
 * (bir kuryer / filial kassasi qatorlari uchun server qulf raqobati yo'q, gateway chegarasi yeyilmaydi).
 *
 * Har so'rov yakunlash kaliti bilan (`send` uni sarlavhaga qo'yadi) — server har buyurtmaga shundan barqaror kalit
 * oladi, shuning uchun qayta yuborish amalni ikki marta bajarmaydi:
 *  - butun so'rov vaqtinchalik xato bersa (429, 5xx, tarmoq, brauzer kutish chegarasi) — bo'lak shu kalit bilan
 *    `withCourierBulkRetry` qoidasi bo'yicha qayta yuboriladi;
 *  - javobdagi vaqtinchalik buyurtma xatolari (5xx, 409 «hali bajarilmoqda») — faqat o'sha buyurtmalar kutib qayta
 *    yuboriladi; biznes xatosi (4xx) — darhol natijaga.
 * Natija — har buyurtma id → `PromiseSettledResult` (`summarizeCourierBulkResults` bilan mos).
 */
export const runCourierBulkAction = async (
  orderIds: readonly string[],
  send: (orderIds: readonly string[]) => Promise<unknown>,
  {
    delays = COURIER_BULK_RETRY_DELAYS_MS,
    serverRetries = COURIER_BULK_SERVER_RETRIES,
    wait = sleep,
    chunkSize = COURIER_BULK_CHUNK_SIZE,
    onChunkDone,
  }: {
    delays?: readonly number[];
    serverRetries?: number;
    wait?: (ms: number) => Promise<void>;
    chunkSize?: number;
    /** Bo'lak yakuniy natijasi chiqqanda — shu bo'lakdagi buyurtmalar soni (jarayon ko'rsatkichi uchun). */
    onChunkDone?: (count: number) => void;
  } = {},
): Promise<Map<string, PromiseSettledResult<unknown>>> => {
  const outcome = new Map<string, PromiseSettledResult<unknown>>();
  const limitFor = (kind: CourierBulkRetryKind) =>
    kind === "server" ? Math.min(serverRetries, delays.length) : delays.length;

  for (const chunk of chunkCourierBulk(orderIds, chunkSize)) {
    let pending: readonly string[] = chunk;
    for (let attempt = 0; pending.length > 0; attempt += 1) {
      let payload: unknown;
      try {
        payload = await send(pending);
      } catch (error) {
        const kind = getCourierBulkRetryKind(error);
        if (!kind || attempt >= limitFor(kind)) {
          pending.forEach((orderId) => outcome.set(orderId, { status: "rejected", reason: error }));
          break;
        }
        await wait(delays[attempt]);
        continue;
      }

      const result = extractCourierBulkServerResult(payload);
      const retry: string[] = [];
      let retryKind: CourierBulkRetryKind | null = null;
      const reported = new Set<string>();
      result?.succeeded.forEach((orderId) => {
        reported.add(orderId);
        outcome.set(orderId, { status: "fulfilled", value: undefined });
      });
      result?.failed.forEach((failure) => {
        reported.add(failure.order_id);
        const error = toCourierBulkOrderError(failure);
        outcome.set(failure.order_id, { status: "rejected", reason: error });
        const kind = getCourierBulkRetryKind(error);
        if (!kind) return;
        retry.push(failure.order_id);
        // Bittasi «server» bo'lsa — qisqaroq chegara (doimiy nosozlikda cho'zilmasin).
        retryKind = retryKind === "server" || kind === "server" ? "server" : "wait";
      });
      // Javobda yo'q buyurtma (kutilmagan) — sababsiz xato, qayta yuborilmaydi.
      pending
        .filter((orderId) => !reported.has(orderId))
        .forEach((orderId) =>
          outcome.set(orderId, { status: "rejected", reason: toCourierBulkOrderError({ status_code: 0, message: "" }) }),
        );

      if (retry.length === 0 || retryKind === null || attempt >= limitFor(retryKind)) break;
      await wait(delays[attempt]);
      pending = retry;
    }
    onChunkDone?.(chunk.length);
  }
  return outcome;
};

/**
 * Bitta yakunlash urinishidagi amal kaliti: qayta yuborishda o'zgarmaydi (backend takrorni tanib oladi), keyingi
 * «Kunni yakunlash» — yangi `runId`, yangi kalit (xato bergan buyurtma qaytadan bajariladi).
 */
export const getCourierBulkIdempotencyKey = (runId: string, action: CourierBulkFinalizeAction, orderId: string) =>
  `courier-bulk:${runId}:${action}:${orderId}`;

/** Isbotli buyurtmalar (fayl yuklash + amal) — yakka so'rov bilan, ko'pi bilan 2 tadan parallel (j9KFyqlS). */
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
