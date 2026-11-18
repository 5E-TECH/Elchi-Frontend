// dizayn-v2: (maket yo'q) market_operator-earnings, market-operators-list
import { memo, useMemo, useState } from "react";
import { ArrowDownLeft, Banknote, HandCoins, ReceiptText, SearchX, Users, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useOperatorBalances,
  useOperatorPayments,
  type OperatorBalanceTotals,
} from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { CURRENCY_LABEL, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import {
  Button,
  buttonClasses,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  StatCard,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { MarketOperatorsTabs } from "./MarketOperatorsTabs";
import { OperatorBalancesSkeleton, OperatorBalancesTable } from "./OperatorBalancesTable";
import { OperatorPaymentsSkeleton, OperatorPaymentsTable } from "./OperatorPaymentsTable";
import { usePaymentDialogs } from "./usePaymentDialogs";

const PAGE_SIZES = [20, 50, 100] as const;

/** Jami «Ishlab topdi / To'landi / Qoldiq»: desktop — 3 ta KPI (maket `market_operator-earnings` «Hisob»), telefon — bitta qator. */
const BalanceSummary = ({ totals, loading }: { totals: OperatorBalanceTotals | null; loading: boolean }) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const number = (value: number) => formatNumberLocalized(Math.round(value), { language });
  const unit = CURRENCY_LABEL[language];
  const balance = totals?.balance ?? 0;
  const cells = [
    { key: "earned", label: t("payments.kpi.earned"), value: totals?.earned ?? 0, hint: t("payments.kpi.earnedHint"), icon: Banknote },
    { key: "paid", label: t("payments.kpi.paid"), value: totals?.paid ?? 0, hint: t("payments.kpi.paidHint"), icon: ArrowDownLeft },
    {
      key: "balance",
      label: t("payments.kpi.balance"),
      value: balance,
      hint: balance < 0 ? t("payments.kpi.overpaidHint") : t("payments.kpi.balanceHint"),
      icon: Wallet,
    },
  ] as const;

  return (
    <section aria-label={t("payments.kpi.label")} className="flex min-w-0 flex-col gap-3">
      <div className="grid grid-cols-3 gap-4 max-lg:gap-3 max-md:hidden">
        {cells.map((cell) => (
          <StatCard
            key={cell.key}
            label={cell.label}
            value={number(cell.value)}
            unit={unit}
            hint={cell.hint}
            icon={cell.icon}
            loading={loading}
          />
        ))}
      </div>
      <div className="hidden flex-col rounded-[14px] border border-border bg-surface max-md:flex">
        <dl className="m-0 flex">
          {cells.map((cell, index) => (
            <div
              key={cell.key}
              className={cx("flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3", index > 0 && "border-l border-border")}
            >
              <dt className="truncate text-xs font-semibold text-text-muted">{cell.label}</dt>
              <dd className="m-0 truncate text-[15px] font-semibold text-text tabular-nums">
                {loading ? "…" : number(cell.value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 border-t border-border px-3.5 py-2 text-xs text-text-muted">{t("payments.kpi.phoneNote")}</p>
      </div>
    </section>
  );
};

/**
 * «OPERATORLAR → TO'LOVLAR» (F2qp6FtE, ega qarori 2026-11-16): market o'z operatoriga O'ZI, istagan vaqtida to'laydi;
 * Elchi kassasiga ta'sir qilmaydi — tizim faqat yozuv saqlaydi. Maket yo'q — eng yaqini `market_operator-earnings`
 * («Hisob», «To'lovlar») va `market-operators-list` (jadval, kartalar).
 *
 *  - Sarlavha + «Operatorlar · To'lovlar» tablari, yagona asosiy amal «To'lov yozish».
 *  - Jami: Ishlab topdi · To'landi · Qoldiq (`GET finance/operator-payments/balances` → `totals`).
 *  - «Har operator hisobi» — qatorda «To'lov yozish» (operator tanlangan oyna).
 *  - «To'lovlar tarixi» — operator filtri, `DataTable` + `Pagination`, «Bekor qilish» (sabab bilan).
 */
export const OperatorPaymentsView = memo(({ description }: { description: string }) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { openRecord, openCancel, dialogs } = usePaymentDialogs();
  const balances = useOperatorBalances();
  const [operatorFilter, setOperatorFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const history = useOperatorPayments({ page, limit, ...(operatorFilter ? { operatorId: operatorFilter } : {}) });

  // Oxirgi sahifadagi yagona yozuv yo'qolsa (filtr) — mavjud oxirgi sahifaga (render paytida).
  if (history.data && history.data.items.length === 0 && history.data.total > 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(history.data.total / limit));
    if (lastPage < page) setPage(lastPage);
  }

  const operatorOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("payments.history.filterAll") },
      ...(balances.data?.items ?? []).map((item) => ({
        value: item.operatorId,
        label: item.operatorName || item.operatorId,
      })),
    ],
    [balances.data?.items, t],
  );

  const noOperators = balances.data !== undefined && balances.data.items.length === 0;
  const total = history.data?.total ?? 0;
  const footer =
    history.data && total > 0 ? (
      total > limit ? (
        <Pagination
          page={history.data.page || page}
          pageSize={history.data.limit || limit}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZES}
          disabled={history.isFetching}
          summary={(range) => t("payments.history.pagination", range)}
        />
      ) : (
        <span className="text-[13px] text-text-muted">
          {t("payments.history.summary", { total: formatNumberLocalized(total, { language }) })}
        </span>
      )
    ) : undefined;

  const recordButton = (
    <Button leftIcon={HandCoins} aria-haspopup="dialog" onClick={() => openRecord()}>
      {t("payments.record")}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={description}
        children={<MarketOperatorsTabs value="payments" />}
        actions={noOperators ? undefined : recordButton}
      />

      {balances.isError ? null : (
        <BalanceSummary totals={balances.data?.totals ?? null} loading={balances.isLoading} />
      )}

      <Card
        padding="none"
        title={t("payments.balances.title")}
        description={t("payments.balances.description")}
        aria-label={t("payments.balances.label")}
      >
        <QueryBoundary
          query={{
            data: balances.data?.items,
            isLoading: balances.isLoading,
            isError: balances.isError,
            error: balances.error,
            refetch: balances.refetch,
          }}
          loadingLabel={t("payments.balances.loading")}
          loading={<OperatorBalancesSkeleton />}
          empty={
            <EmptyState
              icon={Users}
              title={t("payments.balances.emptyTitle")}
              description={t("payments.balances.emptyDescription")}
              action={
                <Link to="/market-operators" className={buttonClasses({ variant: "secondary" })}>
                  {t("payments.balances.toOperators")}
                </Link>
              }
            />
          }
        >
          {(rows) => <OperatorBalancesTable rows={rows} onRecord={openRecord} />}
        </QueryBoundary>
      </Card>

      <Card
        padding="none"
        title={t("payments.history.title")}
        description={t("payments.history.description")}
        aria-label={t("payments.history.label")}
        footer={footer}
      >
        <div
          role="group"
          aria-label={t("payments.history.filtersLabel")}
          className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4"
        >
          <Field
            label={t("payments.history.filter")}
            hideLabel
            labelAs="span"
            className="min-w-0 flex-[0_1_360px] max-md:basis-full"
          >
            <Select
              options={operatorOptions}
              value={operatorFilter || null}
              onChange={(next) => {
                setOperatorFilter(next ?? "");
                setPage(1);
              }}
              placeholder={t("payments.history.filterAll")}
              inlineLabel={t("payments.history.filter")}
              icon={Users}
              searchable={operatorOptions.length > 8}
              listLabel={t("payments.history.filter")}
            />
          </Field>
        </div>
        <QueryBoundary
          query={{
            data: history.data?.items,
            isLoading: history.isLoading,
            isError: history.isError,
            error: history.error,
            refetch: history.refetch,
          }}
          loadingLabel={t("payments.history.loading")}
          loading={<OperatorPaymentsSkeleton />}
          empty={
            history.isPlaceholderData ? (
              <OperatorPaymentsSkeleton />
            ) : operatorFilter ? (
              <EmptyState
                icon={SearchX}
                title={t("payments.history.notFoundTitle")}
                description={t("payments.history.notFoundDescription")}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setOperatorFilter("");
                      setPage(1);
                    }}
                  >
                    {t("payments.history.clearFilter")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title={t("payments.history.emptyTitle")}
                description={t("payments.history.emptyDescription")}
              />
            )
          }
        >
          {(rows) => (
            <OperatorPaymentsTable
              rows={rows}
              busy={history.isFetching && history.isPlaceholderData}
              onCancel={openCancel}
            />
          )}
        </QueryBoundary>
      </Card>

      {dialogs}
    </div>
  );
});
OperatorPaymentsView.displayName = "OperatorPaymentsView";
