// dizayn-v2: investor-profits-list, investor-profits-list-filtered-empty
import { HandCoins, SearchX } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { investorAccessProblem, useInvestorProfits, type InvestorProfitsPage } from "../../entities/investors";
import { formatMoneyLocalized } from "../../shared/lib/formatMoney";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  SegmentedControl,
  Skeleton,
} from "../../shared/ui/primitives";
import { loadErrorText } from "./lib/format";
import {
  applyInvestorListSearch,
  INVESTOR_PAGE_SIZES,
  parseProfitsSearch,
  PROFIT_STATUS_FILTERS,
  toProfitsParams,
  type InvestorListPatch,
  type ProfitStatusFilter,
} from "./model/listSearch";
import { InvestorAccessState } from "./ui/InvestorAccessState";
import { InvestorListSkeleton } from "./ui/InvestorListSkeleton";
import { ProfitHistoryTable } from "./ui/ProfitHistoryTable";

/** Yuklanish — `investor-investments-list-loading` naqshi (route-map izohi), 5 qator. */
const SKELETON_ROWS = 5;

const STATUS_LABEL: Record<ProfitStatusFilter, string> = {
  all: "profitsPage.statusAll",
  paid: "profitsPage.statusPaid",
  pending: "profitsPage.statusPending",
};

/**
 * «FOYDA TARIXI» — `/profits` (IN-2, vpKijXce; maketlar `investor-profits-list`, `-filtered-empty`). Faqat investor
 * (`canViewInvestorCabinet`); `GET investors/me/profits?is_paid&page&limit` — tartib `period_start` DESC (serverda,
 * saralash tugmasi yo'q); sana filtri backendda yo'q — chizilmaydi.
 *
 *  - Sarlavha: «To'langan: X · Kutilmoqda: Y» — `summary` (backend filtrdan qat'i nazar BARCHA yozuvlar bo'yicha).
 *  - «To'lov holati»: Barchasi · To'langan · Kutilmoqda (`SegmentedControl`, telefonda to'liq en, 44px).
 *  - Jadval — bosh sahifa bilan umumiy `ProfitHistoryTable` (planshetda «Foiz» va «To'langan sana» yashirin,
 *    telefonda kartalar), `Pagination`.
 *  - Holatlar: yuklanish — skelet; filtrsiz bo'sh — bosh sahifa matni; filtr bo'yicha bo'sh — «Filtrni tozalash»
 *    («Kutilmoqda» — maket matni, «To'langan» — maket yo'q, eng yaqini shu); xato — «Qayta urinish»;
 *    403 / 404 / 409 — bosh sahifadagi butun sahifa holati. Eski javob paytida URL tuzatilmaydi (LG-2 saboqi).
 */
const ProfitsPage = () => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseProfitsSearch(searchParams);
  const update = (patch: InvestorListPatch) =>
    setSearchParams((current) => applyInvestorListSearch(current, patch), { replace: true });

  const listQuery = useInvestorProfits(toProfitsParams(search), { silentError: true });
  const data = listQuery.data;
  const fresh = data != null && !listQuery.isPlaceholderData;
  const filtered = search.status !== "all";

  const outOfRange = Boolean(
    fresh && data && data.items.length === 0 && data.meta.total > 0 && search.page > data.meta.totalPages,
  );
  const lastPage = data?.meta.totalPages ?? 1;
  useEffect(() => {
    if (outOfRange) setSearchParams((current) => applyInvestorListSearch(current, { page: lastPage }), { replace: true });
  }, [lastPage, outOfRange, setSearchParams]);

  const problem = investorAccessProblem(listQuery.error);
  if (problem && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader title={t("profitsPage.title")} description={t("profitsPage.sub")} />
        <InvestorAccessState
          problem={problem}
          onRetry={() => void listQuery.refetch()}
          retrying={listQuery.isFetching}
        />
      </div>
    );
  }

  // Oflayn (`isPaused`) — «Internet aloqasi yo'q», skelet emas (QueryBoundary shartnomasi).
  const paused = listQuery.isPaused;
  const settling = !paused && ((listQuery.isPlaceholderData && !data?.items.length) || outOfRange);
  const failed = listQuery.isError && !data;
  const query = {
    data: failed || settling || (paused && listQuery.isPlaceholderData) ? undefined : data,
    isLoading: (listQuery.isPending && !paused) || settling,
    isPaused: paused,
    isError: failed,
    error: listQuery.error,
    refetch: () => void listQuery.refetch(),
  };

  const money = (value: number) => formatMoneyLocalized(value, { language });
  // Jami summalar filtrga bog'liq emas — eski javobdan ham to'g'ri (bir xil investor).
  const description = data ? (
    <>
      <span className="whitespace-nowrap">{t("profitsPage.paidTotal", { amount: money(data.totalPaid) })}</span>
      {" · "}
      <span className="whitespace-nowrap">{t("profitsPage.unpaidTotal", { amount: money(data.totalUnpaid) })}</span>
    </>
  ) : failed || paused ? undefined : (
    <Skeleton width={240} height={12} className="mt-1.5" />
  );

  const clearFilter = () => update({ status: "all" });

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("profitsPage.title")} description={t("profitsPage.sub")} />

      <Card
        padding="none"
        title={t("profitsPage.listTitle")}
        description={description}
        // Telefonda «To'lov holati» to'liq en (maket; `MarketSalesCard` naqshi).
        className="overflow-hidden max-md:[&>div:first-child>div:last-child]:w-full"
        actions={
          <div className="max-md:w-full">
            <SegmentedControl<ProfitStatusFilter>
              ariaLabel={t("profitsPage.statusLabel")}
              value={search.status}
              onValueChange={(status) => update({ status })}
              options={PROFIT_STATUS_FILTERS.map((value) => ({ value, label: t(STATUS_LABEL[value]) }))}
            />
          </div>
        }
        footer={
          data && data.meta.total > 0 && data.items.length > 0 && !failed ? (
            <Pagination
              page={data.meta.page}
              pageSize={data.meta.limit}
              total={data.meta.total}
              pageSizeOptions={INVESTOR_PAGE_SIZES}
              onPageChange={(page) => update({ page })}
              onPageSizeChange={(limit) => update({ limit })}
              disabled={listQuery.isPlaceholderData}
              summary={(range) => t("profitsPage.summary", { ...range, count: data.meta.total })}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={query}
          keepPreviousData={false}
          isEmpty={(page: InvestorProfitsPage) => page.items.length === 0}
          loadingLabel={t("profitsPage.loading")}
          loading={<InvestorListSkeleton rows={SKELETON_ROWS} widths={["22%", "14%", "16%", "12%"]} />}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("profits.errorTitle")}
              description={loadErrorText(t, error)}
              onRetry={retry}
              retrying={listQuery.isFetching}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title={t(search.status === "paid" ? "profitsPage.paidEmptyTitle" : "profitsPage.pendingEmptyTitle")}
                description={t(search.status === "paid" ? "profitsPage.paidEmptyText" : "profitsPage.pendingEmptyText")}
                action={
                  <Button variant="secondary" onClick={clearFilter}>
                    {t("profitsPage.clear")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={HandCoins} title={t("profits.emptyTitle")} description={t("profits.emptyText")} />
            )
          }
        >
          {(page: InvestorProfitsPage) => (
            <ProfitHistoryTable rows={page.items} label={t("profitsPage.label")} busy={listQuery.isPlaceholderData} />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default ProfitsPage;
