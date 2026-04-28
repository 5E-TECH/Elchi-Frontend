import type { RootState } from "../../app/config/store";

export const getCurrentBranchId = (state: RootState) => {
  const user = state.user.user as Record<string, unknown> | null;
  const branchObject =
    user?.branch && typeof user.branch === "object"
      ? (user.branch as Record<string, unknown>)
      : null;

  const branchId =
    user?.branch_id ??
    user?.branchId ??
    branchObject?.id ??
    user?.current_branch_id;

  if (typeof branchId === "string" && branchId.trim()) return branchId;
  if (typeof branchId === "number") return String(branchId);
  return "";
};
