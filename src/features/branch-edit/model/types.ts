import type { BranchType } from "../../../entities/branch";

export interface UpdateBranchDto {
  name: string;
  parent_id: string;
  type: BranchType;
  code: string;
  phone_number: string;
  address: string;
}

/**
 * PATCH /branches/:id tanasi. HQ tahririda `parent_id` umuman yuborilmaydi —
 * backend saqlangan qiymatni qoldiradi (`""` esa `@IsNumberString` dan o'tmaydi).
 */
export type UpdateBranchPayload = Omit<UpdateBranchDto, "parent_id"> & {
  parent_id?: string;
};
