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
  const branchLabel = branch.code || branch.type || "—";

  return (
    <button
      type="button"
      onClick={() => navigate(`/branches/${branch.id}`)}
      className="group relative w-full overflow-hidden rounded-xl border border-[color:var(--color-border-soft)] bg-[var(--color-card-surface-strong)] text-left shadow-[0_10px_24px_rgba(39,44,82,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-surface)] hover:shadow-[0_14px_30px_rgba(39,44,82,0.12)] dark:border-white/10 dark:bg-[var(--color-surface-elevated-dark)] dark:hover:border-[var(--color-main)]/50 dark:hover:bg-[var(--color-surface-dark)]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-purple-light)_100%)]" />

      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border-soft)] bg-[var(--color-main-soft)]/20 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border-soft)] bg-white text-[var(--color-main)] shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white">
            <Building2 size={17} />
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-main)] dark:text-white/55">
              {branchLabel}
            </p>
            <h3 className="truncate text-[17px] font-bold leading-6 text-[var(--color-maindark)] dark:text-white">
              {branch.name}
            </h3>
          </div>
        </div>
        <div className="shrink-0">
          <BranchStatusBadge status={branch.status} />
        </div>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border-soft)] bg-[var(--color-card-surface)] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.045]">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-main)] shadow-sm dark:bg-white/8 dark:text-white/85">
            <MapPin size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] dark:text-white/55">
              {t("fields.address")}
            </p>
            <p className="mt-1 line-clamp-1 text-[15px] font-semibold leading-5 text-[var(--color-maindark)] dark:text-white/90">
              {address}
            </p>
            <p className="mt-1 truncate text-sm text-[var(--color-text-muted)] dark:text-white/60">
              {regionName}, {districtName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border-soft)] bg-[var(--color-main-soft)]/35 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.055]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-main)] shadow-sm dark:bg-white/8 dark:text-white/85">
              <Users size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] dark:text-white/55">
                {t("table.employees")}
              </p>
              <p className="truncate text-[15px] font-bold leading-5 text-[var(--color-maindark)] dark:text-white">
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--color-border-soft)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-main)] shadow-sm transition-colors hover:border-[var(--color-main)] hover:bg-[var(--color-main-soft)] dark:border-white/10 dark:bg-white/8 dark:text-white/90 dark:hover:bg-white/12"
          >
            {tCommon("open")}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </button>
  );
};

export default memo(BranchCard);
