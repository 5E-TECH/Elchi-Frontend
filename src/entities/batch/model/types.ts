export type BatchStatus = "new" | "on_the_way" | "received" | "cancelled";
export type BatchDirection = "forward" | "return";

export interface BatchBranch {
  id: string;
  name: string;
  code?: string;
  region?: string;
}

export interface BatchOrder {
  id: string;
  receiver: string;
  phone: string;
  address: string;
  price: number;
  status: string;
}

export interface BatchHistoryItem {
  id: string;
  actor: string;
  action: string;
  created_at: string;
}

export interface Batch {
  id: string;
  token: string;
  from_branch: BatchBranch;
  to_branch: BatchBranch;
  direction: BatchDirection;
  orders_count: number;
  total_price: number;
  status: BatchStatus;
  driver?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  request_key?: string;
  created_at: string;
}

export interface BatchDetail extends Batch {
  orders: BatchOrder[];
  history: BatchHistoryItem[];
}

export interface BatchListParams {
  status?: BatchStatus | "";
  statusRaw?: "PENDING" | "SENT" | "RECEIVED" | "CANCELLED" | "";
  direction?: BatchDirection | "";
  directionRaw?: "FORWARD" | "RETURN" | "";
  sourceBranchId?: string;
  destinationBranchId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface BatchListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BatchListResponse {
  data: Batch[];
  total: number;
  meta: BatchListMeta;
}
