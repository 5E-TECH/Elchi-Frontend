export interface Branch {
  id: string;
  name: string;
  region: { id: string; name: string };
  district: { id: string; name: string };
  address: string;
  status: "active" | "inactive";
  employees_count: number;
  created_at: string;
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
