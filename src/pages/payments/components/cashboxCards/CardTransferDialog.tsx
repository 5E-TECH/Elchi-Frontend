// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-accounts — eng yaqini «Kartalararo o'tkazma» tugmasi
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isGenericForbiddenError } from "../../../../shared/lib/forbiddenError";
import {
  useRefreshCashboxCards,
  useTransferCashboxCards,
  type CashboxCard,
} from "../../../../entities/payments/cashboxCards";
import { CURRENCY_LABEL, formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { Badge, Button, Dialog, Field, Select, TextInput, useConfirm, type SelectOption } from "../../../../shared/ui/primitives";
import { parseAmountInput } from "../lib/amountInput";
import { cardTransferFingerprint, isUncertainCardMoveError, sendIdempotent } from "./cardMeta";
import { CardNotice } from "./cardUi";

/**
 * «KARTALARARO O'TKAZMA» (BeePost CardsManager «Kartalararo o'tkazma»; maket yo'q — eng yaqini
 * `superadmin-payments-main-cashbox-accounts` dagi tugma va `tizim-feedback` 06 «Pul o'tkazmasi — tekshirish»).
 *
 * Qaysi kartadan (faol kartalar, «nom — qoldiq») → qaysi kartaga (tanlangan kartadan boshqa), Summa (> 0, manba karta
 * qoldig'idan oshmaydi), Sabab* (1..1000). Jonli izoh: «A kartasidan B kartasiga N o'tkaziladi». «O'tkazish» →
 * tasdiq (`useConfirm`: summa, qayerdan → qayerga, sabab) → `POST finance/cashbox/cards/transfer` + `Idempotency-Key`
 * (barmoq izi `["card-transfer", from, to, amount]`). Backend xatosi (smena yopiq, qoldiq yetmaydi …) — tasdiq oynasida
 * aynan; natija noma'lum (504, tarmoq) — ro'yxat qayta o'qiladi, qayta bosish o'sha kalit bilan (xavfsiz).
 *
 * Smena yopiq (`shiftLocked`) — yuborish o'chiq, sababi tepada (sahifadagi boshqa pul amallari kabi).
 */

type Errors = Partial<Record<"from" | "to" | "amount" | "comment", string>>;

export type CardTransferDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Faol kartalar (Asosiy birinchi). */
  cards: readonly CashboxCard[];
  /** Ochilganda tanlangan manba karta. */
  initialFromId?: string | null;
  /** Ochilganda tanlangan manzil karta («Mos kelmaydi» → «Asosiy kartaga o'tkazish»). */
  initialToId?: string | null;
  shiftLocked: boolean;
};

export const CardTransferDialog = ({ open, onClose, cards, initialFromId, initialToId, shiftLocked }: CardTransferDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const confirm = useConfirm();
  const transfer = useTransferCashboxCards();
  const refreshCards = useRefreshCashboxCards();
  const submittingRef = useRef(false);
  const [fromId, setFromId] = useState<string>(initialFromId ?? "");
  const [toId, setToId] = useState<string>(initialToId && initialToId !== initialFromId ? initialToId : "");
  const [amountInput, setAmountInput] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const busy = transfer.isPending;

  const from = cards.find((card) => card.id === fromId) ?? null;
  const to = cards.find((card) => card.id === toId) ?? null;
  const amount = parseAmountInput(amountInput);

  const fromOptions = useMemo<SelectOption[]>(
    () =>
      cards.map((card) => ({
        value: card.id,
        label: card.name,
        description: t("cashboxCards.money.available", { amount: formatMoneyLocalized(card.balance, { language }) }),
      })),
    [cards, language, t],
  );
  const toOptions = useMemo(() => fromOptions.filter((option) => option.value !== fromId), [fromOptions, fromId]);

  const clearError = (key: keyof Errors) => setErrors((previous) => (previous[key] ? { ...previous, [key]: undefined } : previous));

  const validate = (): Errors => {
    const next: Errors = {};
    if (!from) next.from = t("cashboxCards.money.sourceRequired");
    if (!to) next.to = t("cashboxCards.money.sourceRequired");
    else if (to.id === from?.id) next.to = t("cashboxCards.money.sameCard");
    if (amount <= 0) next.amount = amountInput ? t("cashboxCards.money.amountPositive") : t("cashboxCards.money.amountRequired");
    else if (from && amount > from.balance) next.amount = t("cashboxCards.money.amountTooBig", { amount: money(Math.max(0, from.balance)) });
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
    if (Object.values(nextErrors).some(Boolean) || !from || !to) return;
    submittingRef.current = true;
    const reason = comment.trim();
    let replay = false;
    try {
      const ok = await confirm({
        tone: "primary",
        icon: ArrowLeftRight,
        title: t("cashboxCards.transfer.confirmTitle"),
        description: t("cashboxCards.transfer.confirmDescription"),
        amount: { value: amount },
        transfer: {
          from: { title: from.name, meta: t("cashboxCards.money.available", { amount: money(from.balance) }) },
          to: { title: to.name, meta: t("cashboxCards.money.available", { amount: money(to.balance) }) },
        },
        rows: [{ label: t("cashboxCards.money.reason"), value: reason, stacked: true }],
        confirmLabel: t("cashboxCards.transfer.submit"),
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
            fingerprint: cardTransferFingerprint(from.id, to.id, amount),
            send: (idempotencyKey) =>
              transfer.mutateAsync({
                body: { from_card_id: from.id, to_card_id: to.id, amount, comment: reason },
                idempotencyKey,
              }),
            onUncertain: () => void refreshCards(),
          });
          replay = result.replay;
        },
      });
      if (!ok) return;
      if (replay) notify.info(t("cashboxCards.money.replayed"));
      else notify.success(t("cashboxCards.transfer.done"));
      onClose();
    } finally {
      submittingRef.current = false;
    }
  };

  const preview =
    from && to && amount > 0
      ? t("cashboxCards.transfer.preview", { from: from.name, to: to.name, amount: money(amount) })
      : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="md"
      icon={ArrowLeftRight}
      title={t("cashboxCards.transfer.title")}
      description={t("cashboxCards.transfer.subtitle")}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("cashboxCards.form.cancel")}
          </Button>
          <Button type="submit" leftIcon={ArrowLeftRight} disabled={shiftLocked} loading={busy}>
            {t("cashboxCards.transfer.submit")}
          </Button>
        </>
      }
    >
      {shiftLocked ? (
        <CardNotice tone="warning" icon={Lock}>
          {t("cashboxCards.money.shiftLocked")}
        </CardNotice>
      ) : null}

      <Field labelAs="span" label={t("cashboxCards.transfer.from")} required error={errors.from}>
        <Select
          value={fromId || null}
          onChange={(value) => {
            setFromId(value ?? "");
            if (value && value === toId) setToId("");
            clearError("from");
          }}
          options={fromOptions}
          placeholder={t("cashboxCards.money.selectCard")}
          listLabel={t("cashboxCards.money.cardsList")}
        />
      </Field>

      <Field labelAs="span" label={t("cashboxCards.transfer.to")} required error={errors.to}>
        <Select
          value={toId || null}
          onChange={(value) => {
            setToId(value ?? "");
            clearError("to");
          }}
          options={toOptions}
          placeholder={t("cashboxCards.money.selectCard")}
          listLabel={t("cashboxCards.money.cardsList")}
          noOptionsText={t("cashboxCards.transfer.noTarget")}
        />
      </Field>

      <Field label={t("cashboxCards.money.amount")} required error={errors.amount}>
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
          placeholder={t("cashboxCards.transfer.reasonPlaceholder")}
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
