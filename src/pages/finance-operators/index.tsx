// dizayn-v2: superadmin-ops-finance-operators
import { memo, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useFinanceCoverage } from "../../entities/payments/financeCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Pagination,
  QueryBoundary,
  TextInput,
  useConfirm,
  type DataTableColumn,
} from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import {
  buildOperatorPaymentPayload,
  isOperatorId,
  newPaymentKey,
  readOperatorBalance,
  readOperatorEarnings,
  readOperatorPaymentResult,
  readOperatorPayouts,
  type OperatorEarningRow,
  type OperatorPaymentResult,
  type OperatorPayoutRow,
} from "./lib/operatorFinance";
import { OperatorBalanceCard } from "./ui/OperatorBalanceCard";

/**
 * OPS → «Moliya operatorlari» (maket `superadmin-ops-finance-operators`): operatorni ID bo'yicha yuklash,
 * balans (ishlab topgan / to'langan / qoldiq), to'lov qayd qilish (PUL AMALI — `useConfirm` bilan, `D10`),
 * daromadlar (sahifalab) va to'lovlar tarixi.
 *
 * «Ishlab topgan va to'langan» yig'ma grafigi maketda «Taklif» — chizilmaydi (spec §5 G4).
 * To'lov: body `{ operator_id, amount, note? }` (backend DTO — `note`; `comment` 400 berardi), sarlavha
 * `Idempotency-Key` — bitta mantiqiy to'lov uchun bitta kalit (504 dan keyin qayta bosish ikki marta yozmaydi).
 */

const EARNINGS_PAGE_SIZE = 5;
const PAYOUTS_PAGE_SIZE = 10;

const FinanceOperatorsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  // To'lov — `useFinanceCoverage().createOperatorPayment`: muvaffaqiyatda operator va kassa keshlari birga yangilanadi.
  const {
    useGetOperatorBalance,
    useGetOperatorEarnings,
    useGetOperatorPayouts,
    createOperatorPayment: createPayment,
  } = useFinanceCoverage();

  const [operatorInput, setOperatorInput] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);

  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [lastPayment, setLastPayment] = useState<OperatorPaymentResult | null>(null);
  const paymentKey = useRef(newPaymentKey());

  const enabled = operatorId !== "";
  const balanceQuery = useGetOperatorBalance(operatorId, enabled, { silentError: true });
  const earningsQuery = useGetOperatorEarnings(operatorId, enabled, {
    limit: EARNINGS_PAGE_SIZE,
    offset: (earningsPage - 1) * EARNINGS_PAGE_SIZE,
  }, { silentError: true });
  const payoutsQuery = useGetOperatorPayouts(operatorId, enabled, {
    limit: PAYOUTS_PAGE_SIZE,
    offset: (payoutsPage - 1) * PAYOUTS_PAGE_SIZE,
  }, { silentError: true });

  const balance = readOperatorBalance(balanceQuery.data);
  const earnings = readOperatorEarnings(earningsQuery.data);
  const payouts = readOperatorPayouts(payoutsQuery.data);

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const dateText = (value: string | null) => (value ? formatDateTimeLocalized(value, { language }) : "—");

  const load = (event: FormEvent) => {
    event.preventDefault();
    const next = operatorInput.trim();
    if (!isOperatorId(next)) {
      setLookupError(t("finance.lookup.invalid"));
      return;
    }
    setLookupError("");
    if (next !== operatorId) {
      setOperatorId(next);
      setEarningsPage(1);
      setPayoutsPage(1);
      setLastPayment(null);
      createPayment.reset();
      paymentKey.current = newPaymentKey();
    }
  };

  const amount = Number(amountText);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const amountError = amountTouched && !amountValid ? t("finance.payment.amountRequired") : undefined;

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    setAmountTouched(true);
    if (!amountValid || createPayment.isPending) return;
    const payload = buildOperatorPaymentPayload(operatorId, amount, note);
    let response: unknown;
    const ok = await confirm({
      title: t("finance.payment.confirmTitle"),
      description: t("finance.payment.confirmDescription", { id: operatorId }),
      amount: { value: amount, label: t("finance.payment.confirmAmount") },
      rows: payload.note ? [{ label: t("finance.payment.confirmNote"), value: payload.note, stacked: true }] : undefined,
      confirmLabel: t("finance.payment.submit"),
      loadingLabel: t("finance.payment.confirmLoading"),
      tone: "primary",
      onConfirm: async () => {
        response = await createPayment.mutateAsync({ payload, idempotencyKey: paymentKey.current });
      },
    });
    if (!ok) return;
    // Summa va izoh — server javobidan: xato urinishdan keyin summa tahrirlanib o'sha `Idempotency-Key` bilan
    // qayta yuborilsa, backend birinchi yozilgan to'lovni qaytaradi (`idempotent: true`) — tahrirlangan maydonni emas.
    setLastPayment(readOperatorPaymentResult(response, payload));
    setAmountText("");
    setNote("");
    setAmountTouched(false);
    // Keyingi to'lov — yangi kalit (bu to'lov yozildi).
    paymentKey.current = newPaymentKey();
  };

  const earningColumns: DataTableColumn<OperatorEarningRow>[] = [
    {
      id: "order",
      header: t("finance.earnings.order"),
      cell: (row) =>
        row.orderId ? (
          <Link to={`/orders/edit/${row.orderId}`} className="font-semibold text-text hover:text-action-fg">
            №{row.orderId}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      id: "amount",
      header: t("finance.earnings.amount"),
      align: "end",
      cell: (row) => <span className="font-semibold">{money(row.amount)}</span>,
    },
    {
      id: "date",
      header: t("finance.earnings.date"),
      cell: (row) => <span className="whitespace-nowrap text-text-muted">{dateText(row.createdAt)}</span>,
    },
  ];

  const payoutColumns: DataTableColumn<OperatorPayoutRow>[] = [
    {
      id: "amount",
      header: t("finance.payouts.amount"),
      cell: (row) => <span className="whitespace-nowrap font-semibold">{money(row.amount)}</span>,
    },
    { id: "note", header: t("finance.payouts.note"), cell: (row) => row.note || "—" },
    {
      id: "date",
      header: t("finance.payouts.date"),
      cell: (row) => <span className="whitespace-nowrap text-text-muted">{dateText(row.createdAt)}</span>,
    },
  ];

  const countBadge = (count: number) => <Badge>{t("common.count", { count })}</Badge>;

  return (
    <OpsToolPage tabKey="finance" embedded={embedded}>
      <OpsIntro
        title={t("finance.intro.title")}
        description={t("finance.intro.description")}
        aside={
          <form
            role="search"
            aria-label={t("finance.lookup.formLabel")}
            onSubmit={load}
            className="flex min-w-0 flex-[1_1_300px] flex-wrap items-end gap-2 md:max-w-[440px]"
          >
            <Field label={t("finance.lookup.label")} error={lookupError || undefined} className="min-w-0 flex-[1_1_180px]">
              <TextInput
                mode="number"
                inputMode="numeric"
                value={operatorInput}
                onValueChange={setOperatorInput}
                placeholder={t("finance.lookup.placeholder")}
              />
            </Field>
            <Button type="submit" variant="secondary" leftIcon={Search} className="max-md:flex-1">
              {t("finance.lookup.submit")}
            </Button>
          </form>
        }
      />

      {enabled ? (
        <>
          <QueryBoundary
            query={balanceQuery}
            skeleton="chart"
            isEmpty={() => balance === null}
            error={(error, retry) => (
              <Card>
                <OpsAlert tone="danger" title={t("finance.balance.loadError")}>
                  {getBackendErrorMessage(error)}
                </OpsAlert>
                <div className="pt-3">
                  <Button variant="secondary" size="sm" onClick={retry}>
                    {t("common.retry")}
                  </Button>
                </div>
              </Card>
            )}
          >
            {() => (balance ? <OperatorBalanceCard operatorId={operatorId} balance={balance} /> : null)}
          </QueryBoundary>

          <Card title={t("finance.payment.title")} description={t("finance.payment.description")}>
            <form onSubmit={submitPayment} noValidate className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <Field
                  label={t("finance.payment.amount")}
                  required
                  error={amountError}
                  className="min-w-0 flex-[1_1_200px]"
                >
                  <TextInput
                    mode="money"
                    suffix={null}
                    inputMode="numeric"
                    value={amountText}
                    onValueChange={setAmountText}
                    onBlur={() => setAmountTouched(true)}
                    placeholder={t("finance.payment.amountPlaceholder")}
                  />
                </Field>
                <Field label={t("finance.payment.note")} className="min-w-0 flex-[2_1_280px]">
                  <TextInput value={note} onValueChange={setNote} placeholder={t("finance.payment.notePlaceholder")} />
                </Field>
                <Button type="submit" loading={createPayment.isPending} className="max-md:w-full">
                  {t("finance.payment.submit")}
                </Button>
              </div>
              {lastPayment && !createPayment.isError ? (
                <OpsAlert tone="success" title={t("finance.payment.success")}>
                  {[money(lastPayment.amount), lastPayment.note, formatDateTimeLocalized(lastPayment.at, { language })]
                    .filter(Boolean)
                    .join(" · ")}
                </OpsAlert>
              ) : null}
              {createPayment.isError ? (
                <OpsAlert tone="danger" title={t("finance.payment.error")}>
                  {getBackendErrorMessage(createPayment.error)}
                </OpsAlert>
              ) : null}
            </form>
          </Card>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-stretch gap-6 max-md:gap-4">
            <Card
              padding="none"
              title={t("finance.earnings.title")}
              description={t("finance.earnings.description")}
              actions={earningsQuery.data !== undefined ? countBadge(earnings.total) : null}
              className="flex flex-col"
              bodyClassName="flex flex-1 flex-col"
              footer={
                earnings.total > EARNINGS_PAGE_SIZE ? (
                  <Pagination
                    page={earningsPage}
                    pageSize={EARNINGS_PAGE_SIZE}
                    total={earnings.total}
                    onPageChange={setEarningsPage}
                    label={t("finance.earnings.pagesLabel")}
                    summary={(range) => t("finance.earnings.summary", range)}
                  />
                ) : undefined
              }
            >
              <QueryBoundary
                query={earningsQuery}
                skeleton="table"
                isEmpty={() => earnings.rows.length === 0}
                empty={<EmptyState title={t("finance.earnings.empty")} description={t("finance.earnings.emptyHint")} />}
                error={(error, retry) => (
                  <div className="p-5">
                    <OpsAlert tone="danger" title={t("finance.earnings.loadError")}>
                      {getBackendErrorMessage(error)}
                    </OpsAlert>
                    <div className="pt-3">
                      <Button variant="secondary" size="sm" onClick={retry}>
                        {t("common.retry")}
                      </Button>
                    </div>
                  </div>
                )}
              >
                {() => (
                  <DataTable
                    rows={earnings.rows}
                    columns={earningColumns}
                    getRowKey={(row) => row.key}
                    label={t("finance.earnings.title")}
                    renderCard={(row) => {
                      const body = (
                        <>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-semibold text-text">{row.orderId ? `№${row.orderId}` : "—"}</span>
                            <span className="text-[13px] text-text-muted">{dateText(row.createdAt)}</span>
                          </div>
                          <span className="whitespace-nowrap font-semibold text-text">{money(row.amount)}</span>
                        </>
                      );
                      // Telefonda butun karta — buyurtma havolasi (nishon ≥ 44 px).
                      return row.orderId ? (
                        <Link to={`/orders/edit/${row.orderId}`} className="flex min-w-0 items-center gap-3 px-4 py-3">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex min-w-0 items-center gap-3 px-4 py-3">{body}</div>
                      );
                    }}
                  />
                )}
              </QueryBoundary>
            </Card>

            <Card
              padding="none"
              title={t("finance.payouts.title")}
              description={t("finance.payouts.description")}
              actions={payoutsQuery.data !== undefined ? countBadge(payouts.total) : null}
              className="flex flex-col"
              bodyClassName="flex flex-1 flex-col"
              footer={
                payoutsQuery.data === undefined || payouts.total === 0 ? undefined : payouts.total > PAYOUTS_PAGE_SIZE ? (
                  <Pagination
                    page={payoutsPage}
                    pageSize={PAYOUTS_PAGE_SIZE}
                    total={payouts.total}
                    onPageChange={setPayoutsPage}
                    label={t("finance.payouts.pagesLabel")}
                    summary={(range) => t("finance.payouts.summary", range)}
                  />
                ) : (
                  <>
                    <span className="text-[13px] text-text-muted">{t("finance.payouts.count", { count: payouts.total })}</span>
                    {balance ? (
                      <span className="text-[13px] text-text-muted">
                        {t("finance.payouts.total")} <span className="font-semibold text-text">{money(balance.paid)}</span>
                      </span>
                    ) : null}
                  </>
                )
              }
            >
              <QueryBoundary
                query={payoutsQuery}
                skeleton="table"
                isEmpty={() => payouts.rows.length === 0}
                empty={<EmptyState title={t("finance.payouts.empty")} description={t("finance.payouts.emptyHint")} />}
                error={(error, retry) => (
                  <div className="p-5">
                    <OpsAlert tone="danger" title={t("finance.payouts.loadError")}>
                      {getBackendErrorMessage(error)}
                    </OpsAlert>
                    <div className="pt-3">
                      <Button variant="secondary" size="sm" onClick={retry}>
                        {t("common.retry")}
                      </Button>
                    </div>
                  </div>
                )}
              >
                {() => (
                  <DataTable
                    rows={payouts.rows}
                    columns={payoutColumns}
                    getRowKey={(row) => row.key}
                    label={t("finance.payouts.title")}
                    renderCard={(row) => (
                      <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-semibold">{row.note || "—"}</span>
                          <span className="text-[13px] text-text-muted">{dateText(row.createdAt)}</span>
                        </div>
                        <span className="whitespace-nowrap font-semibold">{money(row.amount)}</span>
                      </div>
                    )}
                  />
                )}
              </QueryBoundary>
            </Card>
          </div>
        </>
      ) : null}
    </OpsToolPage>
  );
};

export default memo(FinanceOperatorsPage);
