// dizayn-v2: superadmin-payments-shift-report
import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Info,
  Scale,
  Send,
  Settings,
  TriangleAlert,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { canManageShiftSettings } from "../../../app/lib/access";
import {
  useResendShiftReport,
  useShiftReport,
  type ShiftAccountCheck,
  type ShiftReport,
  type ShiftReportOperation,
} from "../../../entities/payments";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized, formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  QueryBoundary,
  StatCard,
  TONE_FG,
  TONE_SOFT,
  useConfirm,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { AiStatusBadge, EnteredMismatchBadge } from "../components/shiftCheck/aiStatus";
import { cardSubtitle } from "../components/shiftCheck/aiStatusMeta";
import ReportDeliveries from "./ReportDeliveries";

/**
 * SMENA HISOBOTI — `/payments/shifts/:id` (maket `superadmin-payments-shift-report`, kiZgTybn).
 * Manba — `GET finance/shift/:id/report`: KPI (ochilish · kirim · chiqim · yopilish · farq), «Naqd» (kutilgan /
 * sanalgan / farq), «Kartalar va hisob raqamlar» (tizim bo'yicha, kiritilgan, rasm havolasi — 300 s imzolangan,
 * AI natija, farq, izoh; telefonda kartalar), «Operatsiyalar xulosasi» (tur × to'lov usuli). Ochiq smenada ham
 * ishlaydi (banner). y8Tqm9Ap: avtomatik yopilgan smenada sariq «Avtomatik yopildi — HH:MM, kassir yopmagan» banneri;
 * gWI4gYkw (faqat superadmin): sarlavhada hisobot fayli (PDF / Excel, imzolangan havola) va «Hisobotni qayta
 * yuborish» (tasdiq bilan, `POST finance/shift/:id/report/resend`), «Hisobot kimlarga yuborildi» kartasi
 * (`ReportDeliveries`). Maketdagi «Vaqt chizig'i» — backend bermaydi, chizilmaydi.
 */

const sum = (...values: Array<number | null | undefined>) =>
  values.reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0);

const diffTone = (value: number | null) =>
  value === null || Math.round(value * 100) === 0 ? "text-text" : value < 0 ? TONE_FG.danger : TONE_FG.warning;

/** y8Tqm9Ap: avtomatik yopilgan smena — sariq banner (maket `.el-alert.el-tone-warning`). */
const AutoClosedBanner = ({ report }: { report: ShiftReport }) => {
  const { t } = useTranslation("payments");
  const closedAt = report.auto_close?.closed_at ?? report.shift.closed_at;
  const time = closedAt ? formatTimeLocalized(closedAt) : "";
  const opened = report.shift.opened_at ? formatTimeLocalized(report.shift.opened_at) : "";
  const name = report.shift.opened_by_name;
  return (
    <div
      role="status"
      data-testid="shift-auto-closed"
      className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
    >
      <TriangleAlert aria-hidden="true" size={18} className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5 text-text">
        <span className="font-bold">
          {time ? t("shiftCheck.report.autoClosed.title", { time }) : t("shiftCheck.report.autoClosed.titleNoTime")}
        </span>
        <span>
          {name && opened
            ? t("shiftCheck.report.autoClosed.text", { name, time: opened })
            : t("shiftCheck.report.autoClosed.textNoName")}
        </span>
      </div>
    </div>
  );
};

const ReportBody = ({ report, showDeliveries }: { report: ShiftReport; showDeliveries: boolean }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const money = (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language }));
  const plain = (value: number | null) =>
    value === null ? "—" : formatMoneyLocalized(value, { language, withCurrency: false });
  const signed = (value: number | null) => (value === null ? "—" : formatSignedMoneyLocalized(value, { language }));

  const { cash, card, accounts, operations } = report;
  const cashCounted = cash.closing_balance !== null && report.shift.status === "closed" && cash.discrepancy !== null;
  const income = sum(cash.total_income, card.total_income);
  const expense = sum(cash.total_expense, card.total_expense);
  const opening = sum(cash.opening_balance, card.opening_balance);
  const closing = sum(cash.closing_balance, card.closing_balance);
  const anyDiff = cash.discrepancy !== null || card.discrepancy !== null;
  const diffTotal = sum(cash.discrepancy, card.discrepancy);
  const checkedByAi = accounts.filter((row) => row.ai_status === "match" || row.ai_status === "mismatch").length;
  const opCount = operations.reduce((total, op) => total + op.count, 0);

  const accountsTotals = useMemo(() => {
    const counted = accounts.filter((row) => row.entered_balance !== null);
    return {
      expected: sum(...accounts.map((row) => row.expected_balance)),
      entered: sum(...counted.map((row) => row.entered_balance)),
      enteredCount: counted.length,
      diff: sum(...accounts.map((row) => row.difference)),
    };
  }, [accounts]);

  const aiDetail = (row: ShiftAccountCheck) => {
    if (!row.has_photo) {
      return row.ai_enabled_snap === false && row.photo_required_snap === false
        ? t("shiftCheck.report.accounts.settingOff")
        : t("shiftCheck.report.accounts.noPhoto");
    }
    if (row.ai_read_balance === null) return null;
    return row.ai_status === "mismatch"
      ? t("shiftCheck.report.accounts.aiReadMismatch", { amount: money(row.ai_read_balance) })
      : t("shiftCheck.report.accounts.aiRead", { amount: money(row.ai_read_balance) });
  };

  const aiCell = (row: ShiftAccountCheck) => (
    <span className="flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap gap-1.5">
        <AiStatusBadge status={row.ai_status} />
        {row.ai_entered_ok === false ? <EnteredMismatchBadge /> : null}
      </span>
      {aiDetail(row) ? <span className="text-[13px] text-text-muted">{aiDetail(row)}</span> : null}
    </span>
  );

  const photoCell = (row: ShiftAccountCheck) =>
    row.photo_url ? (
      <a
        href={row.photo_url}
        target="_blank"
        rel="noreferrer"
        className={buttonClasses({ variant: "link", size: "sm" })}
      >
        <ExternalLink aria-hidden="true" size={16} />
        {t("shiftCheck.report.accounts.photoOpen")}
      </a>
    ) : (
      <span className="text-text-muted">{t("shiftCheck.report.accounts.photoMissing")}</span>
    );

  const commentCell = (row: ShiftAccountCheck) =>
    row.comment ? (
      <span className="text-text">{row.comment}</span>
    ) : row.comment_required ? (
      <span className={TONE_FG.danger}>{t("shiftCheck.report.accounts.commentMissing")}</span>
    ) : (
      <span className="text-text-muted">—</span>
    );

  const cardName = (row: ShiftAccountCheck) => (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold text-text">{row.card?.name ?? `#${row.card_id}`}</span>
      {cardSubtitle(row.card) ? <span className="text-[13px] text-text-muted">{cardSubtitle(row.card)}</span> : null}
    </span>
  );

  const columns: DataTableColumn<ShiftAccountCheck>[] = [
    { id: "card", header: t("shiftCheck.report.accounts.card"), cell: cardName },
    {
      id: "system",
      header: t("shiftCheck.report.accounts.system"),
      align: "end",
      cell: (row) => <span className="whitespace-nowrap">{money(row.expected_balance)}</span>,
    },
    {
      id: "entered",
      header: t("shiftCheck.report.accounts.entered"),
      align: "end",
      cell: (row) =>
        row.entered_balance === null ? (
          <span className="text-text-muted">{t("shiftCheck.report.accounts.notCounted")}</span>
        ) : (
          <span className="whitespace-nowrap font-semibold">{money(row.entered_balance)}</span>
        ),
    },
    { id: "photo", header: t("shiftCheck.report.accounts.photo"), cell: photoCell },
    { id: "ai", header: t("shiftCheck.report.accounts.ai"), cell: aiCell },
    {
      id: "diff",
      header: t("shiftCheck.report.accounts.diff"),
      align: "end",
      cell: (row) => (
        <span className={cx("whitespace-nowrap font-semibold", diffTone(row.difference))}>{signed(row.difference)}</span>
      ),
    },
    { id: "comment", header: t("shiftCheck.report.accounts.comment"), cell: commentCell, hideBelow: "lg" },
  ];

  const renderAccountCard = (row: ShiftAccountCheck) => (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        {cardName(row)}
        <AiStatusBadge status={row.ai_status} />
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <dt className="text-text-muted">{t("shiftCheck.report.accounts.system")}</dt>
        <dd className="m-0 text-right font-semibold text-text">{money(row.expected_balance)}</dd>
        <dt className="text-text-muted">{t("shiftCheck.report.accounts.entered")}</dt>
        <dd className="m-0 text-right font-semibold text-text">
          {row.entered_balance === null ? t("shiftCheck.report.accounts.notCounted") : money(row.entered_balance)}
        </dd>
        <dt className="text-text-muted">{t("shiftCheck.report.accounts.diff")}</dt>
        <dd className={cx("m-0 text-right font-semibold", diffTone(row.difference))}>{signed(row.difference)}</dd>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        {photoCell(row)}
        {aiDetail(row) ? <span className="text-text-muted">{aiDetail(row)}</span> : null}
      </div>
      {row.ai_entered_ok === false ? <EnteredMismatchBadge /> : null}
      {row.comment || row.comment_required ? <div className="text-[13px]">{commentCell(row)}</div> : null}
    </div>
  );

  const opLabel = (op: ShiftReportOperation) => {
    const type = op.operation_type.toLowerCase();
    const kind = type === "income" ? "income" : type === "expense" ? "expense" : "other";
    const method = op.payment_method?.toLowerCase();
    const methodText =
      method === "cash"
        ? t("shiftCheck.report.ops.method.cash")
        : method === "click" || method === "card"
          ? t("shiftCheck.report.ops.method.click")
          : t("shiftCheck.report.ops.method.other");
    return { kind, title: t(`shiftCheck.report.ops.${kind}`), methodText };
  };
  const netFlow = operations.reduce((total, op) => {
    const type = op.operation_type.toLowerCase();
    return type === "expense" ? total - Math.abs(op.total) : type === "income" ? total + op.total : total;
  }, 0);

  const autoClosed = report.shift.status === "closed" && (report.close_reason === "auto" || report.auto_close !== null);

  return (
    <>
      {autoClosed ? <AutoClosedBanner report={report} /> : null}
      {report.shift.status === "open" ? (
        <div role="status" className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.info)}>
          <Info aria-hidden="true" size={18} className="mt-px shrink-0" />
          <span className="min-w-0 text-text">{t("shiftCheck.report.openBanner")}</span>
        </div>
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        <StatCard
          label={t("shiftCheck.report.kpi.opening")}
          icon={Wallet}
          value={plain(opening)}
          unit={currency}
          hint={t("shiftCheck.report.kpi.openingHint", { cash: plain(cash.opening_balance), card: plain(card.opening_balance) })}
        />
        <StatCard
          label={t("shiftCheck.report.kpi.income")}
          icon={ArrowDownLeft}
          value={formatSignedMoneyLocalized(income, { language, withCurrency: false })}
          unit={currency}
          valueTone="success"
        />
        <StatCard
          label={t("shiftCheck.report.kpi.expense")}
          icon={ArrowUpRight}
          value={formatSignedMoneyLocalized(-Math.abs(expense), { language, withCurrency: false })}
          unit={currency}
          valueTone="danger"
        />
        <StatCard
          label={t("shiftCheck.report.kpi.closing")}
          icon={WalletCards}
          value={plain(closing)}
          unit={currency}
          hint={cashCounted ? t("shiftCheck.report.kpi.closingCounted") : t("shiftCheck.report.kpi.closingSystem")}
        />
        <StatCard
          label={t("shiftCheck.report.kpi.diff")}
          icon={Scale}
          value={anyDiff ? formatSignedMoneyLocalized(diffTotal, { language, withCurrency: false }) : "—"}
          unit={anyDiff ? currency : undefined}
          valueTone={anyDiff && diffTotal < 0 ? "danger" : undefined}
          hint={t("shiftCheck.report.kpi.diffHint", { cash: signed(cash.discrepancy), card: signed(card.discrepancy) })}
        />
      </div>

      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Banknote aria-hidden="true" size={18} className="text-text-muted" />
            {t("shiftCheck.report.cash.title")}
          </span>
        }
        actions={
          cash.discrepancy === null ? <Badge tone="warning" dot>{t("shiftCheck.report.cash.notCounted")}</Badge> : null
        }
        divided
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          <div className="flex flex-col gap-1 rounded-xl bg-sunken px-4 py-3">
            <span className="text-[13px] text-text-muted">{t("shiftCheck.report.cash.expected")}</span>
            <span className="text-base font-bold text-text">{money(cash.expected_balance)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-sunken px-4 py-3">
            <span className="text-[13px] text-text-muted">{t("shiftCheck.report.cash.counted")}</span>
            {cash.discrepancy === null ? (
              <>
                <span className="text-base font-bold text-text-muted">{t("shiftCheck.report.cash.notCounted")}</span>
                <span className="text-xs text-text-muted">{t("shiftCheck.report.cash.notCountedHint")}</span>
              </>
            ) : (
              <span className="text-base font-bold text-text">{money(cash.closing_balance)}</span>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-sunken px-4 py-3">
            <span className="text-[13px] text-text-muted">{t("shiftCheck.report.cash.diff")}</span>
            <span className={cx("text-base font-bold", diffTone(cash.discrepancy))}>{signed(cash.discrepancy)}</span>
            {cash.discrepancy === null ? (
              <span className="text-xs text-text-muted">{t("shiftCheck.report.cash.diffNotCounted")}</span>
            ) : null}
          </div>
        </div>
      </Card>

      <Card
        padding="none"
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard aria-hidden="true" size={18} className="text-text-muted" />
            {t("shiftCheck.report.accounts.title")}
          </span>
        }
        description={t("shiftCheck.report.accounts.subtitle", { count: accounts.length, checked: checkedByAi })}
        divided
        footer={
          accounts.length ? (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
              <span className="font-semibold text-text">{t("shiftCheck.report.accounts.total")}</span>
              <span className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="whitespace-nowrap text-text-muted">
                  {t("shiftCheck.report.accounts.system")}:{" "}
                  <strong className="font-semibold text-text">{money(accountsTotals.expected)}</strong>
                </span>
                <span className="whitespace-nowrap text-text-muted">
                  {t("shiftCheck.report.accounts.entered")}:{" "}
                  <strong className="font-semibold text-text">{money(accountsTotals.entered)}</strong> ·{" "}
                  {t("shiftCheck.report.accounts.totalCount", { count: accountsTotals.enteredCount })}
                </span>
                <span className={cx("whitespace-nowrap font-semibold", diffTone(accountsTotals.diff))}>
                  {signed(accountsTotals.diff)}
                </span>
              </span>
            </div>
          ) : undefined
        }
      >
        {accounts.length ? (
          <DataTable
            rows={accounts}
            columns={columns}
            getRowKey={(row) => row.card_id}
            label={t("shiftCheck.report.accounts.label")}
            renderCard={renderAccountCard}
            cardsLabel={t("shiftCheck.report.accounts.label")}
          />
        ) : (
          <EmptyState
            icon={CreditCard}
            title={t("shiftCheck.report.accounts.emptyTitle")}
            description={t("shiftCheck.report.accounts.emptyText")}
          />
        )}
      </Card>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          padding="none"
          className="min-w-0 flex-[1_1_320px]"
          title={t("shiftCheck.report.ops.title")}
          description={t("shiftCheck.report.ops.subtitle", { count: opCount })}
          divided
          footer={
            operations.length ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-text">{t("shiftCheck.report.ops.net")}</span>
                <span className={cx("whitespace-nowrap font-bold", netFlow < 0 ? TONE_FG.danger : TONE_FG.success)}>
                  {signed(netFlow)}
                </span>
              </div>
            ) : undefined
          }
        >
          {operations.length ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {operations.map((op) => {
                const label = opLabel(op);
                const Icon = label.kind === "expense" ? ArrowUpRight : ArrowDownLeft;
                const amount = label.kind === "expense" ? -Math.abs(op.total) : op.total;
                return (
                  <li
                    key={`${op.operation_type}-${op.payment_method ?? "none"}`}
                    className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-text">{label.title}</span>
                      <span className="text-[13px] text-text-muted">{label.methodText}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span
                        className={cx(
                          "whitespace-nowrap text-sm font-semibold",
                          amount < 0 ? TONE_FG.danger : TONE_FG.success,
                        )}
                      >
                        {signed(amount)}
                      </span>
                      <span className="text-xs text-text-muted">{t("shiftCheck.report.ops.count", { count: op.count })}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 px-5 py-4 text-[13px] text-text-muted">{t("shiftCheck.report.ops.empty")}</p>
          )}
        </Card>
        {showDeliveries ? <ReportDeliveries report={report} className="min-w-0 flex-[1_1_320px]" /> : null}
      </div>
    </>
  );
};

const ShiftReportPage = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { id } = useParams<{ id: string }>();
  const shiftId = id && /^\d+$/.test(id) ? id : null;
  const query = useShiftReport(shiftId, { pollPending: true });
  const canOpenSettings = useSelector(canManageShiftSettings);
  const report = query.data ?? null;
  const resend = useResendShiftReport();
  const confirm = useConfirm();
  // gWI4gYkw: qayta yuborish va hisobot fayli — faqat superadmin (backend `@Roles(SUPERADMIN)`, `file_url` ham).
  const isSuperadmin = canOpenSettings;
  const sending = report?.report?.status === "pending" || report?.report?.status === "processing";
  const canResend = isSuperadmin && report?.shift.status === "closed";
  const fileUrl = isSuperadmin ? (report?.report?.file_url ?? null) : null;
  const fileIsExcel = report?.report?.file_format === "xlsx";

  const handleResend = async () => {
    if (!shiftId || resend.isPending) return;
    const ok = await confirm({
      title: t("shiftCheck.report.resend.confirmTitle"),
      description: t("shiftCheck.report.resend.confirmText"),
      confirmLabel: t("shiftCheck.report.resend.confirm"),
    });
    if (!ok) return;
    try {
      const result = await resend.mutateAsync(shiftId);
      notify.success(t("shiftCheck.report.resend.done"), {
        description: result.round ? t("shiftCheck.report.deliveries.round", { round: result.round }) : undefined,
      });
    } catch (error) {
      notify.error(t("shiftCheck.report.resend.failed"), { description: getApiErrorMessage(error) || undefined });
    }
  };

  const cashbox =
    report?.cashbox_type === "branch" ? t("shiftCheck.report.branchCashbox") : t("shiftCheck.report.mainCashbox");
  const range = report
    ? [report.shift.opened_at, report.shift.closed_at]
        .filter(Boolean)
        .map((value) => formatDateTimeLocalized(value as string, { language }))
        .join(" – ")
    : "";

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/payments/main-cashbox"
        backLabel={t("shiftCheck.report.back")}
        title={t("shiftCheck.report.title")}
        description={report ? t("shiftCheck.report.subtitle", { cashbox, range }) : undefined}
        actions={
          canOpenSettings ? (
            <>
              <Link to="/payments/shift-settings" className={buttonClasses({ variant: "secondary" })}>
                <Settings aria-hidden="true" size={18} />
                {t("shiftCheck.accounts.settings")}
              </Link>
              {fileUrl ? (
                <a href={fileUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
                  {fileIsExcel ? <Download aria-hidden="true" size={18} /> : <FileText aria-hidden="true" size={18} />}
                  {fileIsExcel ? t("shiftCheck.report.file.xlsx") : t("shiftCheck.report.file.pdf")}
                </a>
              ) : null}
              {canResend ? (
                <Button
                  leftIcon={Send}
                  onClick={() => void handleResend()}
                  disabled={sending}
                  loading={resend.isPending}
                  loadingText={t("shiftCheck.report.resend.sending")}
                >
                  {t("shiftCheck.report.resend.action")}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {shiftId ? (
        <QueryBoundary
          query={query}
          skeleton="table"
          empty={<EmptyState icon={Info} title={t("shiftCheck.report.notFound")} />}
        >
          {(data) =>
            // `normalizeShiftReport` smena qatorisiz javobda `null` qaytaradi.
            (data as ShiftReport | null) ? (
              <ReportBody report={data} showDeliveries={isSuperadmin} />
            ) : (
              <EmptyState icon={Info} title={t("shiftCheck.report.notFound")} />
            )
          }
        </QueryBoundary>
      ) : (
        <EmptyState icon={Info} title={t("shiftCheck.report.notFound")} />
      )}
    </div>
  );
};

export default ShiftReportPage;
