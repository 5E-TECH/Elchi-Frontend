// dizayn-v2: superadmin-branches-detail
import { memo, useCallback, useMemo } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RemoveEmployeeButton } from "../../../features/branch-remove-employee";
import { TransferCourierButton } from "../../../features/courier-transfer-branch";
import type { Employee } from "../../../entities/branch";
import { branchPositionKey, branchPositionLabel } from "../../../features/branch/lib/branchDisplay";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
  type QueryLike,
} from "../../../shared/ui/primitives";

interface BranchEmployeesSectionProps {
  branchId: string;
  /** `useBranchEmployees(branchId)` natijasi (yoki shunga o'xshash `{ data, isLoading, isError, refetch }`). */
  query: QueryLike<Employee[]>;
}

const isCourierRow = (employee: Employee) => branchPositionKey(employee.position) === "COURIER";

/**
 * «FILIAL XODIMLARI» (maket `superadmin-branches-detail`): jadval Xodim (ism + telefon) · Lavozim · Qo'shilgan
 * sana · Amallar; telefonda — kartalar («telefon · sana», lavozim badge'i, tugma to'liq enli).
 *
 * Amallar: menejer va ro'yxatchi — «Olib tashlash» (tasdiq bilan); kuryer — «Boshqa filialga o'tkazish»
 * (`TransferCourierButton`, faqat superadmin/admin ko'radi).
 */
const BranchEmployeesSection = ({ branchId, query }: BranchEmployeesSectionProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const joined = useCallback(
    (value: string) => (value ? formatDateLocalized(value, { language }) : "—"),
    [language],
  );
  const phone = (value: string) => (value && value !== "—" ? formatPhone(value) : "");

  // Kuryer qatorida "filialdan chiqarish" tugmasi DOIMIY yashirin:
  // filialsiz kuryer ishlay olmaydi va uning pulini hech kim (menejer ham,
  // superadmin ham) qabul qila olmaydi. Kuryer faqat "Boshqa filialga
  // o'tkazish" orqali ko'chiriladi — server avval kuryerda pul, buyurtma
  // va qaytarilmagan pochta yo'qligini tekshiradi (chiqarish ham serverda
  // xuddi shu tekshiruv bilan himoyalangan).
  const action = useCallback(
    (employee: Employee, fullWidth: boolean) =>
      isCourierRow(employee) ? (
        <TransferCourierButton
          variant="secondary"
          size="sm"
          fullWidth={fullWidth}
          courierId={employee.user.id}
          courierName={employee.user.fullName}
        />
      ) : (
        <RemoveEmployeeButton
          branchId={branchId}
          userId={employee.user.id}
          userName={employee.user.fullName}
          fullWidth={fullWidth}
        />
      ),
    [branchId],
  );

  const columns = useMemo<DataTableColumn<Employee>[]>(
    () => [
      {
        id: "user",
        header: t("employee.employee"),
        cell: (employee) => (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{employee.user.fullName}</div>
            {phone(employee.user.phone) ? (
              <div className="whitespace-nowrap text-[13px] text-text-muted">{phone(employee.user.phone)}</div>
            ) : null}
          </>
        ),
      },
      {
        id: "position",
        header: t("employee.position"),
        cell: (employee) => <Badge>{branchPositionLabel(employee.position, t)}</Badge>,
      },
      {
        id: "joined",
        header: t("employee.joinedDate"),
        className: "whitespace-nowrap",
        cell: (employee) => joined(employee.joined_at),
      },
      {
        id: "actions",
        header: t("table.actions"),
        align: "end",
        cell: (employee) => <div className="flex justify-end">{action(employee, false)}</div>,
      },
    ],
    [action, joined, t],
  );

  const renderCard = useCallback(
    (employee: Employee) => {
      const sub = [phone(employee.user.phone), joined(employee.joined_at)].filter(Boolean).join(" · ");
      return (
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold text-text [overflow-wrap:anywhere]">{employee.user.fullName}</span>
              <span className="text-[13px] text-text-muted">{sub}</span>
            </div>
            <Badge className="shrink-0">{branchPositionLabel(employee.position, t)}</Badge>
          </div>
          {action(employee, true)}
        </div>
      );
    },
    [action, joined, t],
  );

  return (
    <Card
      as="section"
      padding="none"
      divided
      title={t("employee.title")}
      description={t("v2.employees.description")}
    >
      <QueryBoundary
        query={query}
        loadingLabel={t("v2.employees.loading")}
        loading={
          <SkeletonTable
            framed={false}
            rows={4}
            columns={[t("employee.employee"), t("employee.position"), t("employee.joinedDate"), t("table.actions")]}
          />
        }
        empty={
          <EmptyState
            icon={Users}
            title={t("v2.employees.empty")}
            description={t("v2.employees.emptyDescription")}
          />
        }
        error={(error, retry) => <ErrorState error={error} title={t("v2.employees.loadFailed")} onRetry={retry} />}
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(employee) => employee.id || employee.user.id}
            label={t("employee.title")}
            cardsLabel={t("employee.title")}
            renderCard={renderCard}
            busy={isRefetching}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

export default memo(BranchEmployeesSection);
