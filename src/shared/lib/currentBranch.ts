import type { RootState } from "../../app/config/store";

export const getCurrentBranchId = (state: RootState) => {
  const user = state.user.user as Record<string, unknown> | null;
  const branchObject =
    user?.branch && typeof user.branch === "object"
      ? (user.branch as Record<string, unknown>)
      : null;
  const nestedBranchObject =
    branchObject?.branch && typeof branchObject.branch === "object"
      ? (branchObject.branch as Record<string, unknown>)
      : null;
  const assignedBranchObject =
    user?.assigned_branch && typeof user.assigned_branch === "object"
      ? (user.assigned_branch as Record<string, unknown>)
      : null;
  const managerBranchObject =
    user?.manager_branch && typeof user.manager_branch === "object"
      ? (user.manager_branch as Record<string, unknown>)
      : null;

  const branchId =
    user?.branch_id ??
    user?.branchId ??
    nestedBranchObject?.id ??
    nestedBranchObject?.branch_id ??
    branchObject?.id ??
    branchObject?.branch_id ??
    assignedBranchObject?.id ??
    assignedBranchObject?.branch_id ??
    managerBranchObject?.id ??
    managerBranchObject?.branch_id ??
    user?.current_branch_id ??
    user?.currentBranchId;

  if (typeof branchId === "string" && branchId.trim()) return branchId;
  if (typeof branchId === "number") return String(branchId);
  return "";
};
