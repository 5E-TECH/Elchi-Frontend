export type CreateBranchType = "PICKUP" | "REGIONAL" | "HYBRID";

export interface CreateBranchDto {
  name: string;
  parent_id: string;
  type: CreateBranchType;
  code: string;
  phone_number: string;
  region_id: string;
  district_id: string;
  address: string;
  manager_id?: string;
}
