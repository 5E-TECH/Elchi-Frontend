/**
 * OMBOR (vaqtinchalik ombor tizimi, Trello yXC91RRx; backend hY7uacJu / 5E-TECH/Elchi-Backend#566).
 *
 * Bu yerdagi turlar — NORMALLASHTIRILGAN (camelCase) ko'rinish: API javobi `api/warehouseApi.ts` da shu shaklga
 * keltiriladi (xom satr son, `null`/yo'q maydon, o'ram). So'rov tanasi turlari (`*Request`) — backend DTO bilan bir
 * xil snake_case.
 *
 * Qoldiq faqat dona: `available = onHand − reserved`; `level`: `ok` — Yetarli, `low` — Kam qoldi (0 < mavjud ≤
 * chegara), `out` — Tugagan (mavjud ≤ 0).
 */

export const WAREHOUSE_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number];

export const STOCK_LEVELS = ["ok", "low", "out"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

/**
 * Harakat turi: IN — Kirim, RESERVE — Band, OUT — Chiqim (kuryerga berildi), RELEASE — band bo'shadi (bekor),
 * RETURN — Qaytdi, ADJUST — Tuzatish (inventarizatsiya), MOVE_* — ko'chirish (hozir yo'q).
 */
export const MOVEMENT_TYPES = ["IN", "RESERVE", "OUT", "RELEASE", "RETURN", "ADJUST", "MOVE_OUT", "MOVE_IN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type MovementRefType = "stock_in" | "inventory" | "order" | "move";

/** Ekrandagi kod turi: `barcode` — zavod shtrix kodi; `sku` — Elchi QR kodi (`ELC-P-…`). */
export type ProductCodeKind = "barcode" | "sku";
export type ProductCodeFormat = "ELC" | "EAN-13" | "EAN-8" | "GTIN-14" | "TEXT";

export type ProductCode = { value: string | null; kind: ProductCodeKind; format: ProductCodeFormat };

export type WarehouseRef = { id: string; name: string };
export type MarketRef = { id: string; name: string | null };

export type WarehouseShort = { id: string; name: string; status: WarehouseStatus };

export type WarehouseBranch = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  address: string | null;
};

export type WarehouseManager = { id: string; name: string | null; phone: string | null };

export type WarehouseSummary = {
  /** Pozitsiyalar (mahsulot turlari). */
  positions: number;
  /** Mahsulotlari bor marketlar. */
  markets: number;
  onHand: number;
  reserved: number;
  available: number;
  /** Band qilingan (kuryerga berilmagan) faol buyurtmalar. */
  reservedOrders: number;
  lowCount: number;
  outCount: number;
};

export type WarehouseLastMovement = {
  id: string;
  type: MovementType;
  qty: number;
  refType: MovementRefType | null;
  refId: string | null;
  createdAt: string;
};

export type Warehouse = {
  id: string;
  name: string;
  status: WarehouseStatus;
  branchId: string;
  branch: WarehouseBranch | null;
  /** Viloyat (logistika hududi). */
  region: WarehouseRef | null;
  managerUserId: string | null;
  manager: WarehouseManager | null;
  address: string | null;
  /** `address ?? filial manzili`. */
  effectiveAddress: string | null;
  lowStockDefault: number;
  note: string | null;
  pausedAt: string | null;
  /** «Ochilgan». */
  createdAt: string | null;
  updatedAt: string | null;
  summary: WarehouseSummary;
  lastMovement: WarehouseLastMovement | null;
  /** «Harakatlar» tab soni (faqat `GET /warehouses/:id`). */
  movementsCount: number | null;
};

export type WarehouseCounts = { all: number; active: number; paused: number };

export type WarehouseListSummary = {
  warehouses: number;
  active: number;
  paused: number;
  positions: number;
  onHand: number;
  reserved: number;
  available: number;
  reservedOrders: number;
  lowCount: number;
  outCount: number;
};

export type WarehouseListData = {
  items: Warehouse[];
  total: number;
  page: number;
  limit: number;
  /** Viloyat / qidiruv filtridan keyin holat bo'yicha. */
  counts: WarehouseCounts;
  /** Ko'rinadigan HAMMA omborlar (filtrsiz). */
  summary: WarehouseListSummary;
};

export type ChargeableBasis = "actual" | "volumetric";

export type WarehouseProduct = {
  id: string;
  name: string;
  marketId: string;
  skuCode: string | null;
  barcode: string | null;
  imageUrl: string | null;
  isDeleted: boolean;
  /** Ekrandagi kod: zavod kodi bo'lsa o'sha, aks holda `ELC-P`. */
  code: ProductCode;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  volumetricEnabled: boolean;
  /** «Hisob vazni» = max(og'irlik, U×K×B/5000), kg. */
  chargeableWeightKg: number | null;
  volumetricWeightKg: number | null;
  chargeableBasis: ChargeableBasis | null;
  /** Og'irlik yo'q — «O'lchov yo'q — yetkazish narxi hisoblanmaydi». */
  measureMissing: boolean;
};

export type WarehouseStockRow = {
  stockId: string;
  product: WarehouseProduct;
  market: MarketRef;
  onHand: number;
  reserved: number;
  available: number;
  /** Mahsulotning o'z chegarasi (`null` — ombor sukuti). */
  lowStockThreshold: number | null;
  /** Amaldagi chegara. */
  threshold: number;
  level: StockLevel;
  lastMovementAt: string | null;
};

export type StockLevelFacet = { all: number; ok: number; low: number; out: number };
export type StockMarketFacet = { id: string; name: string | null; positions: number };

export type WarehouseStockData = {
  warehouse: WarehouseShort | null;
  items: WarehouseStockRow[];
  total: number;
  page: number;
  limit: number;
  facets: { levels: StockLevelFacet; markets: StockMarketFacet[] };
};

export type WarehouseActor = { id: string | null; name: string | null; role: string | null };

export type WarehouseMovement = {
  id: string;
  type: MovementType;
  /** Ishorali: IN/RETURN +, OUT −, ADJUST ±, RESERVE + (band), RELEASE − (band). */
  qty: number;
  onHandAfter: number;
  reservedAfter: number;
  refType: MovementRefType | null;
  refId: string | null;
  /** «Buyurtma №…». */
  orderId: string | null;
  /** Kirim izohi / inventarizatsiya sababi. */
  note: string | null;
  createdAt: string;
  product: { id: string; name: string; skuCode: string | null; barcode: string | null };
  market: MarketRef;
  actor: WarehouseActor | null;
};

export type WarehouseMovementData = {
  warehouse: WarehouseShort | null;
  items: WarehouseMovement[];
  total: number;
  page: number;
  limit: number;
};

export type LookupStock = {
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  level: StockLevel;
};

export type WarehouseLookupItem = {
  product: WarehouseProduct;
  market: MarketRef;
  /** `null` — omborda hali yo'q («0 · yangi»). */
  stock: LookupStock | null;
};

export type WarehouseLookup = {
  warehouse: WarehouseShort | null;
  code: string;
  matchedBy: "sku_code" | "barcode" | null;
  /** Bo'sh — topilmadi (zavod kodi bo'lsa «Mahsulotga bog'lash»). */
  items: WarehouseLookupItem[];
};

export type StockInResultLine = {
  productId: string;
  productName: string;
  marketId: string;
  qty: number;
  onHand: number;
  reserved: number;
  available: number;
};

export type StockInResult = {
  warehouseId: string;
  warehouseName: string;
  /** Shu `Idempotency-Key` bilan avval bajarilgan — qoldiq qayta o'zgarmadi. */
  replayed: boolean;
  positions: number;
  totalQty: number;
  lines: StockInResultLine[];
};

export type InventoryResultLine = {
  productId: string;
  productName: string;
  counted: number;
  before: number;
  after: number;
  delta: number;
};

export type InventoryResult = {
  replayed: boolean;
  reason: string;
  changed: number;
  unchanged: number;
  lines: InventoryResultLine[];
};

export type ThresholdResult = {
  productId: string;
  lowStockThreshold: number | null;
  effectiveThreshold: number;
};

export type MarketStockWarehouse = {
  id: string;
  name: string;
  status: WarehouseStatus;
  branch: WarehouseRef | null;
  region: WarehouseRef | null;
};

export type MarketStockCell = {
  warehouseId: string;
  warehouseStatus: WarehouseStatus;
  onHand: number;
  reserved: number;
  /** Katakdagi raqam (sotish uchun mavjud). */
  available: number;
  threshold: number;
  level: StockLevel;
};

export type MarketStockRow = {
  product: WarehouseProduct;
  /** Faqat qatori bor omborlar; yo'q — «—». */
  cells: MarketStockCell[];
  /** «Jami» — faqat FAOL omborlar mavjud donasi. */
  totalAvailable: number;
  totalOnHand: number;
  hasLow: boolean;
};

export type MarketStockSummary = {
  productsTotal: number;
  productsInWarehouses: number;
  totalAvailable: number;
  warehousesTotal: number;
  warehousesActive: number;
  warehousesPaused: number;
  activeWarehousesWithStock: number;
  lowPositions: number;
  outPositions: number;
};

export type MarketStockData = {
  marketId: string;
  warehouses: MarketStockWarehouse[];
  items: MarketStockRow[];
  total: number;
  page: number;
  limit: number;
  summary: MarketStockSummary;
};

// ── So'rov parametrlari va tanalari (backend DTO — snake_case) ─────────────────────────────

export type WarehouseListParams = {
  status?: WarehouseStatus;
  region_id?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type WarehouseStockParams = {
  market_id?: string;
  /** `ok`, `low`, `out` (vergul bilan). */
  level?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type WarehouseMovementParams = {
  /** `IN,ADJUST,…` (vergul bilan). */
  type?: string;
  product_id?: string;
  market_id?: string;
  ref_type?: MovementRefType;
  ref_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type MarketStockParams = {
  /** SUPERADMIN/ADMIN uchun majburiy; market — o'zi (yuborilmaydi). */
  market_id?: string;
  search?: string;
  low_only?: boolean;
  page?: number;
  limit?: number;
};

export type CreateWarehouseRequest = {
  branch_id: string;
  name?: string;
  manager_user_id?: string | null;
  address?: string | null;
  low_stock_default?: number;
  note?: string | null;
};

export type UpdateWarehouseRequest = {
  name?: string;
  manager_user_id?: string | null;
  address?: string | null;
  low_stock_default?: number;
  note?: string | null;
};

export type StockInLineRequest = { product_id?: string; code?: string; qty: number };

export type StockInRequest = {
  lines: StockInLineRequest[];
  market_id?: string;
  note?: string;
};

export type InventoryLineRequest = { product_id?: string; code?: string; counted: number };

export type InventoryRequest = {
  lines: InventoryLineRequest[];
  /** Tuzatish sababi — MAJBURIY (3–1000 belgi). */
  reason: string;
  market_id?: string;
};

// ── Buyurtma manbasi (6kHnNH9j, `POST /warehouses/resolve-source`) ────────────────────────────

/** Buyurtma qayerdan ketadi: `HQ` — odatiy oqim (HQ qabuli, pochta), `WAREHOUSE` — viloyat filiali omboridan. */
export type FulfillmentSource = "HQ" | "WAREHOUSE";

/**
 * Manba sababi (backend `WAREHOUSE_SOURCE_REASONS`): `OK` — ombor; qolgani — HQ: `NO_ITEMS`, `NO_REGION` (tuman hududi
 * aniqlanmadi), `NO_WAREHOUSE` (hududda ombor yo'q), `WAREHOUSE_PAUSED`, `INSUFFICIENT_STOCK` (yetmaydi — butun
 * buyurtma HQ'dan), `MARKET_NOT_ALLOWED` (market kaliti o'chiq), `PRODUCT_INVALID`.
 */
export const SOURCE_REASONS = [
  "OK",
  "NO_ITEMS",
  "NO_REGION",
  "NO_WAREHOUSE",
  "WAREHOUSE_PAUSED",
  "INSUFFICIENT_STOCK",
  "MARKET_NOT_ALLOWED",
  "PRODUCT_INVALID",
] as const;
export type SourceReason = (typeof SOURCE_REASONS)[number];

export type SourceWarehouse = {
  id: string;
  name: string;
  status: WarehouseStatus;
  branchId: string;
  branchName: string | null;
  regionId: string | null;
  regionName: string | null;
};

export type SourceLine = {
  productId: string;
  name: string | null;
  /** Kerak (buyurtmadagi soni). */
  required: number;
  /** Omborda mavjud («Omborda: N»). */
  available: number;
  enough: boolean;
};

export type OrderSourcePreview = {
  source: FulfillmentSource;
  reason: SourceReason;
  regionId: string | null;
  /** Hudud ombori (`WAREHOUSE_PAUSED` da ham — to'xtatilgan ombor); yo'q — `null`. */
  warehouse: SourceWarehouse | null;
  /** Har mahsulot bo'yicha (ombor tekshirilgan bo'lsa). */
  items: SourceLine[];
  /** Yetmayotganlar (`INSUFFICIENT_STOCK`). */
  shortages: SourceLine[];
};

export type ResolveSourceRequest = {
  district_id?: string;
  region_id?: string;
  /** Xodim — buyurtma marketi; market tomoni — e'tiborsiz (token). */
  market_id?: string;
  items: { product_id: string; quantity: number }[];
};
