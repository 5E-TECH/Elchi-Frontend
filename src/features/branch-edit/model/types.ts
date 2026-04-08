export interface UpdateBranchDto {
  name: string;
  region_id: string;
  district_id: string;
  address: string;
  status: "active" | "inactive";
}
