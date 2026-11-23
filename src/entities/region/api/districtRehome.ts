import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../../shared/api";
import { api, REHOME_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";

/**
 * TUMAN BUYURTMALARINI XIZMAT VILOYATI POCHTASIGA KO'CHIRISH (PlIPwpQY — API qatlami; UI — AGJdinIw).
 *
 * `POST district/:id/rehome-open-orders` (tana yo'q; SUPERADMIN/ADMIN, boshqasi 403; `id` raqam emas — 400). Tuman
 * boshqa viloyatga o'tkazilgach HQ'ning eski viloyat YANGI pochtasida qolgan shu tuman buyurtmalari jo'natishda 409
 * `district_not_served_by_branch` beradi — amal ularni tumanning xizmat viloyati (`assigned_region ?? region_id`) YANGI
 * pochtasiga ko'chiradi. Buyurtma viloyati o'zgarmaydi — faqat pochta a'zoligi. Gateway 30 s kutadi (bir nechta RPC),
 * brauzer `REHOME_REQUEST_TIMEOUT_MS` (35 s).
 *
 * Javob `data`: `district_id`, `target_region_id`, `moved`, `order_ids[]`, `from_post_ids[]`, `to_post_id` (ko'chadigani
 * bo'lmasa `null`), `skipped[] { order_id, reason }`. `PATCH district/:id` da `rehome_open_orders: true` — xuddi shu
 * amal (natija `data.rehome`) — `parseDistrictRehomeResult` uni ham o'qiydi.
 */

/** Backend `districtRehomeSkipReason` / `rehomeDistrictOpenOrders` sabablari; noma'lumi satr bo'lib qoladi. */
export type DistrictRehomeSkipReason =
  | "deleted"
  | "status_not_received"
  | "in_transfer_batch"
  | "held_by_courier"
  | "not_in_hq_custody"
  | "target_post_not_new"
  | "changed_during_rehome"
  | (string & {});

export interface DistrictRehomeSkipped {
  orderId: string;
  reason: DistrictRehomeSkipReason;
}

export interface DistrictRehomeResult {
  districtId: string;
  targetRegionId: string | null;
  moved: number;
  orderIds: string[];
  fromPostIds: string[];
  /** Qabul qilgan YANGI pochta; ko'chadigani bo'lmasa — `null`. */
  toPostId: string | null;
  skipped: DistrictRehomeSkipped[];
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const idOf = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(idOf).filter((id): id is string => id !== null) : [];

/**
 * Javobni o'qiydi: `{ statusCode, data: {...} }`, to'g'ridan-to'g'ri `{...}` yoki `PATCH district/:id` javobidagi
 * `data.rehome`. Tanimasa — `null` (natija noma'lum; soxta «0 ta ko'chirildi» ko'rsatilmaydi).
 */
export const parseDistrictRehomeResult = (payload: unknown): DistrictRehomeResult | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const body = asRecord(data?.rehome) ?? data;
  if (!body) return null;
  const districtId = idOf(body.district_id);
  const moved = Number(body.moved);
  if (!districtId || !Number.isFinite(moved) || moved < 0) return null;
  const skipped = (Array.isArray(body.skipped) ? body.skipped : [])
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null)
    .map((row) => ({ orderId: idOf(row.order_id), reason: typeof row.reason === "string" ? row.reason.trim() : "" }))
    .filter((row): row is DistrictRehomeSkipped => row.orderId !== null && row.reason !== "");
  return {
    districtId,
    targetRegionId: idOf(body.target_region_id),
    moved,
    orderIds: idsOf(body.order_ids),
    fromPostIds: idsOf(body.from_post_ids),
    toPostId: idOf(body.to_post_id),
    skipped,
  };
};

export const rehomeDistrictOpenOrders = async (districtId: string): Promise<DistrictRehomeResult | null> => {
  const response = await api.post(API_ENDPOINTS.DISTRICTS.REHOME_OPEN_ORDERS(districtId), undefined, {
    timeout: REHOME_REQUEST_TIMEOUT_MS,
  });
  return parseDistrictRehomeResult(response.data);
};

/**
 * Ko'chirish mutatsiyasi. Muvaffaqiyatda pochta va buyurtma ro'yxatlari eskiradi (buyurtmalar boshqa pochtaga
 * o'tdi) — `mails` va `orders` kalitli so'rovlar yangilanadi. Xato o'qish — iste'molchida (`getApiErrorMessage`,
 * `coverageReasons`).
 */
export const useRehomeDistrictOrders = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (districtId: string) => rehomeDistrictOpenOrders(districtId),
    onSuccess: () => {
      for (const key of ["mails", "orders"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
};
