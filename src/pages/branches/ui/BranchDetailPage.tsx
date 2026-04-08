import { Button, Empty, Spin } from "antd";
import { useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Building2, MapPin, Settings2, Sparkles, UserPlus, Users } from "lucide-react";
import {
  BranchStatusBadge,
  useBranchDetail,
  useBranchEmployees,
  useBranchSettings,
  type Employee,
} from "../../../entities/branch";
import { AddEmployeeModal } from "../../../features/branch-add-employee";
import { BranchEditModal } from "../../../features/branch-edit";
import { RemoveEmployeeButton } from "../../../features/branch-remove-employee";
import { SettingsTable } from "../../../features/branch-settings-manage";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { formatDate } from "../../../shared/lib/formatDate";

const BranchDetailPage = () => {
  const { id = "" } = useParams();
  const [activeTab, setActiveTab] = useState<"employees" | "settings">("employees");
  const { data: branch, isLoading: branchLoading } = useBranchDetail(id);
  const { data: employees = [], isLoading: employeesLoading } = useBranchEmployees(id, activeTab === "employees");
  const { data: settings = [], isLoading: settingsLoading } = useBranchSettings(id, activeTab === "settings");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const actionButtonClassName =
    "!h-8 !rounded-lg !border !border-[color:var(--color-border-soft)] !bg-[color:var(--color-main-soft)] !px-3 !font-medium !text-[var(--color-maindark)] transition-colors hover:!border-[var(--color-main)] hover:!bg-[color:color-mix(in_srgb,var(--color-main)_22%,white)] hover:!text-[var(--color-main)] dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-[var(--color-main)] dark:hover:!bg-primarydark/70 dark:hover:!text-white";
  const deleteButtonClassName =
    `${actionButtonClassName} !border-rose-200/80 !bg-rose-50 !text-rose-600 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200`;

  const employeeColumns: ColumnConfig<Employee>[] = useMemo(
    () => [
      {
        key: "user",
        label: "Xodim",
        render: (_, record) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[var(--color-maindark)] dark:text-white">{record.user.fullName}</span>
            <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">{record.user.phone}</span>
          </div>
        ),
      },
      { key: "position", label: "Lavozim", sortable: true },
      {
        key: "joined_at",
        label: "Qo'shilgan sana",
        sortable: true,
        sortValue: (row) => new Date(row.joined_at).getTime(),
        render: (value: string) => formatDate(value, "DD.MM.YYYY"),
      },
      {
        key: "id",
        label: "Amallar",
        render: (_, record) => (
          <RemoveEmployeeButton
            branchId={id}
            employeeId={record.id}
            className={deleteButtonClassName}
          />
        ),
      },
    ],
    [deleteButtonClassName, id],
  );

  if (branchLoading) {
    return <Spin />;
  }

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
                  className={actionButtonClassName}
                  onClick={() => setIsEditOpen(true)}
                >
                  Tahrirlash
                </Button>
                {activeTab === "employees" ? (
                  <Button
                    type="primary"
                    icon={<UserPlus size={16} />}
                    className="!h-10 !rounded-xl !border-none !bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] !px-4 !font-medium !shadow-[0_14px_28px_rgba(87,106,219,0.24)] hover:!opacity-95"
                    onClick={() => setIsAddEmployeeOpen(true)}
                  >
                    Xodim qo'shish
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(87,106,219,0.06)_0%,rgba(255,255,255,0.92)_100%)] p-3 dark:bg-[linear-gradient(180deg,rgba(87,106,219,0.12)_0%,rgba(39,44,82,0.92)_100%)] sm:p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "employees" as const, label: "Filial va xodimlar", icon: <Users size={16} /> },
                { key: "settings" as const, label: "Sozlamalar", icon: <Settings2 size={16} /> },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_14px_28px_rgba(87,106,219,0.22)]"
                        : "bg-white/75 text-[var(--color-maindark)] hover:bg-[var(--color-main-soft)] dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1.4rem] border border-[color:var(--color-border-soft)] bg-primary/90 p-4 dark:bg-maindark/85 sm:p-5">
              {activeTab === "employees" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--color-maindark)] dark:text-white">Filial xodimlari</h2>
                      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                        Biriktirilgan xodimlar ro'yxati va ularning lavozimlari.
                      </p>
                    </div>
                  </div>

                  <Table
                    keyExtractor={(employee) => employee.id}
                    loading={employeesLoading}
                    columns={employeeColumns}
                    data={employees}
                    emptyMessage="Xodimlar topilmadi"
                    className="text-[var(--color-maindark)] dark:text-white/85"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-maindark)] dark:text-white">Filial sozlamalari</h2>
                    <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      Filialga tegishli kalit-qiymat sozlamalarini shu joydan boshqaring.
                    </p>
                  </div>
                  <SettingsTable branchId={id} data={settings} loading={settingsLoading} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BranchEditModal open={isEditOpen} initialData={branch} onClose={() => setIsEditOpen(false)} />
      <AddEmployeeModal branchId={id} open={isAddEmployeeOpen} onClose={() => setIsAddEmployeeOpen(false)} />
    </>
  );
};

export default BranchDetailPage;
