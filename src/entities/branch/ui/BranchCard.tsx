import { useNavigate } from "react-router-dom";
import { memo } from "react";
import { Building2, MapPin, Users } from "lucide-react";
import type { Branch } from "../model/types";
import BranchStatusBadge from "./BranchStatusBadge";

const BranchCard = ({ branch }: { branch: Branch }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/branches/${branch.id}`)}
      className="group relative w-full overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(145deg,var(--color-surface-elevated)_0%,rgba(87,106,219,0.08)_100%)] text-left shadow-[0_18px_36px_rgba(39,44,82,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:shadow-[0_24px_42px_rgba(39,44,82,0.16)] dark:bg-[linear-gradient(145deg,var(--color-surface-elevated-dark)_0%,rgba(87,106,219,0.18)_100%)] dark:hover:border-[var(--color-main)]/60"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)]" />

      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-5 py-4 dark:border-primarydark/40">
        <div className="min-w-0">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/40 dark:text-white">
            <Building2 size={20} />
          </div>
          <h3 className="truncate text-lg font-bold text-[var(--color-maindark)] dark:text-white">
            {branch.name}
          </h3>
        </div>
        <div className="shrink-0 rounded-full bg-[color:var(--color-main-soft)] px-3 py-1 text-sm dark:bg-primarydark/30">
          <BranchStatusBadge status={branch.status} />
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/35 dark:text-white/90">
            <MapPin size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              Manzil
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-maindark)] dark:text-white/85">
              {branch.address}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              {branch.region.name}, {branch.district.name}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-main-soft)]/70 px-4 py-3 dark:border-primarydark/40 dark:bg-primarydark/25">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-[var(--color-main)] dark:bg-white/10 dark:text-white">
              <Users size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                Xodimlar
              </p>
              <p className="text-base font-bold text-[var(--color-maindark)] dark:text-white">
                {branch.employees_count} xodim
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[color:var(--color-border-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-main)] dark:border-primarydark/50 dark:text-white/85">
            Batafsil
          </span>
        </div>
      </div>
    </button>
  );
};

export default memo(BranchCard);
