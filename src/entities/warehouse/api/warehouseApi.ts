import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { getFileNameFromDisposition, saveBlob, XLSX_MIME } from "../../../shared/lib/exportFile";
import {
  MOVEMENT_TYPES,
  type ChargeableBasis,
  type CreateWarehouseRequest,
  type InventoryRequest,
  type InventoryResult,
  type LookupStock,
  type MarketRef,
  type MarketStockCell,
  type MarketStockData,
  type MarketStockParams,
  type MarketStockRow,
  type MarketStockWarehouse,
  type MovementRefType,
  type MovementType,
  type OrderSourcePreview,
  type ProductCode,
  type ProductCodeFormat,
  type ResolveSourceRequest,
  SOURCE_REASONS,
  type SourceLine,
  type SourceReason,
  type SourceWarehouse,
  type StockInRequest,
  type StockInResult,
  type StockLevel,
  type ThresholdResult,
  type UpdateWarehouseRequest,
  type Warehouse,
  type WarehouseListData,
  type WarehouseListParams,
  type WarehouseLookup,
  type WarehouseMovement,
  type WarehouseMovementData,
  type WarehouseMovementParams,
  type WarehouseProduct,
  type WarehouseRef,
  type WarehouseShort,
  type WarehouseStatus,
  type WarehouseStockData,
  type WarehouseStockParams,
  type WarehouseStockRow,
} from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Son (xom `numeric` satr ham) yoki `null`. */
const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const numberOf = (value: unknown, fallback = 0): number => numberOrNull(value) ?? fallback;

/** Bo'sh bo'lmagan satr (sana obyekti — ISO) yoki `null`. */
const textOrNull = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
};

const idOf = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

/**
 * Javob tanasi: backend o'ramsiz JSON qaytaradi (`{ data: [...], total, … }` yoki obyektning o'zi); eski / boshqa
 * gateway o'rami (`{ statusCode, data: { … } }`) ham o'qiladi — `data` obyekt bo'lsa, ichkarisi olinadi.
 */
const payloadOf = (value: unknown): Raw | null => {
  const root = asRecord(value);
  if (!root) return null;
  return asRecord(root.data) ?? root;
};

const toStatus = (value: unknown): WarehouseStatus => (String(value ?? "").toUpperCase() === "PAUSED" ? "PAUSED" : "ACTIVE");

const toLevel = (value: unknown): StockLevel => {
  const level = String(value ?? "").toLowerCase();
  return level === "low" || level === "out" ? level : "ok";
};

const toMovementType = (value: unknown): MovementType | null => {
  const type = String(value ?? "").toUpperCase();
  return (MOVEMENT_TYPES as readonly string[]).includes(type) ? (type as MovementType) : null;
};

const toRefType = (value: unknown): MovementRefType | null =>
  value === "stock_in" || value === "inventory" || value === "order" || value === "move" ? value : null;

const toRef = (value: unknown): WarehouseRef | null => {
  const record = asRecord(value);
  const id = idOf(record?.id);
  if (!record || !id) return null;
  return { id, name: textOrNull(record.name) ?? "" };
};

const toMarketRef = (value: unknown, fallbackId?: unknown): MarketRef => {
  const record = asRecord(value);
  return { id: idOf(record?.id) ?? idOf(fallbackId) ?? "", name: textOrNull(record?.name) };
};

const toShort = (value: unknown): WarehouseShort | null => {
  const record = asRecord(value);
  const id = idOf(record?.id);
  if (!record || !id) return null;
  return { id, name: textOrNull(record.name) ?? "", status: toStatus(record.status) };
};

const CODE_FORMATS: readonly ProductCodeFormat[] = ["ELC", "EAN-13", "EAN-8", "GTIN-14", "TEXT"];

/** Ekrandagi kod: backend `code` bo'lmasa — zavod kodi, so'ng `ELC-P`. */
const toCode = (value: unknown, barcode: string | null, skuCode: string | null): ProductCode => {
  const record = asRecord(value);
  const rawFormat = String(record?.format ?? "").toUpperCase();
  const format = (CODE_FORMATS as readonly string[]).includes(rawFormat) ? (rawFormat as ProductCodeFormat) : null;
  const kind = record?.kind === "barcode" || record?.kind === "sku" ? record.kind : barcode ? "barcode" : "sku";
  const codeValue = textOrNull(record?.value) ?? (kind === "barcode" ? barcode : skuCode);
  return {
    value: codeValue,
    kind,
    format: format ?? (kind === "sku" ? "ELC" : codeValue && /^\d{13}$/.test(codeValue) ? "EAN-13" : "TEXT"),
  };
};

/** Mahsulot (`WarehouseProductDto`, harakatda — qisqa shakli ham). */
export const normalizeWarehouseProduct = (value: unknown): WarehouseProduct => {
  const record = asRecord(value) ?? {};
  const barcode = textOrNull(record.barcode);
  const skuCode = textOrNull(record.sku_code);
  const basis = record.chargeable_basis;
  return {
    id: idOf(record.id) ?? "",
    name: textOrNull(record.name) ?? "",
    marketId: idOf(record.market_id) ?? "",
    skuCode,
    barcode,
    imageUrl: textOrNull(record.image_url),
    isDeleted: record.is_deleted === true,
    code: toCode(record.code, barcode, skuCode),
    weightKg: numberOrNull(record.weight_kg),
    lengthCm: numberOrNull(record.length_cm),
    widthCm: numberOrNull(record.width_cm),
    heightCm: numberOrNull(record.height_cm),
    volumetricEnabled: record.volumetric_enabled !== false,
    chargeableWeightKg: numberOrNull(record.chargeable_weight_kg),
    volumetricWeightKg: numberOrNull(record.volumetric_weight_kg),
    chargeableBasis: basis === "actual" || basis === "volumetric" ? (basis as ChargeableBasis) : null,
    measureMissing:
      typeof record.measure_missing === "boolean" ? record.measure_missing : numberOrNull(record.weight_kg) === null,
  };
};

const toSummary = (value: unknown) => {
  const record = asRecord(value) ?? {};
  return {
    positions: numberOf(record.positions),
    markets: numberOf(record.markets),
    onHand: numberOf(record.on_hand),
    reserved: numberOf(record.reserved),
    available: numberOf(record.available),
    reservedOrders: numberOf(record.reserved_orders),
    lowCount: numberOf(record.low_count),
    outCount: numberOf(record.out_count),
  };
};

/** Bitta ombor (`WarehouseDto` / `WarehouseDetailDto`); `id` yo'q — `null`. */
export const normalizeWarehouse = (value: unknown): Warehouse | null => {
  const record = asRecord(value);
  const id = idOf(record?.id);
  if (!record || !id) return null;
  const branchRecord = asRecord(record.branch);
  const branchId = idOf(record.branch_id) ?? idOf(branchRecord?.id) ?? "";
  const managerRecord = asRecord(record.manager);
  const managerId = idOf(managerRecord?.id);
  const lastRecord = asRecord(record.last_movement);
  const lastType = toMovementType(lastRecord?.type);
  const lastCreatedAt = textOrNull(lastRecord?.created_at);
  return {
    id,
    name: textOrNull(record.name) ?? "",
    status: toStatus(record.status),
    branchId,
    branch: branchRecord
      ? {
          id: idOf(branchRecord.id) ?? branchId,
          name: textOrNull(branchRecord.name) ?? "",
          type: textOrNull(branchRecord.type),
          status: textOrNull(branchRecord.status),
          address: textOrNull(branchRecord.address),
        }
      : null,
    region: toRef(record.region),
    managerUserId: idOf(record.manager_user_id) ?? managerId,
    manager: managerId
      ? {
          id: managerId,
          name: textOrNull(managerRecord?.name),
          phone: textOrNull(managerRecord?.phone_number),
        }
      : null,
    address: textOrNull(record.address),
    effectiveAddress: textOrNull(record.effective_address) ?? textOrNull(record.address),
    lowStockDefault: numberOf(record.low_stock_default, 5),
    note: textOrNull(record.note),
    pausedAt: textOrNull(record.paused_at),
    createdAt: textOrNull(record.created_at),
    updatedAt: textOrNull(record.updated_at),
    summary: toSummary(record.summary),
    lastMovement:
      lastRecord && lastType && lastCreatedAt
        ? {
            id: idOf(lastRecord.id) ?? "",
            type: lastType,
            qty: numberOf(lastRecord.qty),
            refType: toRefType(lastRecord.ref_type),
            refId: idOf(lastRecord.ref_id),
            createdAt: lastCreatedAt,
          }
        : null,
    movementsCount: numberOrNull(record.movements_count),
  };
};

/** `GET /warehouses` → ro'yxat + holat sonlari + umumiy KPI. */
export const normalizeWarehouseList = (value: unknown): WarehouseListData => {
  const payload = payloadOf(value) ?? {};
  const items = listOf(payload.data).flatMap((raw) => {
    const warehouse = normalizeWarehouse(raw);
    return warehouse ? [warehouse] : [];
  });
  const counts = asRecord(payload.counts) ?? {};
  const summary = asRecord(payload.summary) ?? {};
  return {
    items,
    total: numberOf(payload.total, items.length),
    page: numberOf(payload.page, 1),
    limit: numberOf(payload.limit, items.length),
    counts: {
      all: numberOf(counts.all, items.length),
      active: numberOf(counts.active),
      paused: numberOf(counts.paused),
    },
    summary: {
      warehouses: numberOf(summary.warehouses),
      active: numberOf(summary.active),
      paused: numberOf(summary.paused),
      positions: numberOf(summary.positions),
      onHand: numberOf(summary.on_hand),
      reserved: numberOf(summary.reserved),
      available: numberOf(summary.available),
      reservedOrders: numberOf(summary.reserved_orders),
      lowCount: numberOf(summary.low_count),
      outCount: numberOf(summary.out_count),
    },
  };
};

const toStockRow = (value: unknown): WarehouseStockRow | null => {
  const record = asRecord(value);
  if (!record) return null;
  const product = normalizeWarehouseProduct(record.product);
  if (!product.id) return null;
  return {
    stockId: idOf(record.stock_id) ?? product.id,
    product,
    market: toMarketRef(record.market, product.marketId),
    onHand: numberOf(record.on_hand),
    reserved: numberOf(record.reserved),
    available: numberOf(record.available),
    lowStockThreshold: numberOrNull(record.low_stock_threshold),
    threshold: numberOf(record.threshold),
    level: toLevel(record.level),
    lastMovementAt: textOrNull(record.last_movement_at),
  };
};

/** `GET /warehouses/:id/stock` → qatorlar + «Holat» va «Market» filtrlari sonlari. */
export const normalizeWarehouseStock = (value: unknown): WarehouseStockData => {
  const payload = payloadOf(value) ?? {};
  const items = listOf(payload.data).flatMap((raw) => {
    const row = toStockRow(raw);
    return row ? [row] : [];
  });
  const facets = asRecord(payload.facets) ?? {};
  const levels = asRecord(facets.levels) ?? {};
  return {
    warehouse: toShort(payload.warehouse),
    items,
    total: numberOf(payload.total, items.length),
    page: numberOf(payload.page, 1),
    limit: numberOf(payload.limit, items.length),
    facets: {
      levels: {
        all: numberOf(levels.all, items.length),
        ok: numberOf(levels.ok),
        low: numberOf(levels.low),
        out: numberOf(levels.out),
      },
      markets: listOf(facets.markets).flatMap((raw) => {
        const market = asRecord(raw);
        const id = idOf(market?.id);
        return market && id ? [{ id, name: textOrNull(market.name), positions: numberOf(market.positions) }] : [];
      }),
    },
  };
};

const toMovement = (value: unknown): WarehouseMovement | null => {
  const record = asRecord(value);
  const type = toMovementType(record?.type);
  const createdAt = textOrNull(record?.created_at);
  if (!record || !type || !createdAt) return null;
  const product = asRecord(record.product) ?? {};
  const actor = asRecord(record.actor);
  return {
    id: idOf(record.id) ?? createdAt,
    type,
    qty: numberOf(record.qty),
    onHandAfter: numberOf(record.on_hand_after),
    reservedAfter: numberOf(record.reserved_after),
    refType: toRefType(record.ref_type),
    refId: idOf(record.ref_id),
    orderId: idOf(record.order_id) ?? (record.ref_type === "order" ? idOf(record.ref_id) : null),
    note: textOrNull(record.note),
    createdAt,
    product: {
      id: idOf(product.id) ?? "",
      name: textOrNull(product.name) ?? "",
      skuCode: textOrNull(product.sku_code),
      barcode: textOrNull(product.barcode),
    },
    market: toMarketRef(record.market),
    actor: actor
      ? { id: idOf(actor.id), name: textOrNull(actor.name), role: textOrNull(actor.role) }
      : null,
  };
};

/** `GET /warehouses/:id/movements` — eng yangisi tepada. */
export const normalizeWarehouseMovements = (value: unknown): WarehouseMovementData => {
  const payload = payloadOf(value) ?? {};
  const items = listOf(payload.data).flatMap((raw) => {
    const movement = toMovement(raw);
    return movement ? [movement] : [];
  });
  return {
    warehouse: toShort(payload.warehouse),
    items,
    total: numberOf(payload.total, items.length),
    page: numberOf(payload.page, 1),
    limit: numberOf(payload.limit, items.length),
  };
};

const toLookupStock = (value: unknown): LookupStock | null => {
  const record = asRecord(value);
  if (!record) return null;
  return {
    onHand: numberOf(record.on_hand),
    reserved: numberOf(record.reserved),
    available: numberOf(record.available),
    threshold: numberOf(record.threshold),
    level: toLevel(record.level),
  };
};

/** `GET /warehouses/:id/lookup` — topilmasa `items: []` (404 emas). */
export const normalizeWarehouseLookup = (value: unknown, code = ""): WarehouseLookup => {
  const payload = payloadOf(value) ?? {};
  const matchedBy = payload.matched_by === "sku_code" || payload.matched_by === "barcode" ? payload.matched_by : null;
  return {
    warehouse: toShort(payload.warehouse),
    code: textOrNull(payload.code) ?? code,
    matchedBy,
    items: listOf(payload.data).flatMap((raw) => {
      const record = asRecord(raw);
      if (!record) return [];
      const product = normalizeWarehouseProduct(record.product);
      if (!product.id) return [];
      return [{ product, market: toMarketRef(record.market, product.marketId), stock: toLookupStock(record.stock) }];
    }),
  };
};

/** `POST /warehouses/:id/stock-in` natijasi. */
export const normalizeStockInResult = (value: unknown): StockInResult => {
  const payload = payloadOf(value) ?? {};
  const lines = listOf(payload.lines).flatMap((raw) => {
    const line = asRecord(raw);
    const productId = idOf(line?.product_id);
    if (!line || !productId) return [];
    return [
      {
        productId,
        productName: textOrNull(line.product_name) ?? "",
        marketId: idOf(line.market_id) ?? "",
        qty: numberOf(line.qty),
        onHand: numberOf(line.on_hand),
        reserved: numberOf(line.reserved),
        available: numberOf(line.available),
      },
    ];
  });
  return {
    warehouseId: idOf(payload.warehouse_id) ?? "",
    warehouseName: textOrNull(payload.warehouse_name) ?? "",
    replayed: payload.replayed === true,
    positions: numberOf(payload.positions, lines.length),
    totalQty: numberOf(payload.total_qty, lines.reduce((sum, line) => sum + line.qty, 0)),
    lines,
  };
};

/** `POST /warehouses/:id/inventory` natijasi. */
export const normalizeInventoryResult = (value: unknown): InventoryResult => {
  const payload = payloadOf(value) ?? {};
  const lines = listOf(payload.lines).flatMap((raw) => {
    const line = asRecord(raw);
    const productId = idOf(line?.product_id);
    if (!line || !productId) return [];
    return [
      {
        productId,
        productName: textOrNull(line.product_name) ?? "",
        counted: numberOf(line.counted),
        before: numberOf(line.before),
        after: numberOf(line.after),
        delta: numberOf(line.delta),
      },
    ];
  });
  return {
    replayed: payload.replayed === true,
    reason: textOrNull(payload.reason) ?? "",
    changed: numberOf(payload.changed, lines.filter((line) => line.delta !== 0).length),
    unchanged: numberOf(payload.unchanged, lines.filter((line) => line.delta === 0).length),
    lines,
  };
};

const toMarketStockCell = (value: unknown): MarketStockCell | null => {
  const record = asRecord(value);
  const warehouseId = idOf(record?.warehouse_id);
  if (!record || !warehouseId) return null;
  return {
    warehouseId,
    warehouseStatus: toStatus(record.warehouse_status),
    onHand: numberOf(record.on_hand),
    reserved: numberOf(record.reserved),
    available: numberOf(record.available),
    threshold: numberOf(record.threshold),
    level: toLevel(record.level),
  };
};

/** `GET /market/warehouse-stock` — ustunlar (hamma omborlar) + mahsulot qatorlari. */
export const normalizeMarketStock = (value: unknown): MarketStockData => {
  const payload = payloadOf(value) ?? {};
  const warehouses = listOf(payload.warehouses).flatMap((raw): MarketStockWarehouse[] => {
    const record = asRecord(raw);
    const id = idOf(record?.id);
    if (!record || !id) return [];
    return [
      {
        id,
        name: textOrNull(record.name) ?? "",
        status: toStatus(record.status),
        branch: toRef(record.branch),
        region: toRef(record.region),
      },
    ];
  });
  const items = listOf(payload.data).flatMap((raw): MarketStockRow[] => {
    const record = asRecord(raw);
    if (!record) return [];
    const product = normalizeWarehouseProduct(record.product);
    if (!product.id) return [];
    return [
      {
        product,
        cells: listOf(record.cells).flatMap((cell) => {
          const normalized = toMarketStockCell(cell);
          return normalized ? [normalized] : [];
        }),
        totalAvailable: numberOf(record.total_available),
        totalOnHand: numberOf(record.total_on_hand),
        hasLow: record.has_low === true,
      },
    ];
  });
  const summary = asRecord(payload.summary) ?? {};
  return {
    marketId: idOf(payload.market_id) ?? "",
    warehouses,
    items,
    total: numberOf(payload.total, items.length),
    page: numberOf(payload.page, 1),
    limit: numberOf(payload.limit, items.length),
    summary: {
      productsTotal: numberOf(summary.products_total),
      productsInWarehouses: numberOf(summary.products_in_warehouses),
      totalAvailable: numberOf(summary.total_available),
      warehousesTotal: numberOf(summary.warehouses_total, warehouses.length),
      warehousesActive: numberOf(summary.warehouses_active),
      warehousesPaused: numberOf(summary.warehouses_paused),
      activeWarehousesWithStock: numberOf(summary.active_warehouses_with_stock),
      lowPositions: numberOf(summary.low_positions),
      outPositions: numberOf(summary.out_positions),
    },
  };
};

/** Bo'sh (`""`, `undefined`) parametrlar so'rovga kirmaydi. */
const compactParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as Partial<T>;

const idempotencyHeaders = (key: string) => ({ headers: { "Idempotency-Key": key } });

// ── So'rovlar ─────────────────────────────────────────────────────────────────────────────────

export const getWarehouses = async (params: WarehouseListParams = {}): Promise<WarehouseListData> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.BASE, { params: compactParams(params) });
  return normalizeWarehouseList(response.data);
};

export const getWarehouse = async (id: string): Promise<Warehouse | null> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.BY_ID(id));
  return normalizeWarehouse(payloadOf(response.data));
};

export const createWarehouse = async (body: CreateWarehouseRequest): Promise<Warehouse | null> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.BASE, body);
  return normalizeWarehouse(payloadOf(response.data));
};

export const updateWarehouse = async (id: string, body: UpdateWarehouseRequest): Promise<Warehouse | null> => {
  const response = await api.patch(API_ENDPOINTS.WAREHOUSES.BY_ID(id), body);
  return normalizeWarehouse(payloadOf(response.data));
};

/** `POST /warehouses/:id/pause` — qoldiq saqlanadi, yangi buyurtma tushmaydi. */
export const pauseWarehouse = async (id: string, note?: string): Promise<Warehouse | null> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.PAUSE(id), note ? { note } : {});
  return normalizeWarehouse(payloadOf(response.data));
};

export const resumeWarehouse = async (id: string, note?: string): Promise<Warehouse | null> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.RESUME(id), note ? { note } : {});
  return normalizeWarehouse(payloadOf(response.data));
};

export const getWarehouseStock = async (id: string, params: WarehouseStockParams = {}): Promise<WarehouseStockData> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.STOCK(id), { params: compactParams(params) });
  return normalizeWarehouseStock(response.data);
};

export const getWarehouseMovements = async (
  id: string,
  params: WarehouseMovementParams = {},
): Promise<WarehouseMovementData> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.MOVEMENTS(id), { params: compactParams(params) });
  return normalizeWarehouseMovements(response.data);
};

/** Skaner: `ELC-P-…` yoki zavod kodi → mahsulot + shu ombordagi qoldiq. */
export const lookupWarehouseCode = async (id: string, code: string, marketId?: string): Promise<WarehouseLookup> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.LOOKUP(id), {
    params: compactParams({ code, market_id: marketId }),
  });
  return normalizeWarehouseLookup(response.data, code);
};

/** Kirim — `Idempotency-Key` majburiy (qayta urinishda AYNI kalit). */
export const stockInWarehouse = async (id: string, body: StockInRequest, idempotencyKey: string): Promise<StockInResult> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.STOCK_IN(id), body, idempotencyHeaders(idempotencyKey));
  return normalizeStockInResult(response.data);
};

/** Inventarizatsiya — `Idempotency-Key` majburiy, sabab majburiy. */
export const inventoryWarehouse = async (
  id: string,
  body: InventoryRequest,
  idempotencyKey: string,
): Promise<InventoryResult> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.INVENTORY(id), body, idempotencyHeaders(idempotencyKey));
  return normalizeInventoryResult(response.data);
};

/** «Kam qoldiq» chegarasi (mahsulot bo'yicha); `null` — ombor sukuti. */
export const setStockThreshold = async (
  id: string,
  productId: string,
  lowStockThreshold: number | null,
): Promise<ThresholdResult> => {
  const response = await api.patch(API_ENDPOINTS.WAREHOUSES.STOCK_THRESHOLD(id, productId), {
    low_stock_threshold: lowStockThreshold,
  });
  const payload = payloadOf(response.data) ?? {};
  return {
    productId: idOf(payload.product_id) ?? productId,
    lowStockThreshold: numberOrNull(payload.low_stock_threshold),
    effectiveThreshold: numberOf(payload.effective_threshold),
  };
};

/**
 * «Excelga yuklash» — `.xlsx` (filtrlar qoldiq jadvali bilan bir xil, sahifasiz). Fayl nomi — `Content-Disposition`
 * dan, bo'lmasa `fallbackName`.
 */
export const exportWarehouseStock = async (
  id: string,
  params: Pick<WarehouseStockParams, "market_id" | "level" | "search">,
  fallbackName: string,
): Promise<void> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.EXPORT(id), {
    params: compactParams(params),
    responseType: "blob",
    timeout: LONG_REQUEST_TIMEOUT_MS,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: XLSX_MIME });
  const headers = (response.headers ?? {}) as Record<string, unknown>;
  saveBlob(blob, getFileNameFromDisposition(headers["content-disposition"]) ?? fallbackName);
};

export const getMarketWarehouseStock = async (params: MarketStockParams = {}): Promise<MarketStockData> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.MARKET_STOCK, {
    params: compactParams({ ...params, low_only: params.low_only ? true : undefined }),
  });
  return normalizeMarketStock(response.data);
};

/** Market «Ombordan buyurtma yaratish» kaliti (SUPERADMIN, ADMIN). */
export const setMarketWarehouseOrder = async (marketId: string, enabled: boolean): Promise<boolean> => {
  const response = await api.patch(API_ENDPOINTS.WAREHOUSES.MARKET_WAREHOUSE_ORDER(marketId), {
    can_order_from_warehouse: enabled,
  });
  const payload = payloadOf(response.data);
  return typeof payload?.can_order_from_warehouse === "boolean" ? payload.can_order_from_warehouse : enabled;
};

// ── Buyurtma manbasi (6kHnNH9j) ───────────────────────────────────────────────────────────────

const toSourceWarehouse = (value: unknown): SourceWarehouse | null => {
  const record = asRecord(value);
  const id = idOf(record?.id);
  if (!record || !id) return null;
  return {
    id,
    name: textOrNull(record.name) ?? "",
    status: toStatus(record.status),
    branchId: idOf(record.branch_id) ?? "",
    branchName: textOrNull(record.branch_name),
    regionId: idOf(record.region_id),
    regionName: textOrNull(record.region_name),
  };
};

const toSourceLines = (value: unknown, enoughFallback: boolean): SourceLine[] =>
  listOf(value).flatMap((raw): SourceLine[] => {
    const record = asRecord(raw);
    const productId = idOf(record?.product_id);
    if (!record || !productId) return [];
    const required = numberOf(record.required);
    const available = numberOf(record.available);
    return [
      {
        productId,
        name: textOrNull(record.name),
        required,
        available,
        enough: typeof record.enough === "boolean" ? record.enough : enoughFallback && available >= required,
      },
    ];
  });

/**
 * `POST /warehouses/resolve-source` javobi. Noma'lum `source` — `HQ` (xavfsiz tomoni: omborga band qilinmaydi);
 * noma'lum sabab — `WAREHOUSE` bo'lsa `OK`, aks holda `NO_WAREHOUSE`.
 */
export const normalizeOrderSource = (value: unknown): OrderSourcePreview => {
  const payload = payloadOf(value) ?? {};
  const source = String(payload.source ?? "").toUpperCase() === "WAREHOUSE" ? "WAREHOUSE" : "HQ";
  const rawReason = String(payload.reason ?? "").toUpperCase();
  const reason: SourceReason = (SOURCE_REASONS as readonly string[]).includes(rawReason)
    ? (rawReason as SourceReason)
    : source === "WAREHOUSE"
      ? "OK"
      : "NO_WAREHOUSE";
  return {
    source,
    reason,
    regionId: idOf(payload.region_id),
    warehouse: toSourceWarehouse(payload.warehouse),
    items: toSourceLines(payload.items, true),
    shortages: toSourceLines(payload.shortages, false).map((line) => ({ ...line, enough: false })),
  };
};

/** Manba oldindan ko'rinishi — faqat hisoblaydi, hech narsa band qilinmaydi (band — `POST /orders` da). */
export const resolveOrderSource = async (body: ResolveSourceRequest): Promise<OrderSourcePreview> => {
  const response = await api.post(API_ENDPOINTS.WAREHOUSES.RESOLVE_SOURCE, body);
  return normalizeOrderSource(response.data);
};
