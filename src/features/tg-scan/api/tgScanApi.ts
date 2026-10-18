// dizayn-v2: courier-scan-active
import axios from "axios";
import { API_ENDPOINTS } from "../../../shared/api/endpoints";
import { BASE_URL } from "../../../shared/const";

/**
 * SKAN MINI APP'NING O'Z HTTP MIJOZI (MWYaqprw).
 *
 * Asosiy `api` (`shared/api/api.ts`) ishlatilmaydi: uning interceptorlari asosiy sessiya tokenini
 * (`sessionStorage`) qo'shadi, 401 da cookie orqali yangilashga urinadi va `/login` ga olib ketadi.
 * Mini App'da esa kirish faqat Telegram `initData` orqali: `POST /auth/telegram` 30 daqiqalik kuryer
 * JWT beradi (refresh YO'Q), u faqat xotirada turadi va har so'rovga shu yerda qo'shiladi. 401 —
 * sahifa «Mini App'ni qayta oching» deydi.
 *
 * `X-Request-Source: tg-scan` — faoliyat jurnalida skan Mini App'dan kelganini ajratadi (backend CORS ruxsat bergan).
 */

export const TG_SCAN_REQUEST_SOURCE = "tg-scan";
/** Asosiy mijozdagi bilan bir xil vaqt chegarasi (`API_TIMEOUT_MS`, qJjLP109). */
const TIMEOUT_MS = 20_000;
/** Backend chegarasi: bitta «Tayyor» so'rovida 1..200 ta id. */
export const SCAN_DONE_BATCH_LIMIT = 200;

export const tgScanHttp = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  timeoutErrorMessage: "So'rov vaqti tugadi",
  // Mini App cookie ishlatmaydi (refresh yo'q).
  withCredentials: false,
});

export type TelegramAuthUser = {
  id?: string | number;
  name?: string | null;
  role?: string | null;
};

export type TelegramAuthResult = {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  user: TelegramAuthUser | null;
};

/** `POST /orders/scan-assign` → `data.order` (gateway `scanOrderSummary`; qidiruv yiqilsa bo'lmaydi). */
export type ScanOrderSummary = {
  id: string;
  order_number: string | null;
  status: string | null;
  total_price: number | null;
  address: string | null;
  district: string | null;
  region: string | null;
  market: string | null;
  customer: { name: string | null; phone_number: string | null } | null;
};

export type ScanAssignResult = {
  /** `true` — buyurtma allaqachon shu kuryerda edi. */
  idempotent: boolean;
  order_id: string;
  post_id: string | null;
  post_created: boolean;
  order: ScanOrderSummary | null;
};

export type ScanDoneResult = {
  accepted: number;
  ignored: number;
};

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;

/** `{ data: {...} }` yoki `{...}` — javob qobig'ini ochadi. */
const unwrapData = (payload: unknown): Row | null => {
  const top = asRow(payload);
  return asRow(top?.data) ?? top;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;

const authHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "X-Request-Source": TG_SCAN_REQUEST_SOURCE,
});

export const loginWithTelegram = async (initData: string): Promise<TelegramAuthResult> => {
  const response = await tgScanHttp.post(
    API_ENDPOINTS.AUTH.TELEGRAM,
    { init_data: initData },
    { headers: { "X-Request-Source": TG_SCAN_REQUEST_SOURCE } },
  );
  // Identity javobi ochiq: `{ statusCode, message, user, accessToken, access_token_expires_at }`.
  const top = asRow(response.data);
  const body = top && text(top.accessToken) ? top : unwrapData(response.data);
  const accessToken = text(body?.accessToken);
  if (!accessToken) throw new Error("accessToken missing in /auth/telegram response");
  const expiresAt = Number(body?.access_token_expires_at);
  const user = asRow(body?.user);
  return {
    accessToken,
    accessTokenExpiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    user: user
      ? { id: text(user.id) ?? undefined, name: text(user.name), role: text(user.role) }
      : null,
  };
};

const toOrderSummary = (value: unknown): ScanOrderSummary | null => {
  const row = asRow(value);
  const id = text(row?.id);
  if (!row || !id) return null;
  const customer = asRow(row.customer);
  const price = Number(row.total_price);
  return {
    id,
    order_number: text(row.order_number),
    status: text(row.status),
    total_price: row.total_price != null && Number.isFinite(price) ? price : null,
    address: text(row.address),
    district: text(row.district),
    region: text(row.region),
    market: text(row.market),
    customer: customer ? { name: text(customer.name), phone_number: text(customer.phone_number) } : null,
  };
};

export const scanAssignOrder = async (accessToken: string, qrToken: string): Promise<ScanAssignResult> => {
  const response = await tgScanHttp.post(
    API_ENDPOINTS.ORDERS.SCAN_ASSIGN,
    { qr_token: qrToken },
    { headers: authHeaders(accessToken) },
  );
  const data = unwrapData(response.data);
  const order = toOrderSummary(data?.order);
  const orderId = text(data?.order_id) ?? order?.id;
  if (!orderId) throw new Error("order_id missing in /orders/scan-assign response");
  return {
    idempotent: data?.idempotent === true,
    order_id: orderId,
    post_id: text(data?.post_id),
    post_created: data?.post_created === true,
    order,
  };
};

/**
 * «Tayyor»: botga xulosa xabari. Id'lar 200 tadan bo'lib yuboriladi (backend chegarasi); bo'sh ro'yxat
 * yuborilmaydi — chaqiruvchi bunda so'rovsiz yopadi.
 */
export const finishScanSession = async (accessToken: string, orderIds: string[]): Promise<ScanDoneResult> => {
  const total: ScanDoneResult = { accepted: 0, ignored: 0 };
  for (let start = 0; start < orderIds.length; start += SCAN_DONE_BATCH_LIMIT) {
    const response = await tgScanHttp.post(
      API_ENDPOINTS.TELEGRAM_SCAN.DONE,
      { order_ids: orderIds.slice(start, start + SCAN_DONE_BATCH_LIMIT) },
      { headers: authHeaders(accessToken) },
    );
    const data = unwrapData(response.data);
    total.accepted += Number(data?.accepted) || 0;
    total.ignored += Number(data?.ignored) || 0;
  }
  return total;
};
