// dizayn-v2: investor-investments-list, investor-investments-list-loading, investor-investments-list-filtered-empty
import { PiggyBank, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  investorAccessProblem,
  useInvestorInvestments,
  type InvestorInvestment,
  type InvestorInvestmentsPage,
} from "../../entities/investors";
import { formatDateLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../shared/lib/formatMoney";
import { Meter } from "../../shared/ui/charts";
import {
  Button,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  Skeleton,
} from "../../shared/ui/primitives";
import { loadErrorText } from "./lib/format";
import {
  applyInvestorListSearch,
  INVESTOR_PAGE_SIZES,
  parseInvestmentsSearch,
  toInvestmentsParams,
  type InvestorListPatch,
} from "./model/listSearch";
import { InvestorAccessState } from "./ui/InvestorAccessState";
import { InvestorListSkeleton } from "./ui/InvestorListSkeleton";

/** Maket `investor-investments-list-loading`: 5 qator skelet. */
const SKELETON_ROWS = 5;

/**
 * «INVESTITSIYALAR» — `/investments` (IN-2, vpKijXce; maketlar `investor-investments-list`, `-loading`,
 * `-filtered-empty`). Faqat investor (`canViewInvestorCabinet`); `GET investors/me/investments?from_date&to_date&page
 * &limit` — doira JWT'dan, tartib `invested_at` DESC (serverda; sarlavhada saralash tugmasi yo'q).
 *
 *  - Karta sarlavhasi: filtrsiz — «Jami: X so'm · N ta» (`summary.total_amount` — BARCHA investitsiyalar);
 *    oraliq tanlanganda backend oraliq summasini bermaydi (N6 → IN-3): bitta sahifa bo'lsa — sahifa yig'indisi
 *    («Tanlangan oraliqda: X so'm · N ta»), aks holda faqat «Tanlangan oraliqda: N ta».
 *  - «Jamidagi hissasi» = summa / `summary.total_amount` (frontendda; «Ulush» so'zi — faqat KPI stavkasi).
 *  - `DateRange` («Barcha vaqt» — filtrsiz), oraliq Toshkent kuni bo'yicha (`toInvestmentsParams`).
 *  - Holatlar: yuklanish — jadval skeleti; filtrsiz bo'sh — bosh sahifa matni; oraliqda bo'sh — «Filtrni tozalash»;
 *    xato — `ErrorState` + «Qayta urinish»; 403 / 404 / 409 — bosh sahifadagi butun sahifa holati.
 *  - Filtr, sahifa va hajm URL'da (`listSearch.ts`). Eski javob (`isPlaceholderData`) paytida URL tuzatilmaydi va
 *    «bo'sh» holat chizilmaydi — yangi javob kelguncha (LG-2 saboqi).
 * Xom backend matni ko'rsatilmaydi; pul — `formatMoneyLocalized`, foiz — `formatPercentLocalized`.
 */
const InvestmentsPage = () => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseInvestmentsSearch(searchParams);
  const update = (patch: InvestorListPatch) =>
    setSearchParams((current) => applyInvestorListSearch(current, patch), { replace: true });

  const listQuery = useInvestorInvestments(toInvestmentsParams(search), { silentError: true });
  const data = listQuery.data;
  const fresh = data != null && !listQuery.isPlaceholderData;
  const filtered = Boolean(search.from || search.to);
  const filterKey = `${search.from}|${search.to}`;

  // Sarlavhadagi jami — faqat SHU oraliqning javobidan (boshqa oraliqning eski javobi ko'rsatilmaydi).
  const [settledKey, setSettledKey] = useState<string | null>(null);
  if (fresh && settledKey !== filterKey) setSettledKey(filterKey);
  const summaryData = settledKey === filterKey ? data : undefined;

  // Oxirgi sahifadan tashqarida (eski havola, yozuvlar kamaygan) — faqat YANGI javobdan: mavjud oxirgi sahifaga.
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
        <PageHeader title={t("investmentsPage.title")} description={t("investmentsPage.sub")} />
        <InvestorAccessState
          problem={problem}
          onRetry={() => void listQuery.refetch()}
          retrying={listQuery.isFetching}
        />
      </div>
    );
  }

  // Eski (boshqa oraliq/sahifa) javob bo'sh bo'lsa yoki sahifa tuzatilayotgan bo'lsa — bo'sh holat emas, yuklanish.
  // Oflayn (`isPaused`): so'rov yuborilmagan — skelet/bo'sh holat emas, «Internet aloqasi yo'q» (QueryBoundary
  // shartnomasi); eski oraliqning javobi ham ko'rsatilmaydi.
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
  const count = (value: number) => formatNumberLocalized(value, { language });

  const description = (() => {
    if (!summaryData) {
      return failed || paused ? undefined : <Skeleton width={180} height={12} className="mt-1.5" />;
    }
    // `count` — son (i18next ko'plik shakli uchun), `countText` — mahalliy formatdagi matn.
    const counts = { count: summaryData.meta.total, countText: count(summaryData.meta.total) };
    if (!filtered) return t("investmentsPage.total", { amount: money(summaryData.totalAmount), ...counts });
    // Oraliq yig'indisi — faqat oraliqning BARCHA yozuvlari shu javobda bo'lsa (sahifadan tashqari havola
    // `?page=3` → `items=[]`, `total=3` — «0 so'm» emas, faqat son).
    if (summaryData.items.length === summaryData.meta.total) {
      const sum = summaryData.items.reduce((acc, item) => acc + item.amount, 0);
      return t("investmentsPage.rangeTotal", { amount: money(sum), ...counts });
    }
    return t("investmentsPage.rangeCount", counts);
  })();

  const clearFilter = () => update({ from: "", to: "" });

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("investmentsPage.title")} description={t("investmentsPage.sub")} />

      <Card
        padding="none"
        title={t("investmentsPage.listTitle")}
        description={description}
        actions={
          <DateRange
            value={{ from: search.from, to: search.to }}
            onChange={({ from, to }) => update({ from, to })}
            placeholder={t("investmentsPage.allTime")}
            aria-label={t("investmentsPage.rangeLabel")}
            className="w-[260px] max-w-full"
          />
        }
        className="overflow-hidden"
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
              summary={(range) => t("investmentsPage.summary", { ...range, count: data.meta.total })}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={query}
          keepPreviousData={false}
          isEmpty={(page: InvestorInvestmentsPage) => page.items.length === 0}
          loadingLabel={t("investmentsPage.loading")}
          loading={<InvestorListSkeleton rows={SKELETON_ROWS} />}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("investments.errorTitle")}
              description={loadErrorText(t, error)}
              onRetry={retry}
              retrying={listQuery.isFetching}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title={t("investmentsPage.filteredTitle")}
                description={t("investmentsPage.filteredText", { amount: money(data?.totalAmount ?? 0) })}
                action={
                  <Button variant="secondary" onClick={clearFilter}>
                    {t("investmentsPage.clear")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={PiggyBank} title={t("investments.emptyTitle")} description={t("investments.emptyText")} />
            )
          }
        >
          {(page: InvestorInvestmentsPage) => (
            <InvestmentsTable rows={page.items} totalAmount={page.totalAmount} busy={listQuery.isPlaceholderData} />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

/**
 * Jadval (maket `investor-investments-list`): Kiritilgan sana · Summa · Jamidagi hissasi (o'lchagich + foiz).
 * Telefonda kartalar: summa, «Kiritilgan: 01.08.2026», o'ngda «22,2% hissa».
 */
const InvestmentsTable = ({
  rows,
  totalAmount,
  busy,
}: {
  rows: readonly InvestorInvestment[];
  totalAmount: number;
  busy?: boolean;
}) => {
  const { t, i18n } = useTranslation("investor");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  /** Jamidagi hissa (0..100) yoki `null` — jami 0 bo'lsa (bo'lishga bo'lmaydi). */
  const shareOf = (row: InvestorInvestment) => (totalAmount > 0 ? (row.amount / totalAmount) * 100 : null);
  const percent = (value: number | null) => (value == null ? "—" : formatPercentLocalized(value, { language }));

  return (
    <DataTable<InvestorInvestment>
      rows={rows}
      getRowKey={(row, index) => row.id || `investment-${index}`}
      label={t("investmentsPage.label")}
      cardsLabel={t("investmentsPage.label")}
      busy={busy}
      columns={[
        {
          id: "date",
          header: t("investmentsPage.colDate"),
          cell: (row) => <span className="font-semibold">{formatDateLocalized(row.investedAt)}</span>,
        },
        {
          id: "amount",
          header: t("investmentsPage.colAmount"),
          align: "end",
          cell: (row) => <span className="font-semibold whitespace-nowrap">{money(row.amount)}</span>,
        },
        {
          id: "share",
          header: t("investmentsPage.colShare"),
          align: "end",
          cell: (row) => {
            const share = shareOf(row);
            return (
              <span className="flex items-center justify-end gap-3">
                {share == null ? null : (
                  // `Meter` o'zi `w-full` — kenglik o'ramda (maket `.el-meter.is-thin`, 96px).
                  <span className="w-24 flex-none">
                    <Meter
                      value={share}
                      thickness="thin"
                      ariaLabel={`${formatDateLocalized(row.investedAt)} — ${t("investmentsPage.colShare")}`}
                    />
                  </span>
                )}
                <span className="min-w-12 text-right proportional-nums">{percent(share)}</span>
              </span>
            );
          },
        },
      ]}
      renderCard={(row) => (
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-text">{money(row.amount)}</span>
            <span className="text-[13px] text-text-muted">
              {t("investments.cardSub", { date: formatDateLocalized(row.investedAt) })}
            </span>
          </span>
          <span className="whitespace-nowrap text-[13px] text-text-muted">
            {t("investmentsPage.cardShare", { value: percent(shareOf(row)) })}
          </span>
        </div>
      )}
    />
  );
};

export default InvestmentsPage;
