import type { QueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { extractScannerToken } from "../../../shared/lib/scanToken";
export { getBackendErrorMessage } from "../../../shared/lib/backendError";

/**
 * Skanerlangan kod turi.
 *
 *   order            — buyurtma (24 belgili hex yoki provayder yorlig'i);
 *   package          — paket `BTB-…`;
 *   returned-package — qaytarilgan paket `BTR-…`;
 *   post             — pochta `POST-…` (backend yaratadigan haqiqiy shakl) yoki `PST-…`;
 *   external-bag     — tashqi (BeePost) qop yorlig'i: buyurtma topilmadi, `GET scan/:token` qopni tanidi;
 *   market-qr        — market QR'i `MCR-…` (bekor qilinganlarni topshirish) — hech qachon so'ralmaydi.
 */
export type ScanResourceType = "order" | "package" | "returned-package" | "post" | "external-bag" | "market-qr";

export interface ScanDetailResponse<T = unknown> {
  type: ScanResourceType;
  data: T;
}

/** Ichki buyurtma tokeni — 24 ta kichik hex belgi (backend `generateCustomToken`). */
const INTERNAL_ORDER_TOKEN = /^[0-9a-f]{24}$/i;

/**
 * Token → so'rovga ketadigan shakl: `/scan/<t>` havolasidan ajratiladi; ichki (24 hex) token kichik harfga
 * keltiriladi — Caps Lock yoqiq HID skaneri «A1B2…» yuborsa ham backend aniq moslikda topadi. Prefiksli va
 * provayder tokenlari o'zgarmaydi (ular katta-kichik harfga sezgir bo'lishi mumkin).
 */
export const normalizeScanToken = (token: string) => {
  const extracted = extractScannerToken(token) ?? token.trim();
  return INTERNAL_ORDER_TOKEN.test(extracted) ? extracted.toLowerCase() : extracted;
};

export const getScanResourceType = (token: string): ScanResourceType => {
  const normalizedToken = normalizeScanToken(token).toUpperCase();

  if (normalizedToken.startsWith("BTB-")) return "package";
  if (normalizedToken.startsWith("BTR-")) return "returned-package";
  // Backend pochta tokenini `POST-<base36>-<rand>` qilib yaratadi (Trello X4RzXk1H); `GET scan/:token` esa
  // `PST-` ni kutadi — shuning uchun ikkalasi ham to'g'ridan-to'g'ri `GET post/scan/:token` ga.
  if (normalizedToken.startsWith("POST-") || normalizedToken.startsWith("PST-")) return "post";
  if (normalizedToken.startsWith("MCR-")) return "market-qr";
  return "order";
};

export const getScanDetailQueryKey = (token: string) => {
  const normalizedToken = normalizeScanToken(token);
  return ["scan-detail", getScanResourceType(normalizedToken), normalizedToken] as const;
};

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `GET scan/:token` javobi `{ type, data }` (global o'ram bilan — `{ statusCode, data: { type, data } }`).
 * Qop: `type: "batch"` + `data.is_external_batch: true` (paket bilan bir xil `type` — farqi shu bayroqda).
 */
const pickTyped = (body: unknown): { type: string; data: unknown } | null => {
  let current: unknown = body;
  for (let depth = 0; depth < 3 && isRecord(current); depth += 1) {
    if (typeof current.type === "string") return { type: current.type.toLowerCase(), data: current.data };
    current = current.data;
  }
  return null;
};

const unwrapRecord = (value: unknown): AnyRecord | null => {
  let current: unknown = value;
  for (let depth = 0; depth < 3 && isRecord(current); depth += 1) {
    if (!isRecord(current.data)) return current;
    current = current.data;
  }
  return isRecord(current) ? current : null;
};

/** Qop javobimi (`is_external_batch: true`)? — `/scan/:token` va universal skaner uchun. */
export const isExternalBagPayload = (data: unknown) => unwrapRecord(data)?.is_external_batch === true;

/**
 * Kodni aniqlash (universal skaner va `/scan/:token`):
 *
 *   - `MCR-` — so'rovsiz `market-qr` (market QR'ini backend bir martada «yeydi» — `POST scan/market-cancelled`;
 *     uni bu yerda tekshirish ham bo'lmaydi, u Bekor qilinganlar sahifasida skanerlanadi);
 *   - `BTB-` / `BTR-` → `GET scan/:token`; `POST-` / `PST-` → `GET post/scan/:token`;
 *   - qolgani → `GET orders/qr-code/:token`; **404** bo'lsa `GET scan/:token` zaxirasi: BeePost qop yorlig'i
 *     prefikssiz keladi va buyurtma sifatida topilmaydi (backend CyCV4XHR) — qop bo'lsa `external-bag`,
 *     aks holda asl 404 qaytadi (sahifa «Buyurtma topilmadi»).
 *
 * Token yo'lda `encodeURIComponent` bilan (provayder yorlig'ida `/` bo'lishi mumkin).
 */
export const fetchScanDetail = async (token: string): Promise<ScanDetailResponse> => {
  const normalizedToken = normalizeScanToken(token);
  const resourceType = getScanResourceType(normalizedToken);
  const encoded = encodeURIComponent(normalizedToken);

  if (resourceType === "market-qr") return { type: resourceType, data: null };

  if (resourceType === "post") {
    const response = await api.get(API_ENDPOINTS.POSTS.SCAN(encoded)).then((res) => res.data);
    return { type: resourceType, data: response };
  }

  if (resourceType === "package" || resourceType === "returned-package") {
    const response = await api.get(API_ENDPOINTS.SCAN.BY_TOKEN(encoded)).then((res) => res.data);
    return { type: resourceType, data: response };
  }

  try {
    const response = await api.get(API_ENDPOINTS.ORDERS.QR_CODE(encoded)).then((res) => res.data);
    return { type: "order", data: response };
  } catch (error) {
    if (getErrorStatus(error) !== 404) throw error;
    let fallback: unknown;
    try {
      fallback = await api.get(API_ENDPOINTS.SCAN.BY_TOKEN(encoded)).then((res) => res.data);
    } catch {
      // Qop ham emas (yoki zaxira yo'li ishlamadi) — foydalanuvchiga asl «buyurtma topilmadi».
      throw error;
    }
    const typed = pickTyped(fallback);
    if (typed?.type === "batch" && isExternalBagPayload(typed.data)) {
      return { type: "external-bag", data: typed.data };
    }
    if (typed?.type === "order") return { type: "order", data: typed.data };
    throw error;
  }
};

/**
 * P1b — kuryer skan qilgan buyurtmani O'ZIGA oladi.
 *
 * Backend (`POST /orders/scan-assign`) bir amalda ikkisini bajaradi:
 *   1. buyurtma kuryer filialiga jo'natilgan paketda bo'lsa — FILIAL QABULI;
 *   2. keyin buyurtmani kuryerga biriktirish.
 * Ya'ni bitta skan, lekin mas'uliyat zanjirida ikki bo'g'in (HQ → filial →
 * kuryer) — shu bois posilka yo'qolsa kim yo'qotganini aniqlash mumkin.
 *
 * Faqat COURIER roli chaqira oladi (gateway guardi).
 */
export const scanAssignOrder = async (qrToken: string) =>
  api
    .post(API_ENDPOINTS.ORDERS.SCAN_ASSIGN, { qr_token: qrToken })
    .then((res) => res.data);

/**
 * Universal skaner «Qabul qilish» rejimi (3-bosqich) — market varag'i: `GET orders/markets/new` (bugun yangi
 * buyurtmasi bor marketlar, har birida son). Kalit `useOrders().useGetTodayOrders()` niki bilan bir xil
 * (`["orders", undefined]`) — kelgan `/new-orders/:marketId` sahifasi va «Marketlar» ro'yxati shu javobni oladi.
 * Varaq har ochilganda yangi ro'yxat (`staleTime: 0`).
 */
export const NEW_ORDER_MARKETS_QUERY_KEY = ["orders", undefined] as const;

export const fetchNewOrderMarkets = (queryClient: QueryClient) =>
  queryClient.fetchQuery({
    queryKey: [...NEW_ORDER_MARKETS_QUERY_KEY],
    queryFn: () => api.get(API_ENDPOINTS.ORDERS.MARKETS_NEW).then((res) => res.data),
    staleTime: 0,
    retry: false,
  });

/**
 * Paketni qabul qilish — gateway `@Post('transfer-batches/:id/receive')`
 * (paketlar sahifasi ham POST yuboradi). fix3 CODE-15: avval PATCH edi va
 * /scan dan qabul doim 404 berardi.
 */
export const receiveScannedPackage = async (packageIdOrToken: string) =>
  api
    .post(API_ENDPOINTS.BATCHES.RECEIVE(encodeURIComponent(packageIdOrToken)))
    .then((res) => res.data);

/**
 * Skaner amalidan keyin (kuryer «O'zimga olish», paket «Qabul qilish») boshqa ekranlar eskirib qolmasin
 * (Trello 6qypMFeT; global `staleTime` 30 s, oyna fokusida qayta so'ralmaydi): buyurtmalar, pochtalar,
 * paketlar, «Filial paketlari» ro'yxati va tab soni, bosh sahifa ko'rsatkichlari va skan natijalari keshi
 * eskirgan deb belgilanadi. Skan natijasi keshi (`scan-detail`) darhol qayta so'ralmaydi — keyingi ochilishda
 * yangisi olinadi. Ochiq paket sahifasi esa o'z `["batches", id]` so'rovi bilan yangi holatni darhol oladi
 * (faol so'rov) — amal xabari («Paket qabul qilindi») o'z joyida qoladi.
 */
// `"batches"` — `entities/batch` dagi `BATCH_KEY` (import qilinmaydi: ko'p sahifa testlari `entities/batch` ni
// soxtalaydi; tenglik `scanResource.test.ts` da tekshiriladi). `["branches", "with-sent-batches"]` —
// `queryKeys.branches.withSentBatches`, `["dashboard"]` — bosh sahifa (`entities/order` ham shuni yangilaydi).
export const SCAN_ACTION_QUERY_PREFIXES = [
  ["orders"],
  ["mails"],
  ["batches"],
  ["branches", "with-sent-batches"],
  ["dashboard"],
  ["scan-detail"],
] as const;

export const invalidateAfterScanAction = (queryClient: QueryClient) =>
  Promise.all(
    SCAN_ACTION_QUERY_PREFIXES.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey: [...queryKey],
        refetchType: queryKey[0] === "scan-detail" ? "none" : "active",
      }),
    ),
  ).then(() => undefined);
