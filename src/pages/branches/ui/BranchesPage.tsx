import { useEffect, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Building2 } from "lucide-react";
import type { Branch } from "../../../entities/branch";
import { BranchFormModal } from "../../../features/branch-create";
import { BranchEditModal } from "../../../features/branch-edit";
import Button from "../../../shared/components/button";
import HeaderName from "../../../shared/components/headerName";
import { BranchListWidget } from "../../../widgets/branch-list";

type ViewMode = "table" | "card" | "tree";

const STORAGE_KEY = "branches-view-mode";

const BranchesPage = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "table" || saved === "card" || saved === "tree" ? saved : "tree";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  return (
    <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
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

      <BranchFormModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <BranchEditModal
        open={Boolean(editingBranch)}
        initialData={editingBranch}
        onClose={() => setEditingBranch(null)}
      />
    </div>
  );
};

export default BranchesPage;
