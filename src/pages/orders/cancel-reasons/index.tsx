// dizayn-v2: (maket yo'q) tizim-charts
import { useState } from "react";
import { ListX, Percent } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useBranches } from "../../../entities/branch";
import { useMarkets } from "../../../entities/markets";
import { useCancelReasonStats, type CancelReasonStat } from "../../../entities/orders/cancelReasonStats";
import { cx } from "../../../shared/lib/cx";
import { getThisMonthRange, type ISODateRange } from "../../../shared/lib/dateRange";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { HBarList } from "../../../shared/ui/charts";
import {
  Card,
  DateRange,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  QueryBoundary,
  Select,
  SkeletonChart,
  StatCard,
} from "../../../shared/ui/primitives";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { toFilterOptions } from "../list/useOrderFilterOptions";

/**
 * «BEKOR QILISH SABABLARI» (GNWDKvmZ, PUvKXWVw) — `/orders/cancel-reasons`, kirish `/orders` sarlavhasidan.
 *
 * Maket va menyu bandi yo'q (ega tasdig'i kutiladi): menyuga band qo'shilmagan, eng yaqini `tizim-charts`
 * («Gorizontal ustunlar»). Superadmin va admin — market va filial filtri; menejer va market — o'z doirasi
 * (backend JWT'dan), filtrlar yashirin.
 */
const CancelReasonsPage = () => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const canFilter = role === "superadmin" || role === "admin";

  const [range, setRange] = useState<ISODateRange>(getThisMonthRange);
  const [market, setMarket] = useState("");
  const [branch, setBranch] = useState("");

  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, canFilter);
  const branchesQuery = useBranches({ status: "active", limit: 100, page: 1 }, canFilter);

  const stats = useCancelReasonStats({
    ...(range.from ? { startDate: range.from } : {}),
    ...(range.to ? { endDate: range.to } : {}),
    ...(canFilter && market ? { market_id: market } : {}),
    ...(canFilter && branch ? { branch_id: branch } : {}),
  });

  const reasonLabel = ({ reason, label }: CancelReasonStat) => t(`cancelReasons.${reason}`, { defaultValue: label ?? reason });
  const pieces = (value: number) => t("cancelReasonStats.pieces", { count: formatNumberLocalized(value, { language }) });

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/orders"
        backLabel={t("title")}
        title={t("cancelReasonStats.title")}
        description={t("cancelReasonStats.subtitle")}
      />

      <div role="group" aria-label={t("cancelReasonStats.filters")} className="flex flex-wrap items-center gap-3">
        <Field label={t("cancelReasonStats.period")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_260px] max-md:basis-full">
          <DateRange value={range} onChange={setRange} clearable={false} />
        </Field>
        {canFilter ? (
          <>
            <Field label={t("cancelReasonStats.market")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_220px] max-md:basis-full">
              <Select
                searchable
                options={[{ value: "", label: t("cancelReasonStats.allMarkets") }, ...toFilterOptions(marketsQuery.data)]}
                value={market || null}
                onChange={(value) => setMarket(value ?? "")}
                placeholder={t("cancelReasonStats.allMarkets")}
              />
            </Field>
            <Field label={t("cancelReasonStats.branch")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_220px] max-md:basis-full">
              <Select
                searchable
                options={[{ value: "", label: t("cancelReasonStats.allBranches") }, ...toFilterOptions(branchesQuery.data?.data)]}
                value={branch || null}
                onChange={(value) => setBranch(value ?? "")}
                placeholder={t("cancelReasonStats.allBranches")}
              />
            </Field>
          </>
        ) : null}
      </div>

      <QueryBoundary
        query={stats}
        isEmpty={(data) => data.total === 0}
        loadingLabel={t("cancelReasonStats.loading")}
        loading={
          <Card divided={false} title={t("cancelReasonStats.byReason")}>
            <SkeletonChart />
          </Card>
        }
        empty={<EmptyState framed icon={ListX} title={t("cancelReasonStats.empty")} description={t("cancelReasonStats.emptyHint")} />}
        error={(error, retry) => <ErrorState framed error={error} title={t("cancelReasonStats.loadFailed")} onRetry={retry} />}
      >
        {(data, { isRefetching }) => {
          const top = data.reasons[0];
          const shownRange = data.appliedRange ?? range;
          return (
            <div className={cx("flex flex-col gap-6 transition-opacity max-md:gap-4", isRefetching && "opacity-60")}>
              <section aria-label={t("cancelReasonStats.kpi")} className="grid grid-cols-2 gap-4 max-md:grid-cols-1 max-md:gap-3">
                <StatCard
                  label={t("cancelReasonStats.total")}
                  icon={ListX}
                  value={formatNumberLocalized(data.total, { language })}
                  unit={t("cancelReasonStats.unit")}
                />
                {top ? (
                  <StatCard
                    label={t("cancelReasonStats.top")}
                    icon={Percent}
                    value={formatPercentLocalized(top.share, { language })}
                    hint={reasonLabel(top)}
                  />
                ) : null}
              </section>
              <Card
                divided={false}
                title={t("cancelReasonStats.byReason")}
                description={formatRangeShort(shownRange) ?? t("cancelReasonStats.allTime")}
              >
                <HBarList
                  ariaLabel={t("cancelReasonStats.byReason")}
                  rows={data.reasons.map((row) => ({
                    id: row.reason,
                    label: reasonLabel(row),
                    value: row.count,
                    display: pieces(row.count),
                    sub: formatPercentLocalized(row.share, { language }),
                  }))}
                />
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
};

export default CancelReasonsPage;
