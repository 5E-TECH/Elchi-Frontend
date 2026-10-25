// dizayn-v2: superadmin-branches-detail, superadmin-branches-add-employee-dialog
import { Fragment, useState, type ReactNode } from "react";
import { CalendarDays, MapPin, Pencil, UserPlus, Users, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Branch, Employee } from "../../../entities/branch";
import { AddEmployeeModal } from "../../../features/branch-add-employee";
import { BranchEditModal } from "../../../features/branch-edit";
import {
  branchStatusLabel,
  branchStatusTone,
  branchTypeLabel,
  knownText,
} from "../../../features/branch/lib/branchDisplay";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, PageHeader, type QueryLike } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import BranchEmployeesSection from "./BranchEmployeesSection";

interface BranchDetailWidgetProps {
  branchId: string;
  branch: Branch;
  /** `useBranchEmployees(branchId)` — sahifa filial bilan parallel so'raydi. */
  employeesQuery: QueryLike<Employee[]>;
  /** «Filial ko'rsatkichlari» bo'limi (maketda ma'lumot kartasi va xodimlar orasida). */
  metrics?: ReactNode;
}

/** `.el-stat-icon` — neytral, rangsiz (CODE-MAP 2.4). */
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

type InfoItem = { key: string; icon: LucideIcon; label: string; value: string; sub: string };

/**
 * FILIAL TAFSILOTI — `/branches/:id` (faqat superadmin), dizayn v2 (maket `superadmin-branches-detail`).
 *
 * Sarlavha: «← Filiallar», nom + holat badge'i, «{kod} · {tur} · Yuqori filial: {nom}» (yuqori filial —
 * havola), amallar «Tahrirlash» (secondary) va «Xodim qo'shish» (asosiy). «Filial ma'lumotlari» kartasi:
 * Joylashuv (tuman; «viloyat, manzil») · Xodimlar «{n} ta» · Yaratilgan sana (telefonda ixcham: joylashuv
 * tepada, ikkalasi pastda yonma-yon). Keyin «Filial ko'rsatkichlari» (`metrics` — sahifa beradi:
 * `pages/branches/ui/BranchMetricsSection.tsx`, `GET /analytics/dashboard?branch_id=`, 6CYRjoZG) va
 * «Filial xodimlari».
 */
const BranchDetailWidget = ({ branchId, branch, employeesQuery, metrics }: BranchDetailWidgetProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);

  const code = knownText(branch.code);
  const parentName = knownText(branch.parent?.name);
  const parentId = branch.parent?.id || branch.parent_id || "";
  const subtitle: ReactNode[] = [code, branchTypeLabel(branch.type, t)].filter(Boolean);
  if (parentName) {
    subtitle.push(
      <span key="parent">
        {t("v2.detail.parentLabel")}{" "}
        {parentId ? (
          <Link
            to={`/branches/${encodeURIComponent(parentId)}`}
            // Telefonda bosish maydoni ≥ 44 px (qator balandligi o'zgarmaydi: padding manfiy chekka bilan).
            className="font-semibold text-action-fg hover:text-action-hover hover:underline max-md:-my-[13px] max-md:inline-block max-md:py-[13px]"
          >
            {parentName}
          </Link>
        ) : (
          <span className="font-semibold text-text">{parentName}</span>
        )}
      </span>,
    );
  }
  const description = subtitle.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? " · " : null}
      {part}
    </Fragment>
  ));

  const district = knownText(branch.district?.name);
  const region = knownText(branch.region?.name);
  const address = knownText(branch.address);
  const employees = Number(branch.employees_count ?? 0);
  const info: InfoItem[] = [
    {
      key: "location",
      icon: MapPin,
      label: t("detail.location"),
      value: district || region || "—",
      sub: [district ? region : "", address].filter(Boolean).join(", "),
    },
    {
      key: "employees",
      icon: Users,
      label: t("detail.employees"),
      value: t("v2.list.employees", { count: employees, value: formatNumberLocalized(employees, { language }) }),
      sub: t("v2.detail.employeesHint"),
    },
    {
      key: "created",
      icon: CalendarDays,
      label: t("detail.createdDate"),
      value: branch.created_at ? formatDateLocalized(branch.created_at, { language }) : "—",
      sub: t("v2.detail.createdHint"),
    },
  ];

  const infoValue = (item: InfoItem, compact: boolean) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={cx("text-text-muted", compact ? "text-xs" : "text-[13px]")}>{item.label}</span>
      <span className="truncate font-semibold text-text">{item.value}</span>
      {!compact && item.sub ? <span className="text-xs text-text-muted">{item.sub}</span> : null}
    </div>
  );

  const infoCard = isPhone ? (
    <Card as="section" padding="none" aria-label={t("v2.detail.infoLabel")}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span aria-hidden="true" className={STAT_ICON}>
          <MapPin size={18} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-text-muted">{info[0].label}</span>
          <span className="font-semibold text-text">{info[0].value}</span>
          {info[0].sub ? <span className="text-[13px] text-text-muted">{info[0].sub}</span> : null}
        </div>
      </div>
      <div className="flex border-t border-border">
        {info.slice(1).map((item, index) => (
          <div
            key={item.key}
            className={cx(
              "flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-4 pr-3",
              index > 0 && "border-l border-border",
            )}
          >
            <span aria-hidden="true" className={STAT_ICON}>
              <item.icon size={18} strokeWidth={2} />
            </span>
            {infoValue(item, true)}
          </div>
        ))}
      </div>
    </Card>
  ) : (
    <Card as="section" aria-label={t("v2.detail.infoLabel")}>
      <div className="grid grid-cols-3 gap-x-4 gap-y-5">
        {info.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className={STAT_ICON}>
              <item.icon size={18} strokeWidth={2} />
            </span>
            {infoValue(item, false)}
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/branches"
        backLabel={t("page.title")}
        title={branch.name}
        meta={
          <Badge tone={branchStatusTone(branch.status)} dot>
            {branchStatusLabel(branch.status, t)}
          </Badge>
        }
        description={description.length ? description : undefined}
        actions={
          <>
            <Button variant="secondary" leftIcon={Pencil} onClick={() => setIsEditOpen(true)}>
              {t("actions.edit")}
            </Button>
            <Button leftIcon={UserPlus} onClick={() => setIsAddEmployeeOpen(true)}>
              {t("employee.add")}
            </Button>
          </>
        }
      />

      {infoCard}

      {metrics}

      <BranchEmployeesSection branchId={branchId} query={employeesQuery} />

      <BranchEditModal open={isEditOpen} initialData={branch} onClose={() => setIsEditOpen(false)} />
      <AddEmployeeModal
        branchId={branchId}
        branchName={branch.name}
        open={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
      />
    </div>
  );
};

export default BranchDetailWidget;
