import { Button, Empty } from "antd";
import { useState } from "react";
import {
  Building2,
  MapPin,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { Branch, Employee } from "../../../entities/branch";
import { BranchStatusBadge } from "../../../entities/branch";
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const actionButtonClassName =
    "!h-10 !rounded-xl !px-4 !font-medium transition-colors";
  const secondaryActionButtonClassName = `${actionButtonClassName} !border !border-[color:var(--color-border-soft)] !bg-[color:var(--color-main-soft)] !text-[var(--color-maindark)] hover:!border-[var(--color-main)] hover:!bg-[color:color-mix(in_srgb,var(--color-main)_22%,white)] hover:!text-[var(--color-main)] dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-[var(--color-main)] dark:hover:!bg-primarydark/70 dark:hover:!text-white`;
  const primaryActionButtonClassName = `${actionButtonClassName} !border-none !bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] !shadow-[0_14px_28px_rgba(87,106,219,0.24)] hover:!opacity-95`;

  if (!branch) {
    return <Empty description="Filial topilmadi" />;
  }

  return (
    <>
      <div className="rounded-[2rem] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(87,106,219,0.14)_0%,rgba(87,106,219,0.04)_100%)] p-4 shadow-[0_24px_50px_rgba(39,44,82,0.12)] dark:bg-[linear-gradient(180deg,rgba(87,106,219,0.2)_0%,rgba(39,44,82,0.42)_100%)] sm:p-5 lg:p-6">
        <div className="rounded-[1.75rem] bg-primary/95 p-4 dark:bg-maindark/95 sm:p-5 lg:p-6">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-[color:var(--color-border-soft)] bg-[linear-gradient(135deg,var(--color-surface-elevated)_0%,rgba(87,106,219,0.1)_55%,rgba(76,87,152,0.16)_100%)] p-5 shadow-[0_24px_48px_rgba(39,44,82,0.08)] dark:bg-[linear-gradient(135deg,var(--color-surface-elevated-dark)_0%,rgba(87,106,219,0.2)_50%,rgba(76,87,152,0.36)_100%)] sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--color-main-soft)] blur-3xl dark:bg-[var(--color-main)]/20" />
            <div className="absolute bottom-0 left-10 h-24 w-24 rounded-full bg-[var(--color-purple-soft)] blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_18px_36px_rgba(87,106,219,0.3)]">
                  <Building2 size={26} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight text-[var(--color-maindark)] dark:text-white sm:text-[2rem]">
                    {branch.name}
                  </h1>
                  <span className="rounded-full border border-[color:var(--color-border-soft)] bg-white/55 px-3 py-1.5 dark:bg-white/10">
                    <BranchStatusBadge status={branch.status} />
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] sm:text-[15px]">
                  Filial ma'lumotlari, xodimlar va sozlamalarni bitta joydan boshqaring.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/40 dark:text-white">
                      <MapPin size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      Joylashuv
                    </p>
                    <p className="mt-1 font-semibold text-[var(--color-maindark)] dark:text-white">
                      {branch.region.name}, {branch.district.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      {branch.address}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/40 dark:text-white">
                      <Users size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      Xodimlar
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--color-maindark)] dark:text-white">
                      {branch.employees_count}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      filialga biriktirilgan foydalanuvchi
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 p-4 dark:bg-white/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/40 dark:text-white">
                      <Sparkles size={18} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      Yaratilgan sana
                    </p>
                    <p className="mt-1 font-semibold text-[var(--color-maindark)] dark:text-white">
                      {formatDate(branch.created_at, "DD.MM.YYYY")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      filial tizimga qo'shilgan vaqt
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative flex shrink-0 flex-wrap gap-3">
                <Button
                  className={secondaryActionButtonClassName}
                  onClick={() => setIsEditOpen(true)}
                >
                  Tahrirlash
                </Button>
                <Button
                  type="primary"
                  icon={<UserPlus size={16} />}
                  className={primaryActionButtonClassName}
                  onClick={() => setIsAddEmployeeOpen(true)}
                >
                  Xodim qo'shish
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(87,106,219,0.06)_0%,rgba(255,255,255,0.92)_100%)] p-3 dark:bg-[linear-gradient(180deg,rgba(87,106,219,0.12)_0%,rgba(39,44,82,0.92)_100%)] sm:p-4">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(87,106,219,0.22)]">
                <Users size={16} />
                Filial va xodimlar
              </div>
            </div>

            <div className="mt-4 rounded-[1.4rem] border border-[color:var(--color-border-soft)] bg-primary/90 p-4 dark:bg-maindark/85 sm:p-5">
              <BranchEmployeesSection
                branchId={branchId}
                data={employees}
                loading={employeesLoading}
              />
            </div>
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
