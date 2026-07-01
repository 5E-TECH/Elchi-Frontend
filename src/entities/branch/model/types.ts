export type BranchType = "HQ" | "PICKUP" | "REGIONAL" | "HYBRID";

export interface Branch {
  id: string;
  name: string;
  manager_id?: string;
  manager?: { id: string; name?: string; fullName?: string } | null;
  has_manager?: boolean;
  parent_id?: string;
  parent?: { id: string; name: string } | null;
  type?: BranchType;
  level?: number;
  code?: string;
  phone_number?: string;
  region: { id: string; name: string };
  district: { id: string; name: string };
  address: string;
  status: "active" | "inactive";
  employees_count: number;
  created_at: string;
  olinishi_kerak?: number;
  berilishi_kerak?: number;
  kassadagi_summa?: number;
}

export interface Employee {
  id: string;
  user: { id: string; fullName: string; phone: string };
  position: string;
  joined_at: string;
}

export interface BranchSetting {
  id: string;
  key: string;
  value: string;
}

export interface BranchParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "";
}

export interface SentBatchBranchRow {
  branch_id: string;
  name: string;
  phone_number: string;
  batches_count: number;
  total_price_sum: number;
}

export interface SentBatchBranchParams {
  side?: "source" | "destination";
  direction?: "FORWARD" | "RETURN";
}
