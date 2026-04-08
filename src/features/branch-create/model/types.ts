export interface CreateBranchDto {
  name: string;
  phone_number: string;
  region_id: string;
  district_id: string;
  address: string;
  status: "active" | "inactive";
  manager_id: string;
}
