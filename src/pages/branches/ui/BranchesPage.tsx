// dizayn-v2: superadmin-branches-list-tree, superadmin-branches-list-table, superadmin-branches-create-dialog
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Branch } from "../../../entities/branch";
import { BranchFormModal } from "../../../features/branch-create";
import { BranchEditModal } from "../../../features/branch-edit";
import { Button } from "../../../shared/ui/primitives";
import { BranchListWidget, type BranchViewMode } from "../../../widgets/branch-list";

/** Ko'rinish tanlovi shu kalitda (e2e `tests/e2e/support/branchList.ts` ham shu kalit bilan rejim beradi). */
const STORAGE_KEY = "branches-view-mode";

const getStoredViewMode = (): BranchViewMode => {
  if (typeof window === "undefined") {
    return "tree";
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "table" || saved === "card" || saved === "tree" ? saved : "tree";
  } catch {
    return "tree";
  }
};

/**
 * FILIALLAR — `/branches` (faqat superadmin, `canViewBranches`), dizayn v2.
 * Ro'yxat (daraxt · jadval · kartalar) — `BranchListWidget`; «+ Yangi filial» — `BranchFormModal`,
 * «Tahrirlash» — `BranchEditModal` (ikkalasi bitta v2 `BranchFormDialog` ko'rinishida).
 */
const BranchesPage = () => {
  const { t } = useTranslation("branches");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewMode, setViewMode] = useState<BranchViewMode>(getStoredViewMode);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // Storage ishlamasa ham sahifa ishlashda davom etadi.
    }
  }, [viewMode]);

  return (
    <>
      <BranchListWidget
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onEdit={(branch) => setEditingBranch(branch)}
        createAction={
          <Button leftIcon={Plus} onClick={() => setIsCreateOpen(true)}>
            {t("create.title")}
          </Button>
        }
      />

      {isCreateOpen ? <BranchFormModal open onClose={() => setIsCreateOpen(false)} /> : null}
      {editingBranch ? (
        <BranchEditModal open initialData={editingBranch} onClose={() => setEditingBranch(null)} />
      ) : null}
    </>
  );
};

export default BranchesPage;
