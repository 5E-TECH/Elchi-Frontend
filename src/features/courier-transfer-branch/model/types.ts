import type { BranchType } from "../../../entities/branch";

/** Kuryerning hozirgi filiali (tekshiruv javobidagi `current_branch`). */
export interface CourierTransferBranchRef {
  id: string;
  name: string;
  type: BranchType | null;
}

/** HQ filiali (tekshiruv javobidagi `hq_branch`) — o'tkazish ro'yxatidagi HQ varianti. */
export interface CourierTransferHqRef {
  id: string;
  name: string;
}

export interface CourierTransferOrderSample {
  id: string;
  status: string;
}

/**
 * GET /couriers/:id/transfer-check — normallashtirilgan ko'rinish.
 *
 * `reasons` — server yozgan to'siqlar (o'zbekcha, AYNAN ko'rsatiladi).
 * `canTransfer` faqat server `can_transfer: true` va BO'SH `reasons` massivini
 * qaytarganda `true`: noaniq javob o'tkazishga ruxsat bermaydi.
 */
export interface CourierTransferCheck {
  userId: string;
  currentBranch: CourierTransferBranchRef | null;
  hqBranch: CourierTransferHqRef | null;
  /** Kassadagi sof qoldiq (so'm); manfiy bo'lishi mumkin. */
  balance: number;
  ordersInHand: number;
  ordersSample: CourierTransferOrderSample[];
  openReturnPosts: number;
  pendingSettlementCount: number;
  reasons: string[];
  canTransfer: boolean;
}

/** Server javobi (snake_case) — maydonlar ishonchsiz, normallashtirishda tekshiriladi. */
export interface CourierTransferCheckRaw {
  user_id?: unknown;
  current_branch?: unknown;
  hq_branch?: unknown;
  balance?: unknown;
  orders_in_hand?: unknown;
  orders_sample?: unknown;
  open_return_posts?: unknown;
  pending_settlement_count?: unknown;
  reasons?: unknown;
  can_transfer?: unknown;
}

export interface TransferCourierVariables {
  courierId: string;
  branchId: string;
}

/** PATCH /couriers/:id/branch muvaffaqiyatli javobi. */
export interface TransferCourierResponse {
  statusCode: number;
  message: string;
  data: {
    user_id: string;
    from_branch_id: string | null;
    to_branch_id: string;
    region_id: string | null;
  };
}
