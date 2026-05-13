import { useEffect, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Building2 } from "lucide-react";
import type { Branch } from "../../../entities/branch";
import { BranchFormModal } from "../../../features/branch-create";
import { BranchEditModal } from "../../../features/branch-edit";
import Button from "../../../shared/components/button";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import { BranchListWidget } from "../../../widgets/branch-list";

type ViewMode = "table" | "card" | "tree";

const STORAGE_KEY = "branches-view-mode";
const getStoredViewMode = (): ViewMode => {
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

const BranchesPage = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);

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
    <PageContainer>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HeaderName
          name="Filiallar"
          description="Filiallar ro'yxati va holatini boshqarish"
          icon={<Building2 size={22} />}
        />
        <Button
          label="Yangi filial"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto"
        />
      </div>

      <BranchListWidget
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onEdit={(branch) => setEditingBranch(branch)}
      />

      {isCreateOpen ? <BranchFormModal open onClose={() => setIsCreateOpen(false)} /> : null}
      {editingBranch ? (
        <BranchEditModal
          open
          initialData={editingBranch}
          onClose={() => setEditingBranch(null)}
        />
      ) : null}
    </PageContainer>
  );
};

export default BranchesPage;
