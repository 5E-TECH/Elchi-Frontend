// dizayn-v2: superadmin-branches-list-table
import { memo } from "react";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Branch } from "../../../entities/branch";
import {
  branchAreaText,
  branchStatusLabel,
  branchStatusTone,
  branchTypeLabel,
  knownText,
} from "../../../features/branch/lib/branchDisplay";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, buttonClasses } from "../../../shared/ui/primitives";
import { BranchRowMenu } from "./BranchRowMenu";

export type BranchSummaryCardProps = {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onOpen: (branch: Branch) => void;
  /** Kartalar to'rida — chegarali quti; ro'yxatda (telefon) — `.el-list-item` qatori. */
  framed?: boolean;
};

/**
 * FILIAL KARTASI (maket `superadmin-branches-list-table`, telefon `.el-list-item`): «TSH-HQ · HQ» (overline) +
 * nom (tafsilotga havola), holat badge'i; manzil + «viloyat, tuman»; «{n} ta xodim», amallar menyusi va
 * «Batafsil →». Jadvalning telefon kartasi va «Kartalar» ko'rinishi (desktopda 4 ustunli to'r) shu kartani
 * ishlatadi.
 */
export const BranchSummaryCard = memo(({ branch, onEdit, onDelete, onOpen, framed = false }: BranchSummaryCardProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const href = `/branches/${encodeURIComponent(branch.id)}`;
  const overline = [knownText(branch.code), branchTypeLabel(branch.type, t)].filter(Boolean).join(" · ");
  const address = knownText(branch.address);
  const area = branchAreaText(branch);
  const employees = t("v2.list.employeesLong", {
    count: branch.employees_count,
    value: formatNumberLocalized(branch.employees_count, { language }),
  });

  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-3 p-4",
        framed && "h-full rounded-xl border border-border bg-surface",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        {/* Telefonda bosish maydoni ≥ 44 px. */}
        <Link to={href} className="flex min-w-0 flex-col justify-center gap-0.5 text-text hover:text-action-fg max-md:min-h-11">
          <span className="truncate text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{overline}</span>
          <span className="text-sm font-semibold [overflow-wrap:anywhere]">{branch.name}</span>
        </Link>
        <Badge tone={branchStatusTone(branch.status)} dot className="shrink-0">
          {branchStatusLabel(branch.status, t)}
        </Badge>
      </div>
      {address || area ? (
        <div className="flex min-w-0 items-start gap-2">
          <MapPin aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-text-subtle" />
          <div className="min-w-0">
            {address ? <div className="text-[13px] font-semibold text-text">{address}</div> : null}
            {area ? <div className="text-[13px] text-text-muted">{area}</div> : null}
          </div>
        </div>
      ) : null}
      <div className={cx("flex min-w-0 items-center justify-between gap-2", framed && "mt-auto")}>
        <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-[13px] text-text-muted">
          <Users aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
          {employees}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <BranchRowMenu
            name={branch.name}
            onOpen={() => onOpen(branch)}
            onEdit={() => onEdit(branch)}
            onDelete={() => onDelete(branch)}
          />
          {/* Bir nechta karta — nomi «Batafsil — {filial}» (ko'rinadigan matn nom boshida qoladi). */}
          <Link
            to={href}
            aria-label={t("v2.list.detailsFor", { name: branch.name })}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("actions.details")}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        </span>
      </div>
    </div>
  );
});

BranchSummaryCard.displayName = "BranchSummaryCard";
