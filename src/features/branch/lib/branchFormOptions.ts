import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranches } from "../../../entities/branch/api/branchApi";
import type { Branch } from "../../../entities/branch";

export const useParentBranchOptions = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.branches.list({ page: 1, limit: 200, status: "active" }),
    queryFn: () => getBranches({ page: 1, limit: 200, status: "active" }),
    enabled,
  });

export const getBranchTypeOptions = (t: TFunction) => [
  { value: "HQ", label: "HQ", disabled: true },
  { value: "CITY", label: t("branchTypes.city") },
  { value: "REGIONAL", label: t("branchTypes.regional") },
  { value: "DISTRICT", label: t("branchTypes.district") },
];

const getIndent = (level?: number) => {
  const depth = Math.max((level ?? 1) - 1, 0);
  return depth > 0 ? `${"— ".repeat(depth)}` : "";
};

const getTypeLabel = (branch: Branch, t: TFunction) => {
  if (!branch.type) return t("branchTypes.unknown");
  if (branch.type === "HQ") return "HQ";

  const branchTypeKey = branch.type.toLowerCase();
  return t(`branchTypes.${branchTypeKey}`);
};

export const getParentBranchOptions = (
  branches: Branch[] | undefined,
  t: TFunction,
  excludeBranchId?: string,
) =>
  (branches ?? [])
    .filter((branch) => branch.id !== excludeBranchId && Number(branch.level ?? 0) < 2)
    .sort((left, right) => {
      const leftLevel = left.level ?? 0;
      const rightLevel = right.level ?? 0;

      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      return left.name.localeCompare(right.name);
    })
    .map((branch) => {
      const indent = getIndent(branch.level);
      const codeLabel = branch.code ? ` (${branch.code})` : "";
      const typeLabel = getTypeLabel(branch, t);
      const areaLabel = [branch.region?.name, branch.district?.name]
        .filter((part) => part && part !== "—")
        .join(" • ");

      return {
        value: String(branch.id),
        label: `${indent}${branch.name}${codeLabel} · ${typeLabel}${areaLabel ? ` · ${areaLabel}` : ""}`,
      };
    });
