import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type {
  CreateWarehouseRequest,
  InventoryRequest,
  MarketStockParams,
  ResolveSourceRequest,
  StockInRequest,
  UpdateWarehouseRequest,
  WarehouseListParams,
  WarehouseMovementParams,
  WarehouseStockParams,
} from "../model/types";
import {
  createWarehouse,
  getMarketWarehouseStock,
  getWarehouse,
  getWarehouseMovements,
  getWarehouses,
  getWarehouseStock,
  inventoryWarehouse,
  pauseWarehouse,
  resolveOrderSource,
  resumeWarehouse,
  setMarketWarehouseOrder,
  setStockThreshold,
  stockInWarehouse,
  updateWarehouse,
} from "./warehouseApi";

/**
 * O'qish so'rovlari: xatoni sahifa o'zi ko'rsatadi (`QueryBoundary` / `ErrorState`) — global xabar yo'q
 * (`silentError`); filtr / sahifa almashganda eski qatorlar yangi javobgacha turadi (`keepPreviousData`).
 */
const READ_OPTIONS = { meta: { silentError: true }, placeholderData: keepPreviousData } as const;

/** `GET /warehouses` (superadmin, admin; menejer — o'z filiali ombori). */
export const useWarehouseList = (params: WarehouseListParams, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: () => getWarehouses(params),
    enabled,
    ...READ_OPTIONS,
  });

/**
 * 6kHnNH9j: buyurtma formasidagi manba oldindan ko'rinishi. So'rov tanasi — kalit (chaqiruvchi kechiktiradi); xato
 * global xabarsiz — blok o'zi «aniqlab bo'lmadi» deydi. Yangi tana javobigacha eski natija turadi.
 */
export const useOrderSourcePreview = (body: ResolveSourceRequest | null) =>
  useQuery({
    queryKey: queryKeys.warehouses.resolveSource(body ?? {}),
    queryFn: () => resolveOrderSource(body as ResolveSourceRequest),
    enabled: body !== null,
    staleTime: 15_000,
    retry: false,
    ...READ_OPTIONS,
  });

/** `GET /warehouses/:id` — sarlavha va KPI (begona filial — 404). */
export const useWarehouse = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.warehouses.detail(id ?? ""),
    queryFn: () => getWarehouse(id as string),
    enabled: Boolean(id),
    meta: { silentError: true },
  });

export const useWarehouseStock = (id: string | undefined, params: WarehouseStockParams) =>
  useQuery({
    queryKey: queryKeys.warehouses.stock(id ?? "", params),
    queryFn: () => getWarehouseStock(id as string, params),
    enabled: Boolean(id),
    ...READ_OPTIONS,
  });

export const useWarehouseMovements = (
  id: string | undefined,
  params: WarehouseMovementParams,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.warehouses.movements(id ?? "", params),
    queryFn: () => getWarehouseMovements(id as string, params),
    enabled: Boolean(id) && enabled,
    ...READ_OPTIONS,
  });

/** `GET /market/warehouse-stock` — market «Ombordagi qoldiq» (faqat ko'rish). */
export const useMarketWarehouseStock = (params: MarketStockParams, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.warehouses.marketStock(params),
    queryFn: () => getMarketWarehouseStock(params),
    enabled,
    ...READ_OPTIONS,
  });

/** Har yozishdan keyin butun ombor keshi (ro'yxat, KPI, qoldiq, jurnal, market qoldig'i) qayta so'raladi. */
const useInvalidateWarehouses = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
};

export const useCreateWarehouse = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: (body: CreateWarehouseRequest) => createWarehouse(body),
    onSuccess: invalidate,
  });
};

export const useUpdateWarehouse = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWarehouseRequest }) => updateWarehouse(id, body),
    onSuccess: invalidate,
  });
};

/** To'xtatish / qayta yoqish (`paused: true` — to'xtatish). */
export const useSetWarehousePaused = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: ({ id, paused, note }: { id: string; paused: boolean; note?: string }) =>
      paused ? pauseWarehouse(id, note) : resumeWarehouse(id, note),
    onSuccess: invalidate,
  });
};

/**
 * Kirim. ⚠️ `retry: 0` — qayta urinish faqat qo'lda va AYNI `Idempotency-Key` bilan (oyna `useIdempotencyKeys`);
 * xato ham, natijasi noma'lum xato ham keshni yangilaydi (server yozgan bo'lishi mumkin).
 */
export const useStockIn = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }: { id: string; body: StockInRequest; idempotencyKey: string }) =>
      stockInWarehouse(id, body, idempotencyKey),
    retry: 0,
    onSettled: invalidate,
  });
};

/** Inventarizatsiya (sabab majburiy). `retry: 0` — kirim bilan bir xil sabab. */
export const useInventory = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }: { id: string; body: InventoryRequest; idempotencyKey: string }) =>
      inventoryWarehouse(id, body, idempotencyKey),
    retry: 0,
    onSettled: invalidate,
  });
};

export const useSetStockThreshold = () => {
  const invalidate = useInvalidateWarehouses();
  return useMutation({
    mutationFn: ({ id, productId, value }: { id: string; productId: string; value: number | null }) =>
      setStockThreshold(id, productId, value),
    onSuccess: invalidate,
  });
};

/**
 * Market «Ombordan buyurtma yaratish» kaliti. Market ma'lumoti (`["user"]`, `["users"]`) va ombor keshi
 * yangilanadi.
 */
export const useSetMarketWarehouseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ marketId, enabled }: { marketId: string; enabled: boolean }) =>
      setMarketWarehouseOrder(marketId, enabled),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
      ]),
  });
};
