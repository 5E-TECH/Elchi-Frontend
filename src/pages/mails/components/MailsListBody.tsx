// dizayn-v2: superadmin-mails-today, admin-mails-today, manager-mails-today, registrator-mails-today, courier-mails-today, courier-mails-tab-switcher-open, superadmin-mails-refused, admin-mails-refused, manager-mails-refused, registrator-mails-refused, courier-mails-refused
import type { ReactNode } from "react";
import { SearchX, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Skeleton,
  SkeletonList,
  SkeletonTable,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { MailsTabLayout } from "../model/mailsLayout";
import { summarizeMailRows, type MailListRow, type MailsListQuery } from "../model/mailsLists";
import MailSummaryStats from "./MailSummaryStats";
import { MailsTable, type MailsTableProps } from "./MailsTable";

/**
 * «BUGUNGI» VA «RAD ETILGAN» TAB TANASI — umumiy tuzilma (dizayn v2).
 *
 * `card` (xodim, qobiq kartasi ichida): asboblar qatori (`toolbarStart` — viloyat filtri yoki izoh, o'ngda
 * xulosa) → jadval (`border-t`). Yuklanish — jadval skeleti, xato — `ErrorState` + «Qayta urinish»,
 * bo'sh — `EmptyState`, filtr bo'sh qaytarsa — «Filtrni tozalash».
 *
 * `page` (kuryer, sahifa fonida): `note` (izoh) → ≥ 768 uchta `StatCard`, < 768 `phoneTop` (filtr) va xulosa
 * qatori → `Card` (≥ 768 sarlavha «Qabul qilinishi kerak» + filtr, keyin saralanadigan jadval; telefonda
 * kartalar). Telefonda yuklanish — xulosa chizig'i + 3 ta karta skeleti (maket `courier-mails-tab-switcher-open`).
 */
type MailsListBodyProps = {
  layout: MailsTabLayout;
  query: MailsListQuery;
  /** Filtrdan o'tgan qatorlar (jadval va xulosa shulardan). */
  rows: readonly MailListRow[];
  /** Filtr qo'llangan va natija bo'sh — «Filtrni tozalash». */
  onClearFilter?: () => void;
  /** Karta/jadval nomi: «Bugungi pochtalar». */
  ariaLabel: string;
  loadingLabel: string;
  empty: { icon: LucideIcon; title: string };
  /** Filtr bo'sh qaytargandagi sarlavha. */
  filterEmptyTitle?: string;
  /** Xulosaning birinchi soni: viloyatlar yoki pochtalar (kuryerda doim pochtalar). */
  summaryUnit: "regions" | "mails";
  /** `card`: asboblar qatorining chap qismi (filtr yoki izoh). */
  toolbarStart?: ReactNode;
  /** `card`: xulosa qolgan joyni egallaydi (maket: filtr 260 px, xulosa o'ngda). */
  summaryGrow?: boolean;
  /** `page`: birinchi `StatCard` nomi. */
  statsLabel?: string;
  /** `page`: karta sarlavhasi (≥ 768). */
  courierHead?: { title: string; description: string; action?: ReactNode };
  /** `page`: telefonda xulosadan oldin (filtr). */
  phoneTop?: ReactNode;
  /** `page`: eng tepadagi izoh (alert). */
  note?: ReactNode;
  table: Omit<MailsTableProps<MailListRow>, "rows" | "ariaLabel" | "busy" | "className">;
};

const MailsListBody = ({
  layout,
  query,
  rows,
  onClearFilter,
  ariaLabel,
  loadingLabel,
  empty,
  filterEmptyTitle,
  summaryUnit,
  toolbarStart,
  summaryGrow = false,
  statsLabel,
  courierHead,
  phoneTop,
  note,
  table,
}: MailsListBodyProps) => {
  const { t } = useTranslation("mailsShell");
  const isPhone = useIsPhone();
  const summary = summarizeMailRows(rows);
  const isPage = layout === "page";

  const tableColumns = [t("table.mail"), t("table.region"), t("table.status"), t("table.orders"), t("table.amount")];

  const emptyNode = <EmptyState icon={empty.icon} title={empty.title} />;
  const filterEmpty = (
    <EmptyState
      icon={SearchX}
      title={filterEmptyTitle ?? empty.title}
      action={
        onClearFilter ? (
          <Button variant="secondary" size="sm" onClick={onClearFilter}>
            {t("filter.clear")}
          </Button>
        ) : undefined
      }
    />
  );

  const renderTable = (busy: boolean, className?: string) =>
    rows.length > 0 ? (
      <MailsTable {...table} rows={rows} ariaLabel={ariaLabel} busy={busy} className={className} />
    ) : (
      <div className={className}>{filterEmpty}</div>
    );

  if (!isPage) {
    return (
      <QueryBoundary
        query={query}
        keepPreviousData={false}
        loadingLabel={loadingLabel}
        loading={<SkeletonTable framed={false} columns={tableColumns} rows={6} />}
        empty={emptyNode}
        error={(error, retry) => <ErrorState error={error} title={t("mails:loadError")} onRetry={retry} />}
      >
        {(_, { isRefetching }) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
              {toolbarStart}
              <MailSummaryStats
                variant="line"
                unit={summaryUnit}
                summary={summary}
                stackOnPhone
                className={cx("max-md:basis-full md:text-right", summaryGrow && "flex-[1000_1_auto]")}
              />
            </div>
            {renderTable(isRefetching, "border-t border-border")}
          </>
        )}
      </QueryBoundary>
    );
  }

  // Kuryer (`page`): bo'limlar sahifa fonida.
  const loading = isPhone ? (
    <div className="flex flex-col gap-2.5">
      <Skeleton width={236} height={10} className="my-1 max-w-full" />
      <Card padding="none">
        <SkeletonList rows={3} />
      </Card>
    </div>
  ) : (
    <Card padding="none">
      <SkeletonTable framed={false} columns={tableColumns} rows={4} />
    </Card>
  );

  return (
    <QueryBoundary
      query={query}
      keepPreviousData={false}
      loadingLabel={loadingLabel}
      loading={loading}
      empty={<Card padding="none">{emptyNode}</Card>}
      error={(error, retry) => (
        <Card padding="none">
          <ErrorState error={error} title={t("mails:loadError")} onRetry={retry} />
        </Card>
      )}
      className="flex min-w-0 flex-col gap-6 max-md:gap-4"
    >
      {(_, { isRefetching }) => (
        <>
          {note}
          {isPhone ? (
            <div className="flex min-w-0 flex-col gap-2.5">
              {phoneTop}
              <MailSummaryStats variant="line" unit="mails" summary={summary} />
            </div>
          ) : (
            <MailSummaryStats variant="cards" summary={summary} mailsLabel={statsLabel ?? ariaLabel} />
          )}
          <Card as="section" padding="none" aria-label={ariaLabel}>
            {!isPhone && courierHead ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="text-base font-bold text-text">{courierHead.title}</h2>
                  <p className="text-[13px] text-text-muted">{courierHead.description}</p>
                </div>
                {courierHead.action}
              </div>
            ) : null}
            {renderTable(isRefetching)}
          </Card>
        </>
      )}
    </QueryBoundary>
  );
};

export default MailsListBody;
