// dizayn-v2: superadmin-neworders-branches, admin-neworders-branches
import { memo, useCallback, useMemo } from "react";
import { Inbox } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useBranchesWithSentBatches } from "../../../entities/branch";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { EmptyState } from "../../../shared/ui/primitives";
import type { TodayMarketsTotals } from "../model/todayMarkets";
import { SourceListCard } from "../ui/SourceListCard";
import { toBranchSourceRows, type BranchSourceRow } from "./branchBatchesModel";

const STRONG = <strong className="font-semibold text-text" />;

/** Qobiq tabidagi son bilan bir xil kalit (`useNewOrdersTabs` → `useBranchesWithSentBatches(undefined)`). */
const SENT_BATCH_PARAMS = { side: "source", direction: "FORWARD" } as const;

/**
 * «QABUL VA YARATISH» → «Filial paketlari» (`/new-orders/branches`, superadmin/admin; qobiq `hosted`).
 *
 * HQ ga paket (transfer batch) yuborgan va hali qabul qilinmagan filiallar: karta qobiq tablari bilan
 * boshlanadi, ostida qidiruv + xulosa («3 ta filial · 9 ta paket · jami …») va jadval (telefonda kartalar).
 * Qidiruv va saralash mijoz tomonida (`SourceListCard`); filial bosilsa — uning paketlari.
 */
const BranchBatchesPage = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;

  const query = useBranchesWithSentBatches(SENT_BATCH_PARAMS);
  const rows = useMemo(() => toBranchSourceRows(query.data), [query.data]);

  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);

  const summaryPart = useCallback(
    (key: string, value: number, values?: Record<string, unknown>) => (
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey={key}
          count={values ? undefined : value}
          values={values ?? { value: count(value) }}
          components={{ strong: STRONG }}
        />
      </span>
    ),
    [count, t],
  );

  const summary = useCallback(
    (totals: TodayMarketsTotals) => (
      <p className="text-[13px] leading-[18px] text-text-muted">
        {summaryPart("branchBatches.list.summaryBranches", totals.markets)}
        {" · "}
        {summaryPart("branchBatches.list.summaryBatches", totals.orders)}
        {" · "}
        {summaryPart("markets.summaryTotal", totals.amount, { amount: money(totals.amount) })}
      </p>
    ),
    [money, summaryPart],
  );

  return (
    <SourceListCard<BranchSourceRow>
      rows={rows}
      query={query}
      ariaLabel={t("markets.cardLabel")}
      searchPlaceholder={t("branchBatches.list.searchPlaceholder")}
      searchLabel={t("branchBatches.list.searchLabel")}
      listLabel={t("branchBatches.list.listLabel")}
      loadingLabel={t("branchBatches.list.loading")}
      columns={{
        name: t("branchBatches.list.columns.branch"),
        phone: t("branchBatches.list.columns.phone"),
        count: t("branchBatches.list.columns.batches"),
        amount: t("branchBatches.list.columns.amount"),
        actions: t("branchBatches.list.columns.actions"),
      }}
      sortTitles={{
        name: t("branchBatches.list.sortByName"),
        count: t("branchBatches.list.sortByBatches"),
        amount: t("branchBatches.list.sortByAmount"),
      }}
      countCell={(value) => t("branchBatches.list.batchesCell", { value: count(value) })}
      cardSub={(row) => (
        <>
          {formatPhone(row.phone_number) || "—"} ·{" "}
          {t("branchBatches.list.batchesSub", { count: row.orders_count, value: count(row.orders_count) })}
        </>
      )}
      openLabel={(row) => t("branchBatches.list.open", { name: row.name })}
      hrefOf={(row) => `/new-orders/branches/${row.id}`}
      summary={summary}
      empty={
        <EmptyState
          icon={Inbox}
          title={t("branchBatches.list.emptyTitle")}
          description={t("branchBatches.list.emptyDescription")}
        />
      }
      noMatch={{
        title: t("branchBatches.list.noMatchTitle"),
        description: t("branchBatches.list.noMatchDescription"),
        clear: t("branchBatches.list.clearSearch"),
      }}
    />
  );
};

export default memo(BranchBatchesPage);
