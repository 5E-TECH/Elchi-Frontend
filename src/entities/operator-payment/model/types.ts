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
