// dizayn-v2: (maket yo'q) market_operator-earnings, superadmin-ops-finance-operators
import { useMemo, useRef, useState, type FormEvent } from "react";
import { HandCoins, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  newOperatorPaymentKey,
  useOperatorBalances,
  useRecordOperatorPayment,
} from "../../../entities/operator-payment";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatMoneyLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  DateInput,
  Dialog,
  Field,
  Select,
  TextInput,
  useConfirm,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  PAYMENT_NOTE_MAX,
  parseAmountDigits,
  paymentHttpStatus,
  todayIso,
  PAYMENT_DATE_MIN,
  isUnknownPaymentOutcome,
  validatePaymentForm,
  type PaymentFormErrors,
} from "../model/operatorPayments";
import { PaymentNotice } from "./PaymentNotice";

export type PaymentDialogOperator = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Qator menyusidan ochilsa — tanlangan operator (ro'yxatda bo'lmasa ham variant sifatida qo'shiladi). */
  operator?: PaymentDialogOperator | null;
};

/**
 * «TO'LOV YOZISH» (F2qp6FtE, ega qarori 2026-11-16) — market o'z operatoriga o'zi bergan pulni yozib qo'yadi. Elchi
 * kassasiga TA'SIR QILMAYDI (oynada va tasdiqda aytiladi). Maket yo'q — eng yaqini: `market_operator-earnings`
 * («Hisob», «To'lovlar») va `superadmin-ops-finance-operators` («To'lov qayd qilish» formasi + tasdiq).
 *
 * Maydonlar: Operator* (qoldig'i bilan), Summa* (so'm), To'lov sanasi* (sukut — bugun, kelajak — yo'q), Izoh (≤ 500).
 * Summa qoldiqdan oshsa — ogohlantirish (bloklamaydi: avans mumkin, qoldiq manfiy bo'ladi). «To'lov yozish» → tasdiq
 * (`useConfirm`: summa, operator, sana, izoh, «yozuvdan keyingi qoldiq») → `POST finance/operator-payments` +
 * `Idempotency-Key` (oyna ochilganda bitta kalit — natija noma'lum bo'lib qayta bosilsa ikkinchi yozuv bo'lmaydi;
 * takror — «allaqachon yozilgan», 409 — kalit boshqa summada ishlatilgan). Xato — tasdiq oynasi ichida.
 */
export const RecordOperatorPaymentDialog = ({ open, onClose, operator }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const confirm = useConfirm();
  const balances = useOperatorBalances({ enabled: open });
  const record = useRecordOperatorPayment();
  // Bitta oyna — bitta mantiqiy to'lov: kalit oyna ochilganda (komponent kaliti bilan qayta yaratiladi) tug'iladi.
  const idempotencyKey = useRef(newOperatorPaymentKey());
  const submittingRef = useRef(false);
  const today = todayIso();

  const [operatorId, setOperatorId] = useState(operator?.id ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const busy = record.isPending;

  const items = useMemo(() => balances.data?.items ?? [], [balances.data?.items]);
  const selected = items.find((item) => item.operatorId === operatorId) ?? null;
  const operatorName = selected?.operatorName || (operator?.id === operatorId ? operator.name : "") || "";
  const amount = parseAmountDigits(amountInput);

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = items.map((item) => ({
      value: item.operatorId,
      label: item.operatorName || item.operatorId,
      description:
        (item.balance < 0
          ? t("payments.form.operatorOverpaid", { amount: formatMoneyLocalized(-item.balance, { language }) })
          : t("payments.form.operatorBalance", { amount: formatMoneyLocalized(item.balance, { language }) })) +
        (item.status === "inactive" ? ` · ${t("status.inactive")}` : ""),
    }));
    if (operator && !list.some((option) => option.value === operator.id)) {
      list.unshift({ value: operator.id, label: operator.name });
    }
    return list;
  }, [items, operator, t, language]);

  const clearError = (key: keyof PaymentFormErrors) =>
    setErrors((previous) => (previous[key] ? { ...previous, [key]: undefined } : previous));

  const errorText = (key: keyof PaymentFormErrors) => {
    const code = errors[key];
    return code ? t(`payments.form.errors.${code}`) : undefined;
  };

  const amountHint = (() => {
    if (!selected) return undefined;
    if (amount > 0 && amount > selected.balance && selected.balance >= 0) {
      return t("payments.form.amountOver", { amount: money(amount - selected.balance) });
    }
    return selected.balance < 0
      ? t("payments.form.amountHintOverpaid", { amount: money(-selected.balance) })
      : t("payments.form.amountHint", { amount: money(selected.balance) });
  })();

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    const nextErrors = validatePaymentForm({ operatorId, amount, paidAt }, today);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    submittingRef.current = true;
    const trimmedNote = note.trim();
    let replayed = false;
    try {
      const ok = await confirm({
        tone: "primary",
        icon: HandCoins,
        title: t("payments.confirm.title"),
        description: t("payments.confirm.description"),
        amount: { value: amount, label: t("payments.confirm.amount") },
        rows: [
          { label: t("payments.confirm.operator"), value: operatorName || operatorId },
          { label: t("payments.confirm.date"), value: formatDateLocalized(paidAt, { language }) },
          ...(selected
            ? [{ label: t("payments.confirm.balanceAfter"), value: money(selected.balance - amount) }]
            : []),
          ...(trimmedNote ? [{ label: t("payments.confirm.note"), value: trimmedNote, stacked: true }] : []),
        ],
        note: t("payments.confirm.hint"),
        confirmLabel: t("payments.confirm.confirm"),
        confirmIcon: HandCoins,
        loadingLabel: t("payments.confirm.loading"),
        errorMessage: (error) => {
          const status = paymentHttpStatus(error);
          if (status === 409) return t("payments.confirm.conflict");
          if (status === 404) return t("payments.confirm.notFound");
          // Javob yo'q yoki 5xx — yozuv yaratilgan bo'lishi mumkin: oynani yopmasdan qayta bosish (o'sha
          // `Idempotency-Key`) ikkinchi yozuv yaratmaydi. Yopib qayta ochish — yangi kalit, ya'ni ikkinchi yozuv.
          if (isUnknownPaymentOutcome(status)) return t("payments.confirm.unknown");
          // 400 / 403 — backend sababi (sana, chegara, ruxsat) aniq: uni ko'rsatamiz, «qayta urining» emas.
          return getBackendErrorMessage(error) ?? t("payments.confirm.failed");
        },
        onConfirm: async () => {
          const result = await record.mutateAsync({
            body: {
              operator_id: operatorId,
              amount,
              paid_at: paidAt,
              ...(trimmedNote ? { note: trimmedNote } : {}),
            },
            idempotencyKey: idempotencyKey.current,
          });
          replayed = result.idempotent;
        },
      });
      if (!ok) return;
      if (replayed) notify.info(t("payments.confirm.replayed"));
      else
        notify.success(t("payments.confirm.done"), {
          description: t("payments.confirm.doneText", { name: operatorName, amount: money(amount) }),
        });
      onClose();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="md"
      icon={HandCoins}
      title={t("payments.form.title")}
      description={t("payments.form.description")}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("payments.form.cancel")}
          </Button>
          <Button type="submit" leftIcon={HandCoins} loading={busy} disabled={balances.isError && !operator}>
            {t("payments.form.submit")}
          </Button>
        </>
      }
    >
      <PaymentNotice>{t("payments.form.notice")}</PaymentNotice>

      {balances.isError ? (
        <PaymentNotice tone="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("payments.form.balancesFailed")}</span>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={RotateCw}
              loading={balances.isFetching}
              onClick={() => void balances.refetch()}
            >
              {t("payments.form.retry")}
            </Button>
          </span>
        </PaymentNotice>
      ) : null}

      <Field labelAs="span" label={t("payments.form.operator")} required error={errorText("operator")}>
        <Select
          value={operatorId || null}
          onChange={(value) => {
            setOperatorId(value ?? "");
            clearError("operator");
          }}
          options={options}
          searchable={options.length > 7}
          disabled={busy}
          loading={balances.isLoading && !operator}
          placeholder={t("payments.form.operatorPlaceholder")}
          listLabel={t("payments.form.operatorList")}
        />
      </Field>

      <Field label={t("payments.form.amount")} required error={errorText("amount")} hint={amountHint} hintLive>
        <TextInput
          mode="money"
          size="lg"
          value={amountInput}
          onValueChange={(value) => {
            setAmountInput(value);
            clearError("amount");
          }}
          placeholder="0"
          autoComplete="off"
          disabled={busy}
          suffix={<Badge>{CURRENCY_LABEL[language]}</Badge>}
        />
      </Field>

      <Field labelAs="span" label={t("payments.form.date")} required error={errorText("date")}>
        <DateInput
          value={paidAt}
          onChange={(value) => {
            setPaidAt(value);
            clearError("date");
          }}
          min={PAYMENT_DATE_MIN}
          max={today}
          clearable={false}
          disabled={busy}
        />
      </Field>

      <Field label={t("payments.form.note")} optional>
        <TextInput
          multiline
          rows={2}
          value={note}
          maxLength={PAYMENT_NOTE_MAX}
          onValueChange={setNote}
          placeholder={t("payments.form.notePlaceholder")}
          disabled={busy}
        />
      </Field>
    </Dialog>
  );
};
