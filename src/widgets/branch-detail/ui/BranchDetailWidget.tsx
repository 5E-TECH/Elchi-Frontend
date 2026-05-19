import { Button as AntButton, Empty } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  MapPin,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { Branch, Employee } from "../../../entities/branch";
import { BranchStatusBadge } from "../../../entities/branch";
import Button from "../../../shared/components/button";
import { AddEmployeeModal } from "../../../features/branch-add-employee";
import { BranchEditModal } from "../../../features/branch-edit";
import { formatDate } from "../../../shared/lib/formatDate";
import BranchEmployeesSection from "./BranchEmployeesSection";

interface BranchDetailWidgetProps {
  branchId: string;
  branch: Branch | null;
  employees: Employee[];
  employeesLoading?: boolean;
}

const BranchDetailWidget = ({
  branchId,
  branch,
  employees,
  employeesLoading,
}: BranchDetailWidgetProps) => {
  const { t } = useTranslation("branches");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const actionButtonClassName =
    "!h-10 !rounded-xl !px-4 !font-medium transition-colors";
  const secondaryActionButtonClassName = `${actionButtonClassName} !border !border-(--color-border-soft) !bg-white/85 !text-maindark !shadow-sm hover:!border-[var(--color-main)] hover:!bg-main-soft hover:!text-(--color-main) dark:!border-white/12 dark:!bg-white/8 dark:!text-white/90 dark:hover:!border-[var(--color-main)] dark:hover:!bg-white/12 dark:hover:!text-white`;
  const primaryActionButtonClassName = "h-10 border-none bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] px-4 shadow-[0_14px_28px_rgba(87,106,219,0.24)] hover:opacity-95";

  if (!branch) {
    return <Empty description={t("detail.notFound")} />;
  }

  return (
    <>
      <div className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-(--color-border-soft) bg-(--color-card-surface-strong) p-5 shadow-[0_18px_42px_rgba(39,44,82,0.1)] dark:border-white/10 dark:bg-surface-elevated-dark sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-main-soft blur-3xl dark:bg-(--color-main)/20" />
            <div className="absolute bottom-0 left-10 h-24 w-24 rounded-full bg-purple-soft blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_18px_36px_rgba(87,106,219,0.3)]">
                  <Building2 size={26} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight text-maindark dark:text-white sm:text-[2rem]">
                    {branch.name}
                  </h1>
                  <span className="rounded-full border border-(--color-border-soft) bg-white/55 px-3 py-1.5 dark:bg-white/10">
                    <BranchStatusBadge status={branch.status} />
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm font-medium text-(--color-text-muted) dark:text-text-muted-dark sm:text-[15px]">
                  {t("detail.description")}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-(--color-border-soft) bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-main-soft text-(--color-main) dark:bg-primarydark/40 dark:text-white">
                      <MapPin size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text-muted) dark:text-text-muted-dark">
                      {t("detail.location")}
                    </p>
                    <p className="mt-1 font-semibold text-maindark dark:text-white">
                      {branch.region?.name ?? "—"}, {branch.district?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-(--color-text-muted) dark:text-text-muted-dark">
                      {branch.address}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-(--color-border-soft) bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-main-soft text-(--color-main) dark:bg-primarydark/40 dark:text-white">
                      <Users size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text-muted) dark:text-text-muted-dark">
                      {t("detail.employees")}
                    </p>
                    <p className="mt-1 text-2xl font-black text-maindark dark:text-white">
                      {branch.employees_count}
                    </p>
                    <p className="mt-1 text-sm text-(--color-text-muted) dark:text-text-muted-dark">
                      {t("detail.assignedUsers")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-(--color-border-soft) bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-main-soft text-(--color-main) dark:bg-primarydark/40 dark:text-white">
                      <Sparkles size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text-muted) dark:text-text-muted-dark">
                      {t("detail.createdDate")}
                    </p>
                    <p className="mt-1 font-semibold text-maindark dark:text-white">
                      {formatDate(branch.created_at, "DD.MM.YYYY")}
                    </p>
                    <p className="mt-1 text-sm text-(--color-text-muted) dark:text-text-muted-dark">
                      {t("detail.createdHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative flex shrink-0 flex-wrap gap-3">
                <AntButton
                  className={secondaryActionButtonClassName}
                  onClick={() => setIsEditOpen(true)}
                >
                  {t("actions.edit")}
                </AntButton>
                <Button
                  label={t("employee.add")}
                  icon={<UserPlus size={16} />}
                  className={primaryActionButtonClassName}
                  onClick={() => setIsAddEmployeeOpen(true)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-(--color-border-soft) bg-(--color-card-surface-strong) p-3 shadow-[0_14px_34px_rgba(39,44,82,0.08)] dark:border-white/10 dark:bg-surface-elevated-dark sm:p-4">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(87,106,219,0.22)]">
                <Users size={16} />
                {t("detail.branchAndEmployees")}
              </div>
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-(--color-border-soft) bg-(--color-card-surface-strong) p-4 dark:border-white/10 dark:bg-surface-elevated-dark sm:p-5">
              <BranchEmployeesSection
                branchId={branchId}
                data={employees}
                loading={employeesLoading}
              />
            </div>
          </div>
      </div>

      <BranchEditModal
        open={isEditOpen}
        initialData={branch}
        onClose={() => setIsEditOpen(false)}
      />
      <AddEmployeeModal
        branchId={branchId}
        open={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
      />
    </>
  );
};

export default BranchDetailWidget;
