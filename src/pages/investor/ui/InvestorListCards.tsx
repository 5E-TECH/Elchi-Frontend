// dizayn-v2: investor-dashboard-home, investor-dashboard-empty, investor-dashboard-loading
import { ChevronRight, HandCoins, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { InvestorInvestmentsPage, InvestorProfitsPage } from "../../../entities/investors";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import {
  buttonClasses,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonTable,
} from "../../../shared/ui/primitives";
import { loadErrorText } from "../lib/format";
import { ProfitHistoryTable } from "./ProfitHistoryTable";

/** Ro'yxat bloki so'rovi — faqat sahifa o'qiydigan qismi. */
type ListQuery<T> = {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

/**
 * Pastki ikki blok (maket `investor-dashboard-home`): «So'nggi investitsiyalar» (1 qism) va «Foyda tarixi» (2 qism)
 * yonma-yon, tor joyda ustma-ust. Har biri o'z so'rovi bilan mustaqil: biri yiqilsa, ikkinchisi va yuqoridagi KPI
 * ishlayveradi (maket `dashboard-error`). Sarlavhada «Barchasi ›» → `/investments`, `/profits` (IN-2); ro'yxat
 * bo'sh kelgan bo'lsa havola yo'q (maket `investor-dashboard-empty`).
 */
export const InvestorListCards = ({
  investments,
  profits,
}: {
  investments: ListQuery<InvestorInvestmentsPage>;
  profits: ListQuery<InvestorProfitsPage>;
}) => (
  <div className="flex flex-wrap items-stretch gap-4 max-md:gap-3">
    <RecentInvestmentsCard query={investments} />
    <ProfitHistoryCard query={profits} />
  </div>
);

/** «Barchasi ›» (maket `.el-btn-link.el-btn-sm`, `aria-label` — to'liq nom). Bo'sh ro'yxatda chizilmaydi. */
const AllLink = ({ to, label, hidden }: { to: string; label: string; hidden: boolean }) => {
  const { t } = useTranslation("investor");
  if (hidden) return null;
  return (
    <Link to={to} aria-label={label} className={buttonClasses({ variant: "link", size: "sm", className: "-mr-1" })}>
      {t("allLink")}
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
};

const ListState = <T,>({
  query,
  skeletonColumns,
  skeletonRows,
  errorTitle,
  isEmpty,
  empty,
  children,
}: {
  query: ListQuery<T>;
  skeletonColumns: readonly string[];
  /** Maket `investor-dashboard-loading`: investitsiyalar — 3, foyda tarixi — 5 qator (so'rov `limit` i bilan bir xil). */
  skeletonRows: number;
  errorTitle: string;
  isEmpty: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}) => {
  const { t } = useTranslation(["investor", "ui"]);
  if (query.isPending) {
    return <SkeletonTable framed={false} rows={skeletonRows} mobileRows={skeletonRows} columns={skeletonColumns} />;
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        error={query.error}
        title={errorTitle}
        description={loadErrorText(t, query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const data = query.data as T;
  return isEmpty(data) ? empty : children(data);
};

const RecentInvestmentsCard = ({ query }: { query: ListQuery<InvestorInvestmentsPage> }) => {
  const { t, i18n } = useTranslation("investor");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });

  return (
    <Card
      padding="none"
      title={t("investments.title")}
      description={
        query.data ? (
          t("investments.total", { amount: money(query.data.totalAmount) })
        ) : query.isPending ? (
          <Skeleton width={140} height={12} className="mt-1" />
        ) : undefined
      }
      actions={
        <AllLink
          to="/investments"
          label={t("investments.allLabel")}
          hidden={query.data != null && query.data.items.length === 0}
        />
      }
      className="min-w-0 flex-[1_1_340px]"
    >
      <ListState
        query={query}
        skeletonRows={3}
        skeletonColumns={[t("investments.colDate"), t("investments.colAmount")]}
        errorTitle={t("investments.errorTitle")}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState icon={PiggyBank} title={t("investments.emptyTitle")} description={t("investments.emptyText")} />}
      >
        {(data) => (
          <DataTable
            rows={data.items}
            getRowKey={(row, index) => row.id || `investment-${index}`}
            label={t("investments.label")}
            cardsLabel={t("investments.label")}
            busy={query.isFetching && !query.isPending}
            columns={[
              {
                id: "date",
                header: t("investments.colDate"),
                cell: (row) => <span className="font-semibold">{formatDateLocalized(row.investedAt)}</span>,
              },
              {
                id: "amount",
                header: t("investments.colAmount"),
                align: "end",
                cell: (row) => <span className="font-semibold">{money(row.amount)}</span>,
              },
            ]}
            renderCard={(row) => (
              <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3">
                <span className="font-semibold text-text">{money(row.amount)}</span>
                <span className="text-[13px] text-text-muted">
                  {t("investments.cardSub", { date: formatDateLocalized(row.investedAt) })}
                </span>
              </div>
            )}
          />
        )}
      </ListState>
    </Card>
  );
};

const ProfitHistoryCard = ({ query }: { query: ListQuery<InvestorProfitsPage> }) => {
  const { t } = useTranslation("investor");
  return (
    <Card
      padding="none"
      title={t("profits.title")}
      description={t("profits.sub")}
      actions={
        <AllLink to="/profits" label={t("profits.allLabel")} hidden={query.data != null && query.data.items.length === 0} />
      }
      className="min-w-0 flex-[2_1_520px] max-md:flex-[1_1_100%]"
    >
      <ListState
        query={query}
        skeletonRows={5}
        skeletonColumns={[
          t("profits.colPeriod"),
          t("profits.colPercent"),
          t("profits.colAmount"),
          t("profits.colStatus"),
          t("profits.colPaidAt"),
        ]}
        errorTitle={t("profits.errorTitle")}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState icon={HandCoins} title={t("profits.emptyTitle")} description={t("profits.emptyText")} />}
      >
        {(data) => <ProfitHistoryTable rows={data.items} busy={query.isFetching && !query.isPending} />}
      </ListState>
    </Card>
  );
};
