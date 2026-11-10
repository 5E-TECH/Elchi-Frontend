// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-accounts — eng yaqini «Arxivlash» amali va tasdiqlash oynasi
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Banknote, CreditCard, Lock, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useDeleteCashboxCard,
  useRefreshCashboxCards,
  type CashboxCard,
  type CashboxCardDeleteBody,
} from "../../../../entities/payments/cashboxCards";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  SegmentedControl,
  Select,
  TextInput,
  TransferSummary,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import {
  cardDeleteFingerprint,
  cardErrorMessage,
  isUncertainCardMoveError,
  sendIdempotent,
  settleCardMoveKey,
} from "./cardMeta";
import { CardNotice } from "./cardUi";

/**
 * «"<nom>" KARTASINI O'CHIRISH» (cards1111 — yangi amal; maket yo'q, eng yaqini `superadmin-payments-main-cashbox-accounts`
 * dagi «Arxivlash · Faqat qoldiq 0 so'm bo'lganda» va `ConfirmDialog` danger).
 *
 *  - Qoldiq 0 → `ConfirmDialog` (danger, «Bu amalni qaytarib bo'lmaydi», fe'l «O'chirish») → `POST …/:id/delete` `{}`.
 *  - Qoldiq > 0 → forma oynasi: «Kartada N bor. O'chirishdan oldin qoldiq 0 qilinadi:» + manzil segmenti
 *    («Boshqa kartaga» — faol karta, o'zidan boshqa, Asosiy ham mumkin va sukut shu; «Naqd kassaga»), ixtiyoriy Izoh,
 *    qayerdan → qayerga xulosasi va «N → manzil o'tkaziladi, keyin karta o'chiriladi»; tugma «Qoldiqni o'tkazib,
 *    o'chirish». Bitta so'rov: `{move_to, to_card_id?, comment?}` + `Idempotency-Key`
 *    (barmoq izi `["card-delete", id, move_to, to, amount]`). Pul ko'chishi smena talab qiladi — smena yopiq bo'lsa
 *    tugma o'chiq va sababi tepada; qoldiqsiz o'chirish smenasiz ham ishlaydi.
 *  - Backend rad etsa (400/403/404) — matni aynan oyna ichida; natija noma'lum (504, tarmoq) — ro'yxat qayta o'qiladi,
 *    qayta bosish o'sha kalit bilan. Qoldiqli o'chirishda backend takrorni `idempotent: true` bilan qaytaradi. Qoldiqsiz
 *    o'chirish harakat yozmaydi — karta allaqachon o'chgan bo'lsa takror 404 «Karta topilmadi» qaytaradi: shu oynada
 *    javobsiz urinishdan keyingi 404 — muvaffaqiyat (kalit o'chadi, «Karta o'chirildi», oyna yopiladi).
 */

type Destination = NonNullable<CashboxCardDeleteBody["move_to"]>;

export type CardDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  card: CashboxCard;
  /** Faol kartalar (manzil tanlovi). */
  cards: readonly CashboxCard[];
  shiftLocked: boolean;
};

const deleteFingerprint = (card: CashboxCard, body: CashboxCardDeleteBody, amount: number) =>
  cardDeleteFingerprint(card.id, body.move_to ?? null, body.to_card_id ?? null, amount);

const useDeleteRequest = (card: CashboxCard) => {
  const remove = useDeleteCashboxCard();
  const refreshCards = useRefreshCashboxCards();
  const run = (body: CashboxCardDeleteBody, amount: number) =>
    sendIdempotent({
      fingerprint: deleteFingerprint(card, body, amount),
      send: (idempotencyKey) => remove.mutateAsync({ id: card.id, body, idempotencyKey }),
      onUncertain: () => void refreshCards(),
    });
  const settle = (body: CashboxCardDeleteBody, amount: number) => {
    settleCardMoveKey(deleteFingerprint(card, body, amount));
    void refreshCards();
  };
  return { run, settle, busy: remove.isPending };
};

export const CardDeleteDialog = (props: CardDeleteDialogProps) =>
  props.card.balance > 0 ? <CardDeleteWithBalance {...props} /> : <CardDeleteEmpty {...props} />;

const CardDeleteEmpty = ({ open, onClose, card }: CardDeleteDialogProps) => {
  const { t } = useTranslation("payments");
  const { run, settle } = useDeleteRequest(card);
  // Shu oynada javobi kelmagan urinish bo'lganmi (504, tarmoq) — keyingi 404 «allaqachon o'chirilgan» degani.
  const uncertainRef = useRef(false);
  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      icon={Trash2}
      confirmIcon={Trash2}
      title={t("cashboxCards.delete.title", { name: card.name })}
      description={t("cashboxCards.delete.description")}
      confirmLabel={t("cashboxCards.delete.confirm")}
      loadingLabel={t("cashboxCards.delete.deleting")}
      irreversible
      errorView={(error) => (isUncertainCardMoveError(error) ? { content: t("cashboxCards.delete.uncertain") } : null)}
      errorMessage={(error) => cardErrorMessage(error, t("cashboxCards.delete.error"))}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await run({}, 0);
        } catch (error) {
          if (uncertainRef.current && getErrorStatus(error) === 404) {
            // Avvalgi (javobsiz) urinish kartani o'chirgan — backend takrorga 404 beradi, bu xato emas.
            settle({}, 0);
          } else {
            if (isUncertainCardMoveError(error)) uncertainRef.current = true;
            throw error;
          }
        }
        notify.success(t("cashboxCards.delete.done"));
        onClose();
      }}
    />
  );
};

const CardDeleteWithBalance = ({ open, onClose, card, cards, shiftLocked }: CardDeleteDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const { run, busy } = useDeleteRequest(card);
  const submittingRef = useRef(false);
  const targets = useMemo(() => cards.filter((item) => item.is_active && item.id !== card.id), [cards, card.id]);
  const [destination, setDestination] = useState<Destination>(targets.length > 0 ? "card" : "cash");
  const [targetId, setTargetId] = useState<string>(
    () => (targets.find((item) => item.is_default) ?? targets[0])?.id ?? "",
  );
  const [comment, setComment] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const target = destination === "card" ? (targets.find((item) => item.id === targetId) ?? null) : null;
  const amount = card.balance;

  const targetOptions = useMemo<SelectOption[]>(
    () =>
      targets.map((item) => ({
        value: item.id,
        label: item.name,
        description: t("cashboxCards.money.available", { amount: formatMoneyLocalized(item.balance, { language }) }),
      })),
    [targets, language, t],
  );

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy || shiftLocked) return;
    if (destination === "card" && !target) {
      setTargetError(t("cashboxCards.money.sourceRequired"));
      return;
    }
    setServerError(null);
    submittingRef.current = true;
    const note = comment.trim();
    const body: CashboxCardDeleteBody =
      destination === "card" && target
        ? { move_to: "card", to_card_id: target.id, ...(note ? { comment: note } : {}) }
        : { move_to: "cash", ...(note ? { comment: note } : {}) };
    try {
      const result = await run(body, amount);
      if (result.replay) notify.info(t("cashboxCards.money.replayed"));
      else notify.success(t("cashboxCards.delete.done"));
      onClose();
    } catch (error) {
      setServerError(
        isUncertainCardMoveError(error) ? t("cashboxCards.money.uncertain") : cardErrorMessage(error, t("cashboxCards.delete.error")),
      );
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
      icon={Trash2}
      iconTone="danger"
      iconShape="circle"
      title={t("cashboxCards.delete.title", { name: card.name })}
      description={t("cashboxCards.delete.description")}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("cashboxCards.form.cancel")}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={Trash2}
            disabled={shiftLocked}
            loading={busy}
            loadingText={t("cashboxCards.delete.deleting")}
          >
            {t("cashboxCards.delete.confirmMove")}
          </Button>
        </>
      }
    >
      {shiftLocked ? (
        <CardNotice tone="warning" icon={Lock}>
          {t("cashboxCards.money.shiftLocked")}
        </CardNotice>
      ) : null}

      <p className="m-0 text-sm text-text">{t("cashboxCards.delete.balanceLead", { amount: money(amount) })}</p>

      <Field labelAs="span" label={t("cashboxCards.delete.destination")}>
        <SegmentedControl<Destination>
          ariaLabel={t("cashboxCards.delete.destination")}
          fullWidth
          value={destination}
          onValueChange={(value) => {
            setDestination(value);
            setTargetError(null);
          }}
          options={[
            { value: "card", label: t("cashboxCards.delete.toCard"), icon: CreditCard, disabled: targets.length === 0 },
            { value: "cash", label: t("cashboxCards.delete.toCash"), icon: Banknote },
          ]}
        />
      </Field>

      {destination === "card" ? (
        <Field labelAs="span" label={t("cashboxCards.delete.targetCard")} required error={targetError ?? undefined}>
          <Select
            value={targetId || null}
            onChange={(value) => {
              setTargetId(value ?? "");
              setTargetError(null);
            }}
            options={targetOptions}
            placeholder={t("cashboxCards.money.selectCard")}
            listLabel={t("cashboxCards.money.cardsList")}
          />
        </Field>
      ) : null}

      <Field label={t("cashboxCards.delete.comment")} optional>
        <TextInput
          multiline
          rows={2}
          value={comment}
          maxLength={1000}
          onValueChange={setComment}
          placeholder={t("cashboxCards.delete.commentPlaceholder")}
        />
      </Field>

      <TransferSummary
        amount={{ value: amount }}
        transfer={{
          from: { title: card.name },
          to: { title: destination === "cash" ? t("cashboxCards.convert.cash") : (target?.name ?? "—") },
        }}
      />

      <p className="m-0 text-sm text-text-muted" aria-live="polite">
        {destination === "cash"
          ? t("cashboxCards.delete.previewCash", { amount: money(amount) })
          : t("cashboxCards.delete.previewCard", { amount: money(amount), dest: target?.name ?? "—" })}
      </p>

      <CardNotice tone="danger" icon={TriangleAlert} className="py-2.5">
        {t("cashboxCards.delete.irreversible")}
      </CardNotice>

      {serverError ? (
        <CardNotice tone="danger" alert>
          {serverError}
        </CardNotice>
      ) : null}
    </Dialog>
  );
};
