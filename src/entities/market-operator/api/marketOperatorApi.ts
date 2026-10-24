import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
  CommissionType,
  CreateMarketOperatorRequest,
  MarketOperator,
  MarketOperatorCommission,
  MarketOperatorList,
  MarketOperatorListParams,
} from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const toCommissionType = (value: unknown): CommissionType | null =>
  value === "percent" || value === "fixed" ? value : null;

/** Backend qatori → `MarketOperator`. `numeric(14,2)` satr kelsa ham son; noma'lum tur — komissiyasiz. */
export const normalizeMarketOperator = (value: unknown): MarketOperator => {
  const item = asRecord(value) ?? {};
  const createdAt = item.createdAt ?? item.created_at;
  return {
    id: String(item.id ?? ""),
    name: typeof item.name === "string" ? item.name : "",
    phone_number: typeof item.phone_number === "string" ? item.phone_number : "",
    status: item.status === "inactive" ? "inactive" : "active",
    commission_type: toCommissionType(item.commission_type),
    commission_value: toNumberOrNull(item.commission_value),
    created_at: typeof createdAt === "string" ? createdAt : null,
    can_view_warehouse_stock: item.can_view_warehouse_stock === true,
  };
};

/** `{ statusCode, data: { items, meta: { page, limit, total, totalPages } } }` (javob shakli `GET /users` bilan bir xil). */
export const normalizeMarketOperatorList = (value: unknown, params: MarketOperatorListParams): MarketOperatorList => {
  const response = asRecord(value) ?? {};
  const data = asRecord(response.data) ?? response;
  const items = Array.isArray(data.items) ? data.items : Array.isArray(response.data) ? response.data : [];
  const meta = asRecord(data.meta) ?? asRecord(data.pagination) ?? {};
  const total = toNumberOrNull(meta.total ?? data.total);
  return {
    items: items.map(normalizeMarketOperator),
    total: total ?? items.length,
    page: toNumberOrNull(meta.page) ?? params.page,
    limit: toNumberOrNull(meta.limit) ?? params.limit,
  };
};

/** Yaratilgan/yangilangan operator (`successRes(view)` → `data`). */
const unwrapOperator = (value: unknown): MarketOperator => {
  const response = asRecord(value) ?? {};
  return normalizeMarketOperator(asRecord(response.data) ?? response);
};

export const getMarketOperators = async (params: MarketOperatorListParams): Promise<MarketOperatorList> => {
  const query: Record<string, string | number> = { page: params.page, limit: params.limit };
  if (params.search) query.search = params.search;
  if (params.status) query.status = params.status;
  const response = await api.get(API_ENDPOINTS.MARKET_OPERATORS.BASE, { params: query });
  return normalizeMarketOperatorList(response.data, params);
};

export const createMarketOperator = async (body: CreateMarketOperatorRequest): Promise<MarketOperator> => {
  const response = await api.post(API_ENDPOINTS.MARKET_OPERATORS.BASE, body);
  return unwrapOperator(response.data);
};

export const updateMarketOperatorCommission = async (
  id: string,
  body: MarketOperatorCommission,
): Promise<MarketOperator> => {
  const response = await api.patch(API_ENDPOINTS.MARKET_OPERATORS.COMMISSION(id), body);
  return unwrapOperator(response.data);
};

export const deleteMarketOperator = async (id: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.MARKET_OPERATORS.BY_ID(id));
};

/**
 * XtcEyQjb: «Ombordagi qoldiqni ko'radi» kaliti (`PATCH /market-operators/:id/warehouse-access`, faqat MARKET — o'z
 * operatori, begona — 404). Javob — yangilangan operator qatori.
 */
export const updateMarketOperatorWarehouseAccess = async (id: string, enabled: boolean): Promise<MarketOperator> => {
  const response = await api.patch(API_ENDPOINTS.MARKET_OPERATORS.WAREHOUSE_ACCESS(id), {
    can_view_warehouse_stock: enabled,
  });
  const body = asRecord(response.data) ?? {};
  const row = asRecord(body.data) ?? body;
  const operator = normalizeMarketOperator(row);
  // Javobda maydon bo'lmasa (qisqa javob) — so'ralgan qiymat: server 2xx bilan qabul qildi.
  return {
    ...operator,
    id: operator.id || id,
    can_view_warehouse_stock:
      typeof row.can_view_warehouse_stock === "boolean" ? row.can_view_warehouse_stock : enabled,
  };
};
