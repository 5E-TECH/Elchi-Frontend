// dizayn-v2: (maket yo'q) superadmin-neworders-cancelled-handover
import { memo, useCallback, useId, useMemo, useState } from "react";
import { PackageX, RotateCcw, UserRound } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCancelledHandoverBatch } from "../../../entities/orders/cancelledHandovers";
import type { OrderListItem } from "../../../entities/order/types/order";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import {
  DEFAULT_MARKET_ORDERS_SORT,
  sortMarketOrders,
  type MarketOrder,
} from "../components/marketOrders/marketOrdersModel";
import { toOrderCardData } from "./cancelledModel";
import { formatDayDots, formatTashkentTime, handoverMarketName } from "./handedModel";
import { CancelledOrdersTable } from "./ui/CancelledOrdersTable";
import { HandoverMethodBadges } from "./ui/HandoverMethodBadges";

const STRONG = <strong className="font-semibold text-text" />;

const httpStatusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/**
 * «Bekor qilinganlar → Topshirilgan» kartasi bosilganda (`/new-orders/cancelled/handovers/:batchId`; superadmin,
 * admin, HQ registratori): o'sha BITTA «Marketga jo'natish» bilan marketga berilgan buyurtmalar. Sarlavha — market,
 * izoh — vaqt · son · jami, ostida usul va topshirgan xodim. Faqat ko'rish (amal yo'q).
 */
const CancelledHandoverBatch = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { batchId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const titleId = useId();
  const query = useCancelledHandoverBatch(batchId);
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_MARKET_ORDERS_SORT);

  // Ro'yxatdagi filtrlar (qidiruv, sana, sahifa) bilan qaytish.
  const fromSearch = (location.state as { fromSearch?: unknown } | null)?.fromSearch;
  const backTo = `/new-orders/cancelled${typeof fromSearch === "string" && fromSearch ? fromSearch : "?tab=handed"}`;

  const number = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);

  const batch = query.data?.batch ?? null;
  const rows = useMemo<MarketOrder[]>(
    () => (query.data?.orders ?? []).map((order) => toOrderCardData(order as OrderListItem)),
    [query.data],
  );
  const sortedRows = useMemo(() => sortMarketOrders(rows, sort), [rows, sort]);

  const status = httpStatusOf(query.error);
  const notFound = query.isError && (status === 404 || status === 400);

  if (notFound) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader back={backTo} backLabel={t("cancelled.batch.back")} title={t("cancelled.batch.titleFallback")} />
        <Card padding="none">
          <EmptyState
            icon={PackageX}
            title={t("cancelled.batch.notFoundTitle")}
            description={t("cancelled.batch.notFoundDescription")}
            action={
              <Button variant="secondary" onClick={() => navigate(backTo)}>
                {t("cancelled.batch.backToList")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const title = batch
    ? handoverMarketName(batch, (id) => t("cancelled.handed.marketFallback", { id }))
    : query.isLoading
      ? <Skeleton width={224} height={32} />
      : t("cancelled.batch.titleFallback");

  const description = batch ? (
    <>
      <span className="whitespace-nowrap tabular-nums">
        {formatDayDots(batch.day)} {formatTashkentTime(batch.handed_at)}
      </span>
      {" · "}
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey="cancelled.batch.summaryOrders"
          count={batch.orders_count}
          values={{ value: number(batch.orders_count) }}
          components={{ strong: STRONG }}
        />
      </span>
      {" · "}
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey="cancelled.batch.summaryTotal"
          values={{ amount: money(batch.total_price_sum) }}
          components={{ strong: STRONG }}
        />
      </span>
    </>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader back={backTo} backLabel={t("cancelled.batch.back")} title={title} description={description}>
        {batch ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-text-muted">
            <HandoverMethodBadges batch={batch} />
            <span className="inline-flex items-center gap-1">
              <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
              {t("cancelled.batch.handedBy", {
                name: batch.handed_by?.name || t("cancelled.handed.staffUnknown"),
              })}
            </span>
          </div>
        ) : null}
      </PageHeader>

      <Card as="section" padding="none" aria-labelledby={titleId}>
        <h2 id={titleId} className="px-5 py-4 text-base font-bold text-text max-md:px-4">
          {t("cancelled.batch.listTitle")}
        </h2>
        <QueryBoundary
          query={{
            data: query.data ? sortedRows : undefined,
            isLoading: query.isLoading,
            isError: query.isError,
            error: query.error,
            refetch: query.refetch,
          }}
          skeleton="table"
          loadingLabel={t("cancelled.batch.loading")}
          empty={
            <EmptyState
              icon={RotateCcw}
              title={t("cancelled.batch.emptyTitle")}
              description={t("cancelled.batch.emptyDescription")}
            />
          }
          className="border-t border-border"
        >
          {(_list, { isRefetching }) => (
            <CancelledOrdersTable
              variant="market"
              linkOrders
              rows={sortedRows}
              label={t("cancelled.batch.tableLabel")}
              sort={sort}
              onSortChange={setSort}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(CancelledHandoverBatch);
