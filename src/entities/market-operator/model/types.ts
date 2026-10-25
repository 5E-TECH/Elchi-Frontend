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

/** `POST /market-operators` tanasi — faqat 3 maydon (`forbidNonWhitelisted`: komissiya alohida PATCH bilan). */
export type CreateMarketOperatorRequest = {
  name: string;
  phone_number: string;
  password: string;
};

/** `PATCH /market-operators/:id/commission`; ikkalasi `null` — komissiyani olib tashlash. */
export type MarketOperatorCommission = {
  commission_type: CommissionType | null;
  commission_value: number | null;
};
