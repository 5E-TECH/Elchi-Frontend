import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import type { BranchType } from "../../../entities/branch";
import type {
  CourierTransferBranchRef,
  CourierTransferCheck,
  CourierTransferCheckRaw,
  CourierTransferHqRef,
  CourierTransferOrderSample,
  TransferCourierResponse,
} from "../model/types";

const BRANCH_TYPES: readonly BranchType[] = ["HQ", "PICKUP", "REGIONAL", "HYBRID"];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Son kelmasa (yoki `NaN`) — 0. Summalar serverda so'mda, JSON son sifatida. */
const toNumber = (value: unknown) => Number(value) || 0;

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const toBranchType = (value: unknown): BranchType | null => {
  const normalized = toText(value).toUpperCase();
  return BRANCH_TYPES.find((type) => type === normalized) ?? null;
};

const toBranchRef = (value: unknown): CourierTransferBranchRef | null => {
  const record = asRecord(value);
  const id = toText(record?.id);
  if (!record || !id) return null;

  return { id, name: toText(record.name), type: toBranchType(record.type) };
};

const toHqRef = (value: unknown): CourierTransferHqRef | null => {
  const record = asRecord(value);
  const id = toText(record?.id);
  if (!record || !id) return null;

  return { id, name: toText(record.name) };
};

const toOrderSample = (value: unknown): CourierTransferOrderSample[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const record = asRecord(item);
        const id = toText(record?.id);
        return id ? [{ id, status: toText(record?.status) }] : [];
      })
    : [];

/**
 * Tekshiruv javobini UI shakliga keltiradi. Server matnlari (`reasons`)
 * o'zgartirilmaydi — foydalanuvchi aynan server yozganini ko'radi.
 *
 * ⚠️ Xavfsiz tomonga yopiladi: `reasons` massiv bo'lmasa yoki unda biror
 * narsa bo'lsa (hatto satr bo'lmasa ham), `can_transfer: true` bo'lsa ham
 * `canTransfer` — `false`. Server o'tkazishda hammasini qayta tekshiradi.
 */
export const normalizeCourierTransferCheck = (raw: unknown): CourierTransferCheck => {
  const record = (asRecord(raw) ?? {}) as CourierTransferCheckRaw;
  const rawReasons = Array.isArray(record.reasons) ? (record.reasons as unknown[]) : null;
  const reasons = (rawReasons ?? []).filter(
    (reason): reason is string => typeof reason === "string" && reason.trim() !== "",
  );

  return {
    userId: toText(record.user_id),
    currentBranch: toBranchRef(record.current_branch),
    hqBranch: toHqRef(record.hq_branch),
    balance: toNumber(record.balance),
    ordersInHand: toNumber(record.orders_in_hand),
    ordersSample: toOrderSample(record.orders_sample),
    openReturnPosts: toNumber(record.open_return_posts),
    pendingSettlementCount: toNumber(record.pending_settlement_count),
    reasons,
    canTransfer: record.can_transfer === true && rawReasons !== null && rawReasons.length === 0,
  };
};

/** GET /couriers/:id/transfer-check (superadmin/admin). */
export const getCourierTransferCheck = async (courierId: string): Promise<CourierTransferCheck> => {
  const response = await api.get(API_ENDPOINTS.COURIERS.TRANSFER_CHECK(courierId));
  return normalizeCourierTransferCheck((response.data as { data?: unknown } | undefined)?.data);
};

/**
 * PATCH /couriers/:id/branch (superadmin/admin). Server avval tekshiradi,
 * keyin o'tkazadi va qayta tekshiradi (odatda ~2 s, sekin xizmatlarda
 * ~25 s gacha) — shuning uchun oddiy 20 s emas, uzoq vaqt chegarasi.
 */
export const transferCourierToBranch = async (
  courierId: string,
  branchId: string,
): Promise<TransferCourierResponse> => {
  const response = await api.patch(
    API_ENDPOINTS.COURIERS.BRANCH(courierId),
    { branch_id: branchId },
    { timeout: LONG_REQUEST_TIMEOUT_MS },
  );
  return response.data as TransferCourierResponse;
};
