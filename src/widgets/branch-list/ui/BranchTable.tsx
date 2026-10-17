// dizayn-v2: superadmin-branches-list-table
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import type { Branch } from "../../../entities/branch";
import {
  branchAreaText,
  branchStatusLabel,
  branchStatusTone,
  branchTypeLabel,
  knownText,
} from "../../../features/branch/lib/branchDisplay";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, DataTable, type DataTableColumn, type DataTableSort } from "../../../shared/ui/primitives";
import { BranchRowMenu } from "./BranchRowMenu";
import { BranchSummaryCard } from "./BranchSummaryCard";

interface BranchTableProps {
  data: readonly Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onOpen: (branch: Branch) => void;
  busy?: boolean;
}

type SortKey = "name" | "region" | "employees" | "created";

const SORT_VALUE: Record<SortKey, (branch: Branch) => string | number> = {
  name: (branch) => branch.name,
  region: (branch) => `${branch.region?.name ?? "—"} ${branch.district?.name ?? "—"}`,
  employees: (branch) => Number(branch.employees_count ?? 0),
  created: (branch) => new Date(branch.created_at ?? 0).getTime() || 0,
};

const isSortKey = (value: string): value is SortKey => value in SORT_VALUE;

/**
 * Joriy sahifa ichida saralash (eski jadvaldagidek — `GET /branches` saralash parametrini qabul qilmaydi,
 * openapi: faqat `search`, `status`, `page`, `limit`).
 */
const sortBranches = (rows: readonly Branch[], sort: DataTableSort | null): readonly Branch[] => {
  if (!sort || !isSortKey(sort.key)) return rows;
  const value = SORT_VALUE[sort.key];
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return order * direction;
  });
};

/**
 * FILIALLAR JADVALI (maket `superadmin-branches-list-table`): saralanadigan Nomi · Turi (< 1024 da nom ostida) ·
 * Hudud (+ manzil) · Xodimlar · Holat · Sana (< 1024 da yashirin) · amallar menyusi. Qator bosilsa — tafsilot.
 * Telefonda — kartalar (`BranchSummaryCard`: «Batafsil →» bilan).
 */
const BranchTable = ({ data, onEdit, onDelete, onOpen, busy = false }: BranchTableProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const rows = useMemo(() => sortBranches(data, sort), [data, sort]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  const columns = useMemo<DataTableColumn<Branch>[]>(
    () => [
      {
        id: "name",
        header: t("table.name"),
        sortable: true,
        cell: (branch) => {
          const code = knownText(branch.code);
          return (
            <>
              <Link
                to={`/branches/${encodeURIComponent(branch.id)}`}
                className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
              >
                {branch.name}
              </Link>
              <div className="whitespace-nowrap text-[13px] text-text-muted">
                {code}
                {/* Planshetda «Turi» ustuni yashirin — tur kod yonida (maket `.el-show-tablet`). */}
                <span className="hidden max-lg:inline">
                  {code ? " · " : ""}
                  {branchTypeLabel(branch.type, t)}
                </span>
              </div>
            </>
          );
        },
      },
      {
        id: "type",
        header: t("v2.columns.type"),
        hideBelow: "lg",
        cell: (branch) => <Badge>{branchTypeLabel(branch.type, t)}</Badge>,
      },
      {
        id: "region",
        header: t("table.area"),
        sortable: true,
        cell: (branch) => {
          const address = knownText(branch.address);
          return (
            <>
              <div>{branchAreaText(branch) || "—"}</div>
              {address ? <div className="text-[13px] text-text-muted">{address}</div> : null}
            </>
          );
        },
      },
      {
        id: "employees",
        header: t("table.employees"),
        sortable: true,
        align: "end",
        cell: (branch) => (
          <span className={cx(branch.employees_count === 0 && "text-text-subtle")}>
            {t("v2.list.employees", { count: branch.employees_count, value: count(branch.employees_count) })}
          </span>
        ),
      },
      {
        id: "status",
        header: t("v2.columns.status"),
        cell: (branch) => (
          <Badge tone={branchStatusTone(branch.status)} dot>
            {branchStatusLabel(branch.status, t)}
          </Badge>
        ),
      },
      {
        id: "created",
        header: t("table.date"),
        sortable: true,
        firstDirection: "desc",
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (branch) => (branch.created_at ? formatDateLocalized(branch.created_at, { language }) : "—"),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("v2.columns.actions")}</span>,
        className: "w-16",
        cellClassName: "text-right",
        cell: (branch) => (
          <BranchRowMenu
            name={branch.name}
            onOpen={() => onOpen(branch)}
            onEdit={() => onEdit(branch)}
            onDelete={() => onDelete(branch)}
          />
        ),
      },
    ],
    [count, language, onDelete, onEdit, onOpen, t],
  );

  const renderCard = useCallback(
    (branch: Branch) => <BranchSummaryCard branch={branch} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />,
    [onDelete, onEdit, onOpen],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(branch) => branch.id}
      label={t("v2.list.label")}
      cardsLabel={t("v2.list.label")}
      sort={sort}
      onSortChange={setSort}
      onRowClick={(branch) => navigate(`/branches/${encodeURIComponent(branch.id)}`)}
      renderCard={renderCard}
      density="tablet-tight"
      busy={busy}
    />
  );
};

export default memo(BranchTable);
