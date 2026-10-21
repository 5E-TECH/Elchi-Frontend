// dizayn-v2: market-operators-list
import { memo, useCallback, useMemo } from "react";
import { Percent, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { hasCommission, type MarketOperator } from "../../../entities/market-operator";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge, DataTable, Skeleton, type DataTableColumn } from "../../../shared/ui/primitives";
import { useCommissionText } from "../model/useCommissionText";
import { operatorInitials } from "../model/operatorInitials";
import { OperatorRowMenu, type OperatorRowMenuItem } from "./OperatorRowMenu";

/** `.el-avatar` (maketda `background: var(--sunken); color: var(--text-muted)`). */
const AVATAR = "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-text-muted";

/** `onSunken` — kulrang blok ichida (o'chirish oynasidagi ob'ekt kartasi): fon `surface` (maket). */
export const OperatorAvatar = ({ name, size = 36, onSunken = false }: { name: string; size?: 36 | 40; onSunken?: boolean }) => (
  <span
    aria-hidden="true"
    className={cx(AVATAR, onSunken ? "bg-surface" : "bg-sunken", size === 36 ? "size-9 text-[13px]" : "size-10 text-sm")}
  >
    {operatorInitials(name)}
  </span>
);

type OperatorsTableProps = {
  rows: readonly MarketOperator[];
  busy?: boolean;
  onCommission: (operator: MarketOperator) => void;
  onDelete: (operator: MarketOperator) => void;
};

/**
 * Operatorlar jadvali (maket `market-operators-list`): Operator (avatar + ism; planshetda ostida telefon) · Telefon
 * (< 1024 yashirin) · Komissiya (qiymat + izoh yoki «Belgilanmagan» + «Daromad yozilmaydi») · Holat (Faol / Nofaol +
 * «Tizimga kira olmaydi») · Qo'shilgan (< 1024 yashirin) · kebab. Telefonda (< 768) kartalar: avatar 40, ism, telefon,
 * komissiya va holat belgilari, kebab 44 px. Nofaol operator ismi kulrang.
 */
export const OperatorsTable = memo(({ rows, busy, onCommission, onDelete }: OperatorsTableProps) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const commission = useCommissionText();

  const statusBadge = useCallback(
    (row: MarketOperator) =>
      row.status === "active" ? (
        <Badge tone="success" dot>
          {t("status.active")}
        </Badge>
      ) : (
        <Badge tone="neutral" dot>
          {t("status.inactive")}
        </Badge>
      ),
    [t],
  );

  const rowMenu = useCallback(
    (row: MarketOperator) => {
      const items: OperatorRowMenuItem[] = [
        {
          key: "commission",
          label: hasCommission(row) ? t("rowMenu.changeCommission") : t("rowMenu.setCommission"),
          icon: Percent,
          onSelect: () => onCommission(row),
        },
        { key: "delete", label: t("rowMenu.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(row) },
      ];
      return <OperatorRowMenu label={t("rowMenu.label", { name: row.name })} items={items} />;
    },
    [onCommission, onDelete, t],
  );

  const nameClass = (row: MarketOperator) =>
    cx("font-semibold [overflow-wrap:anywhere]", row.status === "active" ? "text-text" : "text-text-muted");

  const columns = useMemo<DataTableColumn<MarketOperator>[]>(
    () => [
      {
        id: "operator",
        header: t("columns.operator"),
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <OperatorAvatar name={row.name} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={nameClass(row)}>{row.name}</span>
              {/* Planshetda «Telefon» ustuni yashirin — telefon ism ostida (maket `.el-show-tablet`). */}
              <span className="hidden whitespace-nowrap text-[13px] text-text-muted tabular-nums max-lg:block">
                {formatPhone(row.phone_number)}
              </span>
            </span>
          </div>
        ),
      },
      {
        id: "phone",
        header: t("columns.phone"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (row) => formatPhone(row.phone_number),
      },
      {
        id: "commission",
        header: t("columns.commission"),
        cell: (row) =>
          hasCommission(row) ? (
            <span className="flex flex-col gap-0.5">
              <span className="whitespace-nowrap font-semibold text-text tabular-nums">
                {commission.value(row.commission_type, row.commission_value)}
              </span>
              <span className="whitespace-nowrap text-[13px] text-text-muted">
                {commission.hint(row.commission_type)}
              </span>
            </span>
          ) : (
            <span className="flex flex-col items-start gap-1">
              <Badge tone="warning" dot>
                {t("commission.unset")}
              </Badge>
              <span className="text-[13px] text-text-muted">{t("commission.unsetHint")}</span>
            </span>
          ),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            {statusBadge(row)}
            {row.status === "inactive" ? (
              <span className="whitespace-nowrap text-[13px] text-text-muted">{t("status.inactiveHint")}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: t("columns.createdAt"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: (row) => formatDateTimeLocalized(row.created_at, { language }),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("columns.actions")}</span>,
        className: "w-16",
        cellClassName: "text-right",
        cell: rowMenu,
      },
    ],
    [commission, language, rowMenu, statusBadge, t],
  );

  const renderCard = useCallback(
    (row: MarketOperator) => (
      <div className="flex min-w-0 items-start gap-3 py-3 pr-2 pl-4">
        <OperatorAvatar name={row.name} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={nameClass(row)}>{row.name}</span>
          <span className="text-[13px] text-text-muted tabular-nums">{formatPhone(row.phone_number)}</span>
          <span className="mt-0.5 flex flex-wrap gap-1.5">
            {hasCommission(row) ? (
              <Badge tone="neutral" icon={row.commission_type === "percent" ? Percent : undefined}>
                {row.commission_type === "percent"
                  ? commission.value(row.commission_type, row.commission_value)
                  : commission.short(row.commission_type, row.commission_value)}
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                {t("commission.unsetLong")}
              </Badge>
            )}
            {statusBadge(row)}
          </span>
        </div>
        <span className="-my-1 shrink-0">{rowMenu(row)}</span>
      </div>
    ),
    [commission, rowMenu, statusBadge, t],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      label={t("list.label")}
      cardsLabel={t("list.label")}
      density="tablet-tight"
      renderCard={renderCard}
      busy={busy}
      className="border-t border-border"
    />
  );
});
OperatorsTable.displayName = "OperatorsTable";

/** Yuklanish skeleti — jadval bilan bir xil ustunlar (sakramasin); telefonda karta. */
const SKELETON_ROWS = [0, 1, 2, 3, 4];
const NAME_WIDTHS = ["62%", "48%", "70%", "56%", "64%"] as const;

export const OperatorsSkeleton = memo(() => {
  const { t } = useTranslation("marketOperators");
  const columns = useMemo<DataTableColumn<number>[]>(
    () => [
      {
        id: "operator",
        header: t("columns.operator"),
        cell: (index) => (
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton tone="border" shape="circle" width={36} height={36} />
            <Skeleton tone="border" width={NAME_WIDTHS[index]} />
          </div>
        ),
      },
      {
        id: "phone",
        header: t("columns.phone"),
        hideBelow: "lg",
        cell: () => <Skeleton tone="border" width={128} />,
      },
      {
        id: "commission",
        header: t("columns.commission"),
        cell: () => (
          <span className="flex flex-col gap-1.5">
            <Skeleton tone="border" width={48} />
            <Skeleton tone="border" width={140} height={10} />
          </span>
        ),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: () => <Skeleton tone="border" width={56} height={22} />,
      },
      {
        id: "createdAt",
        header: t("columns.createdAt"),
        hideBelow: "lg",
        cell: () => <Skeleton tone="border" width={112} />,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("columns.actions")}</span>,
        className: "w-16",
        cell: () => <Skeleton tone="border" shape="block" width={32} height={32} className="ml-auto" />,
      },
    ],
    [t],
  );
  const renderCard = useCallback(
    (index: number) => (
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        <Skeleton tone="border" shape="circle" width={40} height={40} />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton tone="border" width={NAME_WIDTHS[index]} height={14} />
          <Skeleton tone="border" width="46%" />
          <span className="flex gap-2">
            <Skeleton tone="border" width={56} height={22} />
            <Skeleton tone="border" width={56} height={22} />
          </span>
        </span>
      </div>
    ),
    [],
  );
  return (
    <div aria-hidden="true">
      <DataTable
        rows={SKELETON_ROWS}
        columns={columns}
        getRowKey={(index) => String(index)}
        density="tablet-tight"
        renderCard={renderCard}
        className="border-t border-border"
      />
    </div>
  );
});
OperatorsSkeleton.displayName = "OperatorsSkeleton";
