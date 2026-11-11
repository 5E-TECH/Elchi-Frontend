// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-accounts — eng yaqini «Naqddan kartaga» o'tkazmasi izohi
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, Banknote, CreditCard, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isGenericForbiddenError } from "../../../../shared/lib/forbiddenError";
import {
  useConvertCashboxCard,
  useRefreshCashboxCards,
  type CashboxCard,
  type CashboxCardConvertBody,
} from "../../../../entities/payments/cashboxCards";
import { CURRENCY_LABEL, formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  Button,
  Dialog,
  Field,
  SegmentedControl,
  Select,
  TextInput,
  useConfirm,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { parseAmountInput } from "../lib/amountInput";
import { cardConvertFingerprint, isUncertainCardMoveError, sendIdempotent } from "./cardMeta";
import { CardNotice } from "./cardUi";

/**
 * «KARTA ↔ NAQD» (BeePost CardsManager «Karta ↔ Naqd»; maket yo'q — eng yaqini `superadmin-payments-main-cashbox-accounts`
 * va forma oynasidagi «Naqddan kartaga» izohi). Kassa jami qoldig'i o'zgarmaydi: pul karta va naqd orasida ko'chadi.
 *
 * Yo'nalish segmenti («Kartadan → Naqdga» · «Naqddan → Kartaga»), Karta (faol kartalar), Summa (> 0; kartadan — karta
 * qoldig'idan, naqddan — naqd kassadan oshmaydi), «Joriy naqd kassa: N», Sabab*. Jonli izoh, so'ng tasdiq (`useConfirm`)
 * → `POST finance/cashbox/cards/convert` + `Idempotency-Key` (barmoq izi `["card-convert", type, card, amount]`).
 */

type Direction = CashboxCardConvertBody["type"];
type Errors = Partial<Record<"card" | "amount" | "comment", string>>;

export type CardConvertDialogProps = {
  open: boolean;
  onClose: () => void;
  cards: readonly CashboxCard[];
  /** Kassadagi naqd qoldiq (sahifadagi «Naqd»). */
  cashBalance: number;
  initialCardId?: string | null;
  shiftLocked: boolean;
};

export const CardConvertDialog = ({ open, onClose, cards, cashBalance, initialCardId, shiftLocked }: CardConvertDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const confirm = useConfirm();
  const convert = useConvertCashboxCard();
  const refreshCards = useRefreshCashboxCards();
  const submittingRef = useRef(false);
  const [direction, setDirection] = useState<Direction>("card_to_cash");
  const [cardId, setCardId] = useState<string>(initialCardId ?? cards.find((card) => card.is_default)?.id ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const busy = convert.isPending;

  const card = cards.find((item) => item.id === cardId) ?? null;
  const amount = parseAmountInput(amountInput);
  const cardToCash = direction === "card_to_cash";

  const cardOptions = useMemo<SelectOption[]>(
    () =>
      cards.map((item) => ({
        value: item.id,
        label: item.name,
        description: t("cashboxCards.money.available", { amount: formatMoneyLocalized(item.balance, { language }) }),
      })),
    [cards, language, t],
  );

  const clearError = (key: keyof Errors) => setErrors((previous) => (previous[key] ? { ...previous, [key]: undefined } : previous));

  const validate = (): Errors => {
    const next: Errors = {};
    if (!card) next.card = t("cashboxCards.money.sourceRequired");
    if (amount <= 0) next.amount = amountInput ? t("cashboxCards.money.amountPositive") : t("cashboxCards.money.amountRequired");
    else if (cardToCash && card && amount > card.balance)
      next.amount = t("cashboxCards.money.amountTooBig", { amount: money(Math.max(0, card.balance)) });
    else if (!cardToCash && amount > cashBalance)
      next.amount = t("cashboxCards.money.cashTooBig", { amount: money(Math.max(0, cashBalance)) });
    if (!comment.trim()) next.comment = t("cashboxCards.money.reasonRequired");
    return next;
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy || shiftLocked) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !card) return;
    submittingRef.current = true;
    const reason = comment.trim();
    const cashParty = { title: t("cashboxCards.convert.cash"), meta: t("cashboxCards.money.available", { amount: money(cashBalance) }) };
    const cardParty = { title: card.name, meta: t("cashboxCards.money.available", { amount: money(card.balance) }) };
    let replay = false;
    try {
      const ok = await confirm({
        tone: "primary",
        icon: ArrowLeftRight,
        title: t("cashboxCards.convert.confirmTitle"),
        description: t("cashboxCards.convert.subtitle"),
        amount: { value: amount },
        transfer: cardToCash ? { from: cardParty, to: cashParty } : { from: cashParty, to: cardParty },
        rows: [{ label: t("cashboxCards.money.reason"), value: reason, stacked: true }],
        confirmLabel: t("cashboxCards.convert.submit"),
        confirmIcon: ArrowLeftRight,
        loadingLabel: t("cashboxCards.money.sending"),
        errorView: (error) =>
          isUncertainCardMoveError(error)
            ? { content: t("cashboxCards.money.uncertain") }
            : // Umumiy inglizcha 403 («Forbidden resource») — o'zbekcha matn (menejerga backend ochilguncha).
              isGenericForbiddenError(error)
              ? { content: t("cashboxCards.money.forbidden") }
              : null,
        onConfirm: async () => {
          const result = await sendIdempotent({
            fingerprint: cardConvertFingerprint(direction, card.id, amount),
            send: (idempotencyKey) =>
              convert.mutateAsync({ body: { type: direction, card_id: card.id, amount, comment: reason }, idempotencyKey }),
            onUncertain: () => void refreshCards(),
          });
          replay = result.replay;
        },
      });
      if (!ok) return;
      if (replay) notify.info(t("cashboxCards.money.replayed"));
      else notify.success(t("cashboxCards.convert.done"));
      onClose();
    } finally {
      submittingRef.current = false;
    }
  };

  const preview =
    card && amount > 0
      ? t(cardToCash ? "cashboxCards.convert.previewCardToCash" : "cashboxCards.convert.previewCashToCard", {
          card: card.name,
          amount: money(amount),
        })
      : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="md"
      icon={ArrowLeftRight}
      title={t("cashboxCards.convert.title")}
      description={t("cashboxCards.convert.subtitle")}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("cashboxCards.form.cancel")}
          </Button>
          <Button type="submit" leftIcon={ArrowLeftRight} disabled={shiftLocked} loading={busy}>
            {t("cashboxCards.convert.submit")}
          </Button>
        </>
      }
    >
      {shiftLocked ? (
        <CardNotice tone="warning" icon={Lock}>
          {t("cashboxCards.money.shiftLocked")}
        </CardNotice>
      ) : null}

      <Field labelAs="span" label={t("cashboxCards.convert.direction")}>
        <SegmentedControl<Direction>
          ariaLabel={t("cashboxCards.convert.direction")}
          fullWidth
          value={direction}
          onValueChange={(value) => {
            setDirection(value);
            clearError("amount");
          }}
          options={[
            { value: "card_to_cash", label: t("cashboxCards.convert.cardToCash"), icon: Banknote },
            { value: "cash_to_card", label: t("cashboxCards.convert.cashToCard"), icon: CreditCard },
          ]}
        />
      </Field>

      <Field labelAs="span" label={t("cashboxCards.convert.card")} required error={errors.card}>
        <Select
          value={cardId || null}
          onChange={(value) => {
            setCardId(value ?? "");
            clearError("card");
          }}
          options={cardOptions}
          placeholder={t("cashboxCards.money.selectCard")}
          listLabel={t("cashboxCards.money.cardsList")}
        />
      </Field>

      <Field
        label={t("cashboxCards.money.amount")}
        required
        hint={t("cashboxCards.convert.currentCash", { amount: money(cashBalance) })}
        error={errors.amount}
      >
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
          suffix={<Badge>{CURRENCY_LABEL[language]}</Badge>}
        />
      </Field>

      <Field label={t("cashboxCards.money.reason")} required error={errors.comment}>
        <TextInput
          multiline
          rows={2}
          value={comment}
          maxLength={1000}
          onValueChange={(value) => {
            setComment(value);
            clearError("comment");
          }}
          placeholder={t("cashboxCards.convert.reasonPlaceholder")}
        />
      </Field>

      {preview ? (
        <CardNotice tone="info" icon={ArrowLeftRight}>
          <span aria-live="polite">{preview}</span>
        </CardNotice>
      ) : null}
    </Dialog>
  );
};
