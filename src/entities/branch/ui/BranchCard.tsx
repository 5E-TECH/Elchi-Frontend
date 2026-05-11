import { useNavigate } from "react-router-dom";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, MapPin, Users } from "lucide-react";
import type { Branch } from "../model/types";
import BranchStatusBadge from "./BranchStatusBadge";

const BranchCard = ({ branch }: { branch: Branch }) => {
  const { t } = useTranslation("branches");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const regionName = branch.region?.name ?? "—";
  const districtName = branch.district?.name ?? "—";
  const address = branch.address || "—";
  const employeeCount = Number(branch.employees_count ?? 0);

  return (
    <button
      type="button"
      onClick={() => navigate(`/branches/${branch.id}`)}
      className="group relative w-full overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(145deg,var(--color-surface-elevated)_0%,rgba(87,106,219,0.08)_100%)] text-left shadow-[0_12px_28px_rgba(39,44,82,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[0_18px_34px_rgba(39,44,82,0.14)] dark:bg-[linear-gradient(145deg,var(--color-surface-elevated-dark)_0%,rgba(87,106,219,0.18)_100%)] dark:hover:border-[var(--color-main)]/60"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)]" />

      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3 dark:border-primarydark/40">
        <div className="min-w-0">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/40 dark:text-white">
            <Building2 size={17} />
          </div>
          <h3 className="truncate text-base font-bold text-[var(--color-maindark)] dark:text-white">
            {branch.name}
          </h3>
        </div>
        <div className="shrink-0 rounded-full bg-[color:var(--color-main-soft)] px-2.5 py-0.5 text-xs dark:bg-primarydark/30">
          <BranchStatusBadge status={branch.status} />
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/35 dark:text-white/90">
            <MapPin size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              {t("fields.address")}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--color-maindark)] dark:text-white/85">
              {address}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              {regionName}, {districtName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-main-soft)]/70 px-3 py-2.5 dark:border-primarydark/40 dark:bg-primarydark/25">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-[var(--color-main)] dark:bg-white/10 dark:text-white">
              <Users size={15} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                {t("table.employees")}
              </p>
              <p className="text-sm font-bold text-[var(--color-maindark)] dark:text-white">
                {t("list.employeeCount", { count: employeeCount })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/branches/${branch.id}`);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-main)] transition-colors hover:border-[var(--color-main)] hover:bg-white/70 dark:border-primarydark/50 dark:text-white/85 dark:hover:bg-white/10"
          >
            {tCommon("open")}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </button>
  );
};

export default memo(BranchCard);
