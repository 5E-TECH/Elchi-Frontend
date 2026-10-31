// dizayn-v2: superadmin-payments-history-detail-dialog-receipt, admin-payments-history-detail-dialog-receipt, manager-payments-history-detail-dialog-receipt, superadmin-payments-history-detail-receipt-states, superadmin-payments-history-receipt-reanalyze-confirm
import { useId, useState, type ReactNode } from "react";
import { CircleX, Clock, FileImage, Info, Receipt, RefreshCw, ScanLine, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import {
  getReceiptErrorCode,
  useReanalyzeReceipt,
  useReceipt,
  type ReceiptDetail,
} from "../../../../entities/payments/receipt";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
} from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { Button, Pressable, Skeleton, Spinner, TONE_SOFT, useConfirm } from "../../../../shared/ui/primitives";
import ReceiptViewerDialog from "./ReceiptViewerDialog";
import { ReceiptStatusBadge } from "./ReceiptStatusBadge";

/**
 * «CHEK» BO'LIMI — kassa yozuvi tafsilotida (QlLf33Ma, 8-bosqich; maketlar `*-history-detail-dialog-receipt`,
 * `superadmin-payments-history-detail-receipt-states`). `GET finance/receipts/:id`: holat belgisi, eskiz → ko'ruvchi,
 * «Chekda / Kiritilgan / Farq» solishtiruvi, AI o'qigan maydonlar, bayroqlar (ogohlantirish, holatni o'zgartirmaydi),
 * kim yuklagan va qachon tekshirilgan. Olti holat + `ai_stale` (3 daqiqadan oshgan `pending`).
 *
 * `pending` da natija o'zi chiqadi: realtime `finance.receipt.checked` so'rovni yangilaydi, socket bo'lmasa — 5 s lik so'rov
 * (`useReceipt`). «Qayta tahlil» — `can_reanalyze` bo'yicha, tasdiq oynasi bilan; xato oyna ichida (kod bo'yicha matn).
 * Menejer faqat ko'radi. Karta raqami chiqmaydi: backend faqat oxirgi 4 ta raqamni beradi.
 */

const KV = "m-0 grid grid-cols-[minmax(110px,36%)_1fr] gap-x-4 gap-y-2 text-sm";
const DT = "m-0 text-text-muted";
const DD = "m-0 min-w-0 font-semibold [overflow-wrap:anywhere] text-text";

/** AI sana maydoni erkin matn (rasmdan o'qilgan): sana bo'lmasa — o'zi ko'rsatiladi. */
const dateValue = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDateTimeLocalized(date);
};

const partyValue = (name: string | null, last4: string | null) => {
  if (!name && !last4) return null;
  return (
    <>
      {name}
      {name && last4 ? " · " : null}
      {last4 ? <span className="whitespace-nowrap">··{last4}</span> : null}
    </>
  );
};

type ReasonLine = { icon: LucideIcon | null; text: string; tone: string; live?: boolean };

const ReasonText = ({ line }: { line: ReasonLine }) => {
  const Icon = line.icon;
  return (
    <p role={line.live ? "status" : undefined} className="m-0 flex items-start gap-2 text-[13px] text-text">
      {Icon ? (
        <Icon aria-hidden="true" size={16} className={cx("mt-px shrink-0", line.tone)} />
      ) : (
        <span className={cx("mt-px shrink-0", line.tone)}>
          <Spinner size="sm" />
        </span>
      )}
      <span className="min-w-0">{line.text}</span>
    </p>
  );
};

const FlagsAlert = ({ receipt }: { receipt: ReceiptDetail }) => {
  const { t } = useTranslation("payments");
  const flags = receipt.ai?.flags ?? [];
  if (flags.length === 0) return null;
  const isExpense = receipt.kind === "manual_expense";
  const flagText = (flag: string) => {
    if (flag === "date_far") {
      return t("receipt.flags.date_far.text", { date: dateValue(receipt.ai?.date ?? null) ?? "—" });
    }
    if (flag === "card_mismatch") {
      const last4 = isExpense ? receipt.ai?.payer_last4 : receipt.ai?.recipient_last4;
      return t(isExpense ? "receipt.flags.card_mismatch.textExpense" : "receipt.flags.card_mismatch.text", {
        last4: last4 ?? "—",
      });
    }
    return t(`receipt.flags.${flag}.text`);
  };
  return (
    <div role="status" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-3.5 py-2.5 text-sm", TONE_SOFT.warning)}>
      <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-text">
        <div className="font-bold">{t("receipt.flags.title", { n: flags.length })}</div>
        <ul className="m-0 mt-1 flex flex-col gap-1 pl-[18px] text-[13px]">
          {flags.map((flag) => (
            <li key={flag}>
              <span className="font-semibold">{t(`receipt.flags.${flag}.title`)}</span> — {flagText(flag)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ReceiptBody = ({ receipt, operation, onReload }: { receipt: ReceiptDetail; operation: string; onReload: () => void }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const isManager = String(role).toLowerCase() === "manager";
  const confirm = useConfirm();
  const reanalyze = useReanalyzeReceipt();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const { ai, ai_status: status, ai_stale: stale } = receipt;
  const money = (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language }));

  const statusBadge = <ReceiptStatusBadge status={status} stale={stale} />;
  const attempts = ai?.attempts ?? 0;
  const maxAttempts = ai?.max_attempts ?? 5;
  const exhausted = attempts >= maxAttempts && (status === "mismatch" || status === "unreadable" || status === "error");

  const reasonLine: ReasonLine | null = stale
    ? { icon: Clock, text: t("receipt.section.staleText"), tone: "text-warning-fg" }
    : status === "pending"
      ? { icon: null, text: t("receipt.section.pendingText"), tone: "text-warning-fg", live: true }
      : status === "unreadable"
        ? { icon: TriangleAlert, text: t("receipt.section.unreadableText"), tone: "text-warning-fg" }
        : status === "error"
          ? { icon: CircleX, text: t("receipt.section.errorText"), tone: "text-danger-fg" }
          : status === "disabled"
            ? { icon: Info, text: t("receipt.section.disabledText"), tone: "text-text-muted" }
            : null;

  const compared = (status === "match" || status === "mismatch") && !stale;
  const difference = ai?.difference ?? 0;
  const compare: Array<[string, ReactNode]> = [
    [t("receipt.section.onReceipt"), money(ai?.amount ?? null)],
    [t("receipt.section.entered"), money(receipt.entered_amount)],
    [
      t("receipt.section.difference"),
      <span key="difference" className={status === "mismatch" ? "text-danger-fg" : undefined}>
        {formatSignedMoneyLocalized(difference, { language })}
      </span>,
    ],
  ];

  const kvRows: Array<[string, ReactNode]> = (
    [
      [t("receipt.section.date"), dateValue(ai?.date ?? null)],
      [t("receipt.section.recipient"), partyValue(ai?.recipient ?? null, ai?.recipient_last4 ?? null)],
      [t("receipt.section.payer"), partyValue(ai?.payer ?? null, ai?.payer_last4 ?? null)],
      [t("receipt.section.bank"), ai?.bank ?? null],
      [t("receipt.section.reference"), ai?.reference ? <span className="whitespace-nowrap">{ai.reference}</span> : null],
      [
        t("receipt.section.confidence"),
        ai?.confidence !== null && ai?.confidence !== undefined
          ? formatPercentLocalized(ai.confidence * 100, { language, fractionDigits: 0 })
          : null,
      ],
    ] as Array<[string, ReactNode]>
  ).filter(([, value]) => value !== null && value !== undefined);

  const reanalyzeError = (error: unknown): ReactNode => {
    const code = getReceiptErrorCode(error);
    const known =
      code === "RECEIPT_AI_PENDING" ||
      code === "RECEIPT_AI_ATTEMPTS_EXHAUSTED" ||
      code === "RECEIPT_AI_DISABLED" ||
      code === "RECEIPT_ALREADY_MATCHED";
    const hasResponse = Boolean((error as { response?: unknown } | null)?.response);
    const key = known ? code : hasResponse ? "generic" : "offline";
    return (
      <span className="flex min-w-0 flex-col">
        <span className="font-bold">{t(`receipt.reanalyze.errors.${key}.title`)}</span>
        <span>{t(`receipt.reanalyze.errors.${key}.text`)}</span>
      </span>
    );
  };

  const requestReanalyze = async () => {
    const ok = await confirm({
      tone: "primary",
      icon: ScanLine,
      title: t("receipt.reanalyze.title"),
      description: t("receipt.reanalyze.description"),
      rows: [
        { label: t("receipt.reanalyze.operation"), value: operation },
        { label: t("receipt.reanalyze.entered"), value: money(receipt.entered_amount) },
        { label: t("receipt.reanalyze.current"), value: statusBadge },
        { label: t("receipt.reanalyze.attempts"), value: `${attempts} / ${maxAttempts}` },
      ],
      confirmLabel: t("receipt.reanalyze.confirm"),
      confirmIcon: ScanLine,
      loadingLabel: t("receipt.reanalyze.sending"),
      onConfirm: () => reanalyze.mutateAsync(receipt.id),
      errorMessage: reanalyzeError,
    });
    if (ok) notify.success(t("common:success"), { description: t("receipt.reanalyze.success") });
  };

  const uploaded = [receipt.uploaded_by?.name, dateValue(receipt.uploaded_at)].filter(Boolean).join(" · ");
  const checkedAt = status === "pending" || status === "disabled" || status === "error" ? null : dateValue(ai?.checked_at ?? null);

  return (
    <>
      <div className="flex items-start gap-3.5">
        <Pressable
          aria-haspopup="dialog"
          aria-label={t("receipt.field.zoom")}
          onClick={() => setViewerOpen(true)}
          className="inline-flex shrink-0 cursor-zoom-in rounded-[10px]"
        >
          {receipt.photo_url && !thumbBroken ? (
            <img
              src={receipt.photo_url}
              alt=""
              onError={() => setThumbBroken(true)}
              className="h-24 w-[72px] rounded-[10px] border border-border-strong bg-surface object-cover"
            />
          ) : (
            <span className="grid h-24 w-[72px] place-items-center rounded-[10px] border border-border-strong bg-surface text-text-muted">
              <FileImage aria-hidden="true" size={24} />
            </span>
          )}
        </Pressable>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {compared ? (
            <dl
              role="group"
              aria-label={t("receipt.section.compare")}
              className={cx(
                "m-0 flex flex-col divide-y divide-border rounded-[10px] px-3 py-0.5",
                status === "mismatch" ? "bg-danger-soft" : "bg-success-soft",
              )}
            >
              {compare.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 py-1.5">
                  <dt className="m-0 text-[13px] text-text">{label}</dt>
                  <dd className="m-0 font-semibold whitespace-nowrap text-text">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {reasonLine ? <ReasonText line={reasonLine} /> : null}
        </div>
      </div>

      {kvRows.length > 0 ? (
        <dl className={KV}>
          {kvRows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className={DT}>{label}</dt>
              <dd className={DD}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <FlagsAlert receipt={receipt} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <span className="flex min-w-0 flex-col gap-0.5 text-xs text-text-muted">
          {uploaded ? <span>{t("receipt.section.uploadedBy", { value: uploaded })}</span> : null}
          {checkedAt ? <span>{t("receipt.section.checkedAt", { value: checkedAt })}</span> : null}
        </span>
        {receipt.can_reanalyze ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={ScanLine}
            aria-haspopup="dialog"
            onClick={() => void requestReanalyze()}
            className="max-md:min-h-11"
          >
            {t("receipt.reanalyze.confirm")}
          </Button>
        ) : exhausted && !isManager ? (
          <span className="flex items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={ScanLine} disabled className="max-md:min-h-11">
              {t("receipt.reanalyze.confirm")}
            </Button>
            <span className="text-xs text-text-muted">
              {t("receipt.section.attemptsOver", { attempts, max: maxAttempts })}
            </span>
          </span>
        ) : null}
      </div>

      <ReceiptViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        src={receipt.photo_url}
        openUrl={receipt.photo_url}
        description={[operation, money(receipt.entered_amount)].filter(Boolean).join(" · ")}
        onReload={onReload}
      />
    </>
  );
};

const ReceiptSection = ({ receiptId, operation }: { receiptId: string; operation: string }) => {
  const { t } = useTranslation("payments");
  const headingId = useId();
  const query = useReceipt(receiptId);
  const receipt = query.data ?? null;
  const reload = () => void query.refetch();

  return (
    <section
      aria-labelledby={headingId}
      data-testid="receipt-section"
      className="flex flex-col gap-3 rounded-xl bg-sunken px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 id={headingId} className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-text">
          <Receipt aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
          {t("receipt.section.title")}
        </h3>
        {receipt ? <ReceiptStatusBadge status={receipt.ai_status} stale={receipt.ai_stale} /> : null}
      </div>
      {receipt ? (
        <ReceiptBody receipt={receipt} operation={operation} onReload={reload} />
      ) : query.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex min-w-0 flex-[1_1_200px] items-center gap-2">
            <CircleX aria-hidden="true" size={18} className="shrink-0 text-danger-fg" />
            <span className="text-[13px] font-semibold text-text">{t("receipt.section.loadError")}</span>
          </span>
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={reload} className="max-md:min-h-11">
            {t("receipt.section.retry")}
          </Button>
        </div>
      ) : (
        <div className="flex gap-3.5" aria-busy="true">
          <span className="sr-only" role="status">
            {t("receipt.section.loading")}
          </span>
          <Skeleton shape="block" tone="border" className="block h-24 w-[72px] shrink-0" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton shape="line" tone="border" width="80%" />
            <Skeleton shape="line" tone="border" width="60%" />
            <Skeleton shape="line" tone="border" width="70%" />
          </div>
        </div>
      )}
    </section>
  );
};

export default ReceiptSection;
