// dizayn-v2: superadmin-balance-overview, admin-balance-overview, superadmin-balance-history, admin-balance-history, superadmin-balance-analysis, admin-balance-analysis
import { memo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, Info, Plus, Scale, Store, Truck, Wallet } from "lucide-react";
import { useCashBox } from "../../entities/payments";
import { API_ENDPOINTS } from "../../shared/api/endpoints";
import { getTodayRange, type ISODateRange } from "../../shared/lib/dateRange";
import { downloadXlsx, getExportErrorMessage } from "../../shared/lib/exportFile";
import { formatCompactMoneyLocalized } from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonLines,
  StatCard,
  Tabs,
  getPanelId,
  getTabId,
} from "../../shared/ui/primitives";
import AnalysisTab, { type AnalysisPreset } from "./components/AnalysisTab";
import FinancialEntryModal from "./components/FinancialEntryModal";
import HistoryTab from "./components/HistoryTab";
import SettlementRanks from "./components/SettlementRanks";
import Statistics from "./components/Statistics";
import { splitCompact } from "./lib/balanceFormat";
import { HISTORY_PARAM_PREFIX, normalizeFinancialBalance } from "./lib/financialBalance";
import { buildHistoryExportParams, buildRangeExportParams, readHistoryFilters } from "./lib/historyFilters";

const FINANCIAL_BALANCE_TABS = ["overview", "history", "analysis"] as const;
type FinancialBalanceTab = (typeof FINANCIAL_BALANCE_TABS)[number];

const TABS_ID = "financial-balance-tabs";

const isFinancialBalanceTab = (value: string | null): value is FinancialBalanceTab =>
  FINANCIAL_BALANCE_TABS.includes(value as FinancialBalanceTab);

/**
 * BALANS — `/financial-balance` (superadmin, admin), dizayn v2.
 * Maketlar: `superadmin-balance-overview|history|analysis` (admin — o'sha fragmentlar), dialoglar
 * `*-balance-entry-dialog`, `*-balance-history-detail-dialog`; grafiklar — `tizim-charts`.
 *
 * Har tabda: sarlavha («Excelga yuklash» — faol tab paramlari bilan; «Yozuv qo'shish» — qo'lda daftar
 * yozuvi), 4 ko'rsatkich (kassa, yo'ldagi pul, marketlar qarzi, umumiy balans) va formula izohi, tablar
 * (`?tab=`). KPI kunlik o'zgarishi va 14 kunlik chizig'i maketda «Taklif» (kunlik snapshot yo'q) — chizilmaydi.
 */
const FinancialBalance = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetFinancialBalance } = useCashBox();
  const balanceQuery = useGetFinancialBalance();
  const { data: response, isLoading, isError, error, refetch } = balanceQuery;
  const dataUpdatedAt = (balanceQuery as { dataUpdatedAt?: number }).dataUpdatedAt;
  const data = normalizeFinancialBalance(response);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: FinancialBalanceTab = isFinancialBalanceTab(rawTab) ? rawTab : "overview";
  const [entryOpen, setEntryOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Tahlil davri sahifada turadi: «Excelga yuklash» Tahlil tabida aynan shu davr bilan yuklaydi.
  const [analysisRange, setAnalysisRange] = useState<ISODateRange>(getTodayRange);
  // Bosilgan tez tanlov ham shu yerda: dushanba «Bu hafta» = «Bugun» oralig'i — tab almashib qaytganda tanlov yo'qolmasin.
  const [analysisPreset, setAnalysisPreset] = useState<AnalysisPreset | null>(null);

  // Tab almashganda Tarixning sahifa/filtr parametrlari tozalanadi — aks holda
  // keyingi safar "Tarix" ochilganda eski sahifa/filtrga jimgina tushib qoladi.
  const selectTab = (tab: FinancialBalanceTab) => {
    if (tab === activeTab) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        Array.from(next.keys())
          .filter((key) => key.startsWith(HISTORY_PARAM_PREFIX))
          .forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  };

  // Eksport — faol tab paramlari bilan: Tarix — jadvaldagi AYNAN o'sha filtrlar; Tahlil — tanlangan davr;
  // Umumiy — paramsiz (butun daftar). Endpoint va fayl nomi o'zgarmaydi; `exporting` — ikki marta bosish qulfi.
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params =
        activeTab === "history"
          ? buildHistoryExportParams(readHistoryFilters(searchParams))
          : activeTab === "analysis"
            ? buildRangeExportParams(analysisRange)
            : {};
      await downloadXlsx(API_ENDPOINTS.EXPORT.FINANCIAL_BALANCE_XLSX, params, "financial-balance.xlsx");
    } catch (exportError) {
      notify.error(t("excelExportError"), { description: await getExportErrorMessage(exportError) });
    } finally {
      setExporting(false);
    }
  };

  const compact = (value: number) => splitCompact(formatCompactMoneyLocalized(value, { language }));
  const total = data?.currentSituation ?? 0;
  const isNegative = total < 0;
  const marketsDebt = -Math.abs(data?.markets.marketsTotalBalans ?? 0);

  const kpis = [
    { key: "cash", label: t("v2Balance.kpi.cash"), icon: Wallet, value: data?.main.balance ?? 0 },
    { key: "receivable", label: t("v2Balance.kpi.receivable"), icon: Truck, value: data?.receivable ?? 0 },
    { key: "markets", label: t("v2Balance.kpi.marketsDebt"), icon: Store, value: marketsDebt },
  ];

  const tabs = [
    { value: "overview" as const, label: t("v2Balance.tabs.overview") },
    { value: "history" as const, label: t("v2Balance.tabs.history") },
    { value: "analysis" as const, label: t("v2Balance.tabs.analysis") },
  ];

  const renderKpis = () => {
    if (isError) {
      return (
        <ErrorState framed error={error} title={t("v2Balance.state.loadFailed")} onRetry={() => void refetch()} />
      );
    }
    if (!isLoading && !data) {
      return (
        <EmptyState
          framed
          icon={Scale}
          title={t("v2Balance.state.empty")}
          description={t("v2Balance.state.emptyDescription")}
        />
      );
    }
    const totalValue = compact(total);
    return (
      <div className="flex flex-col gap-2">
        <section
          aria-label={t("v2Balance.kpi.label")}
          className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3"
        >
          {kpis.map((kpi) => {
            const value = compact(kpi.value);
            return (
              <StatCard
                key={kpi.key}
                label={kpi.label}
                icon={kpi.icon}
                loading={isLoading}
                value={value.value}
                unit={value.unit}
                valueTone={kpi.value < 0 ? "danger" : undefined}
              />
            );
          })}
          <StatCard
            // Yorliq qatori butun enga: «Umumiy balans» chapda, «Ijobiy/Salbiy» o'ngda (maket `.el-kpi-top`).
            className="[&>span:first-child>span:first-child]:flex-1"
            label={
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0">{t("v2Balance.kpi.total")}</span>
                {data ? (
                  <Badge tone={isNegative ? "danger" : "success"} dot className="max-md:hidden">
                    {isNegative ? t("v2Balance.kpi.negative") : t("v2Balance.kpi.positive")}
                  </Badge>
                ) : null}
              </span>
            }
            loading={isLoading}
            value={totalValue.value}
            unit={totalValue.unit}
            valueTone={isNegative ? "danger" : undefined}
          />
        </section>
        <p className="m-0 flex items-start gap-2 text-xs leading-[18px] text-text-subtle">
          <Info aria-hidden="true" size={16} className="shrink-0" />
          <span>{t("v2Balance.kpi.formula")}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("v2Balance.title")}
        description={t("v2Balance.description")}
        actions={
          <>
            <Button variant="secondary" leftIcon={Download} loading={exporting} onClick={() => void exportExcel()}>
              {t("v2Balance.export")}
            </Button>
            <Button variant="primary" leftIcon={Plus} onClick={() => setEntryOpen(true)}>
              {t("v2Balance.addEntry")}
            </Button>
          </>
        }
      />

      {renderKpis()}

      <Tabs
        items={tabs}
        value={activeTab}
        onValueChange={selectTab}
        ariaLabel={t("v2Balance.tabs.label")}
        idPrefix={TABS_ID}
        controlsPanel
        background="bg"
      />

      <div
        role="tabpanel"
        id={getPanelId(TABS_ID, activeTab)}
        aria-labelledby={getTabId(TABS_ID, activeTab)}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        {activeTab === "overview" ? (
          data ? (
            <>
              <Statistics data={data} updatedAt={dataUpdatedAt || undefined} />
              <SettlementRanks data={data} />
            </>
          ) : isLoading ? (
            <Card divided={false} title={t("v2Balance.composition.title")} aria-busy="true">
              <span className="sr-only">{t("v2Balance.state.loading")}</span>
              <SkeletonLines lines={5} />
            </Card>
          ) : null
        ) : activeTab === "history" ? (
          <HistoryTab />
        ) : (
          <AnalysisTab
            range={analysisRange}
            onRangeChange={setAnalysisRange}
            preset={analysisPreset}
            onPresetChange={setAnalysisPreset}
          />
        )}
      </div>

      <FinancialEntryModal open={entryOpen} onClose={() => setEntryOpen(false)} />
    </div>
  );
};

export default memo(FinancialBalance);
