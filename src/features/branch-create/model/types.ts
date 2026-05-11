import type { BranchType } from "../../../entities/branch";

export interface CreateBranchDto {
  name: string;
  parent_id: string;
  type: BranchType;
  code: string;
  phone_number: string;
  region_id: string;
  district_id: string;
  address: string;
}
