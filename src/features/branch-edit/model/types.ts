import type { BranchType } from "../../../entities/branch";

export interface UpdateBranchDto {
  name: string;
  parent_id: string;
  type: BranchType;
  code: string;
  phone_number: string;
  address: string;
}
