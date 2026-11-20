/**
 * F2qp6FtE (ega qarori 2026-11-16) — market o'z operatoriga O'ZI, istagan vaqtida to'laydi. Elchi kassasiga ta'sir
 * qilmaydi: tizim faqat yozuv saqlaydi — operator qancha ishlab topgani va qanchasi to'lab berilgani.
 */

/** Yozuv manbai: `market` — market o'zi yozgan (kassasiz); `elchi` — eski yo'l, Elchi Asosiy kassasidan to'langan. */
export type OperatorPaymentSource = "market" | "elchi";

export type OperatorPaymentStatus = "active" | "cancelled";

/** Bitta operator hisobi: «Ishlab topdi» − «To'landi» = «Qoldiq» (manfiy — ortiqcha to'langan). */
export type OperatorBalance = {
  operatorId: string;
  operatorName: string;
  status: "active" | "inactive";
  earned: number;
  paid: number;
  balance: number;
  paymentsCount: number;
  /** Oxirgi (bekor qilinmagan) to'lov sanasi, `YYYY-MM-DD`. */
  lastPaidAt: string | null;
};

export type OperatorBalanceTotals = { earned: number; paid: number; balance: number };

/**
 * 2026-11-20 — komissiyasiz qolgan o'tgan sotuvlar: sotuv paytida operator stavkasi belgilanmagan bo'lsa ulush
 * yozilmagan. `toRecord` / `amount` — JORIY stavka bilan yoziladigan buyurtmalar va summa.
 */
export type MissingEarnings = {
  soldOrders: number;
  alreadyRecorded: number;
  missing: number;
  toRecord: number;
  amount: number;
  commissionType: "percent" | "fixed" | null;
  commissionValue: number;
  /** 5000 dan ko'p sotuv — qolgani keyingi bosishda. */
  truncated: boolean;
  /** Faqat yozishdan keyin. */
  created: number;
  createdAmount: number;
};

export type OperatorBalances = { items: OperatorBalance[]; totals: OperatorBalanceTotals };

export type OperatorPayment = {
  id: string;
  operatorId: string;
  /** O'chirilgan operatorda — `null`. */
  operatorName: string | null;
  amount: number;
  /** To'lov sanasi (Toshkent kuni), `YYYY-MM-DD`. */
  paidAt: string | null;
  note: string;
  source: OperatorPaymentSource;
  /** Asosiy kassani o'zgartirganmi (faqat eski Elchi yozuvlarida). */
  affectsCashbox: boolean;
  createdAt: string | null;
  status: OperatorPaymentStatus;
  cancelledAt: string | null;
  cancelReason: string;
  /** Shu market bekor qila oladimi (o'z yozuvi, hali faol). */
  canCancel: boolean;
};

export type OperatorPaymentListParams = {
  page: number;
  limit: number;
  operatorId?: string;
};

export type OperatorPaymentList = {
  items: OperatorPayment[];
  total: number;
  page: number;
  limit: number;
};

/** `POST finance/operator-payments` tanasi (`market_id` — tokendan, yuborilmaydi). */
export type RecordOperatorPaymentRequest = {
  operator_id: string;
  amount: number;
  paid_at: string;
  note?: string;
};

/** Yozish / bekor qilish javobi: `idempotent` — takroriy so'rov (o'sha yozuv qaytdi). */
export type OperatorPaymentResult = { payment: OperatorPayment; idempotent: boolean };

/** Market operatorining o'z hisobi (`GET finance/operators/me/balance`). */
export type MyOperatorBalance = { earned: number; paid: number; balance: number };

/** `GET finance/operators/me/payments` — `{ rows, total }` (limit/offset). */
export type MyOperatorPaymentList = { items: OperatorPayment[]; total: number };

/**
 * B1te60bD — operator hisobini superadmin/admin KO'RADI (faqat o'qish): `GET finance/operators/:operator_id/{balance,
 * payments,earnings}` (`operator_id` — market operatori foydalanuvchi id'si). Shakli `/me/*` bilan AYNI.
 */
export type OperatorAccountPageParams = { limit: number; offset: number };

/** Bitta sotuvdan yozilgan komissiya (`OperatorEarning` qatori; summa sotuv paytidagi stavka bilan qotirilgan). */
export type OperatorEarning = {
  id: string;
  orderId: string;
  amount: number;
  /** Sotuv paytidagi stavka (`null` — belgilanmagan / eski yozuv). */
  commissionType: "percent" | "fixed" | null;
  commissionValue: number | null;
  /** Buyurtma narxi (sotuv paytida). */
  orderTotal: number | null;
  createdAt: string | null;
};

/** `{ rows, total, limit, offset }`. */
export type OperatorEarningList = { items: OperatorEarning[]; total: number };
