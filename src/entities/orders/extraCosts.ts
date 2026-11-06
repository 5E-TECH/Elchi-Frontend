import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { ORDER_KEY } from "../order/api/orderApi";
import { EXTRA_COST_REJECT_REASONS, type ExtraCostRejectReason } from "./extraCostDecision";
import type { ExtraCostApproval, ExtraCostApprovalStatus } from "./index";

/**
 * «QO'SHIMCHA XARAJATLI BUYURTMALAR» (GykuOz8f) — `GET orders/extra-costs?tab&page&limit`.
 *
 * Kuryer, filial menejeri, market va market operatori. Doira backend'da, faqat tokendan: kuryer — o'zi yozganlari,
 * menejer — o'z filiali kuryerlari va o'zi, market — o'z marketi, operator — biriktirilgan marketi (faqat ko'rish).
 * Admin va superadmin — 403 (sahifa ularga yopiq). So'rovda kuryer / market / filial id'si YUBORILMAYDI.
 *
 * Tablar: `all` — hammasi (tasdiqsiz darhol yozilganlar va «Teskari qaytarildi» ham), `pending` — market qaror
 * qilmagan, `approved` — tasdiqlangan, avtomatik tasdiqlangan va tasdiqsiz yozilgan, `cancelled` — rad etilgan va o'zi
 * yopilgan (`void`, sababi bilan). Javobda `counts` — har tab soni (bitta so'rov), tablar shu sonlar bilan chiziladi.
 *
 * Kalit `["orders", "extra-costs", params]` — sotish / bekor qilish / qaror (`invalidateMoney`) va jonli kanaldagi
 * `category: "order"` bildirishnomasi `["orders"]` ni yangilaydi, shu bilan ro'yxat va sonlar ham yangilanadi.
 */

export const EXTRA_COST_TABS = ["all", "pending", "approved", "cancelled"] as const;
export type ExtraCostTab = (typeof EXTRA_COST_TABS)[number];
export type ExtraCostCounts = Record<ExtraCostTab, number>;

export const isExtraCostTab = (value: unknown): value is ExtraCostTab =>
  typeof value === "string" && (EXTRA_COST_TABS as readonly string[]).includes(value);

export interface ExtraCostsParams {
  tab: ExtraCostTab;
  page: number;
  limit: number;
}

/** Ro'yxat qatori — `ExtraCostApproval` normallashtirilgan maydonlari bilan. */
export type ExtraCostRow = ExtraCostApproval & {
  status: ExtraCostApprovalStatus;
  immediate: boolean;
  order_status: string | null;
  customer: { name: string | null; phone: string | null } | null;
  market: { id: string; name: string | null } | null;
  proof_file_keys: string[];
  proof_count: number;
  reject_reason_label: string | null;
};

export interface ExtraCostsPage {
  items: ExtraCostRow[];
  total: number;
  page: number;
  limit: number;
  /** Har tab soni; javobda bo'lmasa `null` (tablar sonsiz chiziladi). */
  counts: ExtraCostCounts | null;
}

type UnknownRecord = Record<string, unknown>;

const STATUSES: readonly ExtraCostApprovalStatus[] = ["pending", "approved", "rejected", "void", "reversed"];
const ACTIONS: readonly ExtraCostApproval["action"][] = ["sell", "cancel", "partly_sell"];

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const count = (value: unknown): number | null => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(parsed) && parsed >= 0
    ? Math.trunc(parsed)
    : null;
};

/** Sana: `Date` JSON'i (ISO matn) yoki epoch-millisekund → ISO; bo'sh — `null`. */
const isoDate = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{10,15}$/.test(raw)) {
    const date = new Date(Number(raw));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return raw;
};

const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((key): key is string => typeof key === "string" && key.trim() !== "").map((key) => key.trim())
    : [];

const toCustomer = (value: unknown): ExtraCostRow["customer"] => {
  const record = asRecord(value);
  if (!record) return null;
  return { name: text(record.name), phone: text(record.phone ?? record.phone_number) };
};

const toMarket = (value: unknown): ExtraCostRow["market"] => {
  const record = asRecord(value);
  const id = record ? text(record.id) : null;
  return record && id ? { id, name: text(record.name) } : null;
};

const toRow = (row: UnknownRecord): ExtraCostRow => {
  const status = STATUSES.find((value) => value === row.status) ?? "pending";
  const action = ACTIONS.find((value) => value === row.action) ?? "sell";
  const proofKeys = keysOf(row.proof_file_keys);
  const requester = asRecord(row.requested_by);
  const rejectReason = EXTRA_COST_REJECT_REASONS.find((value) => value === row.reject_reason) ?? null;
  return {
    id: text(row.id) ?? "",
    order_id: text(row.order_id) ?? "",
    order_number: text(row.order_number),
    market_id: text(row.market_id) ?? "",
    requested_by_user_id: text(row.requested_by_user_id) ?? "",
    requested_by_role: text(row.requested_by_role),
    requested_by: requester ? { id: text(requester.id), name: text(requester.name) } : null,
    requester_branch_id: text(row.requester_branch_id),
    action,
    amount: amount(row.amount),
    proof_file_keys: proofKeys,
    status,
    decided_by_user_id: text(row.decided_by_user_id),
    decided_at: isoDate(row.decided_at),
    decision_comment: text(row.decision_comment),
    auto_approved: row.auto_approved === true,
    auto_approve_at: isoDate(row.auto_approve_at),
    reject_reason: rejectReason as ExtraCostRejectReason | null,
    closed_reason: text(row.closed_reason),
    closed_at: isoDate(row.closed_at),
    createdAt: isoDate(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: isoDate(row.updatedAt ?? row.updated_at) ?? undefined,
    immediate: row.immediate === true,
    order_status: text(row.order_status),
    customer: toCustomer(row.customer),
    market: toMarket(row.market),
    // Son kelmasa — kalitlar soni (eski javob).
    proof_count: Math.max(count(row.proof_count) ?? 0, proofKeys.length),
    reject_reason_label: text(row.reject_reason_label),
  };
};

const toCounts = (value: unknown): ExtraCostCounts | null => {
  const record = asRecord(value);
  if (!record) return null;
  const entries = EXTRA_COST_TABS.map((tab) => [tab, count(record[tab])] as const);
  return entries.every(([, value]) => value !== null)
    ? (Object.fromEntries(entries) as ExtraCostCounts)
    : null;
};

/** Javob (`{ statusCode, data: { items, total, page, limit, counts } }`) → sahifa. */
export const toExtraCostsPage = (payload: unknown): ExtraCostsPage => {
  const root = asRecord(payload);
  const data = root && "data" in root ? root.data : payload;
  const record = asRecord(data) ?? {};
  const list = Array.isArray(data) ? data : Array.isArray(record.items) ? record.items : [];
  const items = list
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null)
    .map(toRow)
    .filter((row) => row.id !== "" && row.order_id !== "");
  return {
    items,
    total: Math.max(amount(record.total, items.length), items.length),
    page: Math.max(1, amount(record.page, 1)),
    limit: Math.max(1, amount(record.limit, items.length || 25)),
    counts: toCounts(record.counts),
  };
};

export const extraCostsQueryKey = (params: ExtraCostsParams) => [ORDER_KEY, "extra-costs", params] as const;

/**
 * Ro'yxat; tab yoki sahifa almashganda oldingi qatorlar ko'rinib turadi. `enabled: false` — so'rov yo'q (marketga
 * biriktirilmagan operator: backend 403 beradi).
 */
export const useExtraCosts = (params: ExtraCostsParams, enabled = true) =>
  useQuery({
    queryKey: extraCostsQueryKey(params),
    queryFn: async () =>
      toExtraCostsPage(
        (
          await api.get(API_ENDPOINTS.ORDERS.EXTRA_COSTS, {
            params: { tab: params.tab, page: params.page, limit: params.limit },
          })
        ).data,
      ),
    enabled,
    placeholderData: keepPreviousData,
    // Kutilayotgan so'rov boshqa joyda (Telegram ✅/❌, avtomatik tasdiq) hal bo'lishi mumkin — oynaga qaytilganda
    // yangilanadi (global sukut `false`). Xato sahifaning o'zida (`ErrorState`) — global xabar takrorlanmasin.
    refetchOnWindowFocus: "always",
    meta: { silentError: true },
  });

/**
 * Isbot faylining API yo'li (`ProofGallery` → `sources`: baytlar JWT bilan `blob` qilib olinadi). Bu yo'l ro'yxat bilan
 * bir xil ko'rinish qoidasida — kutilayotgan, rad etilgan va yopilgan so'rov isboti ham, operatorga ham ochiladi.
 */
export const extraCostProofPath = (approvalId: string, index: number) =>
  API_ENDPOINTS.ORDERS.EXTRA_COST_PROOF(encodeURIComponent(approvalId), index);
