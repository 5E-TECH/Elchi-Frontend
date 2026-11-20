/** Operator komissiyasi turi (backend `Commission_type`): foiz — sotilgan buyurtma narxidan, qat'iy — har sotuvga so'm. */
export type CommissionType = "percent" | "fixed";

/** Operator holati (backend `Status`). Nofaol operator tizimga kira olmaydi. */
export type MarketOperatorStatus = "active" | "inactive";

/**
 * Market operatori — `GET /market-operators` qatori (identity `toMarketOperatorView`): parol, maosh va UI
 * sozlamalarisiz. Komissiya yo'q (`commission_type` yoki `commission_value` — `null`) — daromad yozilmaydi.
 */
export type MarketOperator = {
  id: string;
  name: string;
  phone_number: string;
  status: MarketOperatorStatus;
  commission_type: CommissionType | null;
  commission_value: number | null;
  created_at: string | null;
  /**
   * XtcEyQjb: «Ombordagi qoldiqni ko'radi» — market har operatorga alohida yoqadi (sukut `false`;
   * `PATCH /market-operators/:id/warehouse-access`).
   */
  can_view_warehouse_stock: boolean;
};

export type MarketOperatorListParams = {
  page: number;
  limit: number;
  search?: string;
  status?: MarketOperatorStatus;
};

export type MarketOperatorList = {
  items: MarketOperator[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Buyurtma yaratishda tanlanadigan operator — `GET /market-operators/selectable` qatori (faqat id va ism). Tanlansa
 * buyurtmaga `operator_id` (komissiya egasi) va `operator` (chekdagi ism) shu yerdan yoziladi.
 */
export type SelectableMarketOperator = {
  id: string;
  name: string;
};

/**
 * 2026-11-20 — operator ismi faqat MATN bo'lib qolgan (operator_id siz) eski buyurtmalar guruhi (bir xil ism).
 * Ularga sotuvda komissiya yozilmagan; market operatorni tanlab ommaviy biriktiradi.
 */
export type UnlinkedOperatorGroup = {
  /** Buyurtmadagi yozuv (eng yangisi). */
  name: string;
  key: string;
  totalOrders: number;
  /** Sotilgan — biriktirilsa ulush darhol yoziladi. */
  soldOrders: number;
  /** Eng yangisi birinchi, ko'pi bilan 500 (ko'prog'i biriktirilgach qayta so'raladi). */
  orderIds: string[];
};

export type UnlinkedOperatorOrders = { groups: UnlinkedOperatorGroup[]; totalOrders: number };

/** Ommaviy biriktirish natijasi (barcha bo'laklar yig'indisi). */
export type UnlinkedAssignResult = { assigned: number; failed: number; earningsRecorded: number };

/**
 * `POST /market-operators` tanasi (`forbidNonWhitelisted`). Komissiya — ixtiyoriy, AYNI so'rovda (backend B3ZtzCCx:
 * operator va komissiya bitta yozuvda, atomik; ikkalasi BIRGA yoki hech biri). Ilgari ikkinchi `PATCH :id/commission`
 * bilan yozilardi — u yiqilsa operator komissiyasiz qolib, sotuvlarida komissiya yozilmasdi.
 */
export type CreateMarketOperatorRequest = {
  name: string;
  phone_number: string;
  password: string;
  commission_type?: CommissionType;
  commission_value?: number;
};

/** `PATCH /market-operators/:id/commission`; ikkalasi `null` — komissiyani olib tashlash. */
export type MarketOperatorCommission = {
  commission_type: CommissionType | null;
  commission_value: number | null;
};
