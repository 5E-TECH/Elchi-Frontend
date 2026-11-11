// dizayn-v2: superadmin-payments-cashbox-account-form-dialog
import { useId, useRef, useState, type FormEvent } from "react";
import { Check, CreditCard, Info, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CASHBOX_CARD_KINDS,
  useCreateCashboxCard,
  useUpdateCashboxCard,
  type CashboxCard,
  type CashboxCardKind,
  type CreateCashboxCardBody,
  type UpdateCashboxCardBody,
} from "../../../../entities/payments/cashboxCards";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { CARD_KIND_ICON, cardErrorMessage } from "./cardMeta";
import { CardNotice, CardSwitchRow } from "./cardUi";

/**
 * «KARTA YOKI HISOB RAQAM QO'SHISH» / «KARTANI TAHRIRLASH» OYNASI (maket `superadmin-payments-cashbox-account-form-dialog`).
 *
 * Maydonlar: Turi (tanlov kartalari — Virtual karta · Plastik karta · Bank hisob raqami), Nomi* (≤ 100; Asosiy kartada
 * o'chiq — backend nomini o'zgartirishni rad etadi), Bank (≤ 100), Karta tizimi (≤ 30), Oxirgi 4 raqam (aynan 4 raqam
 * yoki bo'sh — to'liq raqam saqlanmaydi), Egasi F.I.O (≤ 150), Izoh (≤ 500). Yaratishda «Asosiy karta qilish»
 * (`make_default`); tahrirda Asosiy qilish — qator menyusida (`make-default`).
 *
 * «Smena yopilganda» kalitlari (qoldiq rasmi, AI tekshiruvi) — FAQAT superadmin (`canManageShiftSettings`): admin
 * bu maydonlarni hech qachon yubormaydi (backend 403). AI faqat rasm talab qilinganda; rasm o'chirilsa AI ham o'chadi.
 *
 * Tahrirda faqat o'zgargan maydonlar yuboriladi (`""` — tozalash); hech narsa o'zgarmagan bo'lsa so'rovsiz yopiladi.
 * Backend rad etsa (400/403/404) — matni aynan oyna ichida, oyna ochiq qoladi.
 */

type FormValues = {
  kind: CashboxCardKind | "";
  name: string;
  bank_name: string;
  card_network: string;
  last4: string;
  holder_name: string;
  note: string;
  make_default: boolean;
  require_photo_on_shift_close: boolean;
  ai_check_enabled: boolean;
};

type FormErrors = Partial<Record<"name" | "bank_name" | "card_network" | "last4" | "holder_name" | "note", string>>;

const LIMITS = { name: 100, bank_name: 100, card_network: 30, holder_name: 150, note: 500 } as const;
const TEXT_FIELDS = ["bank_name", "card_network", "last4", "holder_name", "note"] as const;

const initialValues = (card: CashboxCard | null): FormValues => ({
  kind: card ? (card.kind ?? "") : "virtual_card",
  name: card?.name ?? "",
  bank_name: card?.bank_name ?? "",
  card_network: card?.card_network ?? "",
  last4: card?.last4 ?? "",
  holder_name: card?.holder_name ?? "",
  note: card?.note ?? "",
  make_default: false,
  require_photo_on_shift_close: card?.require_photo_on_shift_close ?? false,
  ai_check_enabled: card?.ai_check_enabled ?? false,
});

const CHOICE =
  "group flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-text " +
  "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none hover:border-text-subtle " +
  "has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus";

export type CashboxCardFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** `null` — yangi karta. */
  card: CashboxCard | null;
  /** Hozirgi Asosiy karta («Asosiy karta qilish» izohi uchun). */
  defaultCard: CashboxCard | null;
  /** Superadmin: «Smena yopilganda» kalitlari ko'rinadi va yuboriladi. */
  canManageShift: boolean;
};

export const CashboxCardFormDialog = ({ open, onClose, card, defaultCard, canManageShift }: CashboxCardFormDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const fieldId = useId();
  const isEdit = card !== null;
  const isDefault = Boolean(card?.is_default);
  const [values, setValues] = useState<FormValues>(() => initialValues(card));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const createCard = useCreateCashboxCard();
  const updateCard = useUpdateCashboxCard();
  const busy = createCard.isPending || updateCard.isPending;

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      // AI tekshiruvi faqat rasm talab qilinganda (backend 400): rasm o'chsa AI ham o'chadi.
      if (key === "require_photo_on_shift_close" && value === false) next.ai_check_enabled = false;
      return next;
    });
    if (key in errors) setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const name = values.name.trim();
    if (!isDefault) {
      if (!name) next.name = t("cashboxCards.form.nameRequired");
      else if (name.length > LIMITS.name) next.name = t("cashboxCards.form.tooLong", { max: LIMITS.name });
    }
    for (const key of ["bank_name", "card_network", "holder_name", "note"] as const) {
      if (values[key].trim().length > LIMITS[key]) next[key] = t("cashboxCards.form.tooLong", { max: LIMITS[key] });
    }
    const last4 = values.last4.trim();
    if (last4 && !/^\d{4}$/.test(last4)) next.last4 = t("cashboxCards.form.last4Invalid");
    return next;
  };

  const buildCreateBody = (): CreateCashboxCardBody => {
    const body: CreateCashboxCardBody = { name: values.name.trim() };
    if (values.kind) body.kind = values.kind;
    for (const key of TEXT_FIELDS) {
      const value = values[key].trim();
      if (value) body[key] = value;
    }
    if (values.make_default) body.make_default = true;
    if (canManageShift) {
      if (values.require_photo_on_shift_close) body.require_photo_on_shift_close = true;
      if (values.require_photo_on_shift_close && values.ai_check_enabled) body.ai_check_enabled = true;
    }
    return body;
  };

  const buildUpdateBody = (current: CashboxCard): UpdateCashboxCardBody => {
    const body: UpdateCashboxCardBody = {};
    const name = values.name.trim();
    if (!current.is_default && name !== current.name) body.name = name;
    if (values.kind && values.kind !== current.kind) body.kind = values.kind;
    for (const key of TEXT_FIELDS) {
      const value = values[key].trim();
      if (value !== (current[key] ?? "")) body[key] = value;
    }
    if (canManageShift) {
      if (values.require_photo_on_shift_close !== current.require_photo_on_shift_close) {
        body.require_photo_on_shift_close = values.require_photo_on_shift_close;
      }
      const ai = values.require_photo_on_shift_close && values.ai_check_enabled;
      if (ai !== current.ai_check_enabled) body.ai_check_enabled = ai;
    }
    return body;
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setServerError(null);
    submittingRef.current = true;
    try {
      if (card) {
        const body = buildUpdateBody(card);
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        await updateCard.mutateAsync({ id: card.id, body });
        notify.success(t("cashboxCards.form.updated"));
      } else {
        await createCard.mutateAsync(buildCreateBody());
        notify.success(t("cashboxCards.form.created"));
      }
      onClose();
    } catch (error) {
      setServerError(cardErrorMessage(error, t("cashboxCards.form.error")));
    } finally {
      submittingRef.current = false;
    }
  };

  const kindFieldId = `${fieldId}-kind`;
  const zero = formatMoneyLocalized(0, { language });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="lg"
      icon={isEdit ? Pencil : CreditCard}
      title={isEdit ? t("cashboxCards.form.editTitle") : t("cashboxCards.form.createTitle")}
      description={isEdit ? card.name : t("cashboxCards.form.createSubtitle", { amount: zero })}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("cashboxCards.form.cancel")}
          </Button>
          <Button type="submit" leftIcon={Check} loading={busy} loadingText={t("cashboxCards.form.saving")}>
            {t("cashboxCards.form.save")}
          </Button>
        </>
      }
    >
      <Field id={kindFieldId} labelAs="span" label={t("cashboxCards.form.kind")}>
        <div
          role="radiogroup"
          aria-labelledby={`${kindFieldId}-label`}
          className="grid grid-cols-3 gap-2 max-md:grid-cols-1"
        >
          {CASHBOX_CARD_KINDS.map((kind) => {
            const Icon = CARD_KIND_ICON[kind];
            return (
              <label key={kind} className={CHOICE}>
                {/* Maketdagi `.el-radio` — tanlov faqat rang bilan emas, doirachadagi nuqta bilan ham ko'rinadi. */}
                <input
                  type="radio"
                  name={`${fieldId}-kind-radio`}
                  value={kind}
                  checked={values.kind === kind}
                  onChange={() => set("kind", kind)}
                  className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-action"
                />
                <Icon
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2}
                  className="mt-px shrink-0 text-text-muted group-has-[:checked]:text-action max-md:hidden"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{t(`cashboxCards.kind.${kind}`)}</span>
                  <span className="text-xs text-text-muted">{t(`cashboxCards.kindHint.${kind}`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Field>

      <Field
        label={t("cashboxCards.form.name")}
        required={!isDefault}
        disabled={isDefault}
        hint={isDefault ? t("cashboxCards.form.nameDefaultHint") : t("cashboxCards.form.nameHint")}
        error={errors.name}
      >
        <TextInput
          value={values.name}
          onValueChange={(value) => set("name", value)}
          maxLength={LIMITS.name}
          placeholder={t("cashboxCards.form.namePlaceholder")}
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 max-md:grid-cols-1">
        <Field label={t("cashboxCards.form.bank")} optional error={errors.bank_name}>
          <TextInput
            value={values.bank_name}
            onValueChange={(value) => set("bank_name", value)}
            maxLength={LIMITS.bank_name}
            placeholder={t("cashboxCards.form.bankPlaceholder")}
            autoComplete="off"
          />
        </Field>
        <Field label={t("cashboxCards.form.network")} optional error={errors.card_network}>
          <TextInput
            value={values.card_network}
            onValueChange={(value) => set("card_network", value)}
            maxLength={LIMITS.card_network}
            placeholder={t("cashboxCards.form.networkPlaceholder")}
            autoComplete="off"
          />
        </Field>
        <Field label={t("cashboxCards.form.last4")} optional hint={t("cashboxCards.form.last4Hint")} error={errors.last4}>
          {/* `mode="number"` emas: u boshidagi nollarni olib tashlaydi («0457» → «457»). Matn maydoni + raqam klaviaturasi. */}
          <TextInput
            inputMode="numeric"
            value={values.last4}
            onValueChange={(value) => set("last4", value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            placeholder="••••"
            autoComplete="off"
          />
        </Field>
        <Field label={t("cashboxCards.form.holder")} optional error={errors.holder_name}>
          <TextInput
            personName
            value={values.holder_name}
            onValueChange={(value) => set("holder_name", value)}
            maxLength={LIMITS.holder_name}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field label={t("cashboxCards.form.note")} optional error={errors.note}>
        <TextInput
          multiline
          rows={2}
          value={values.note}
          onValueChange={(value) => set("note", value)}
          maxLength={LIMITS.note}
        />
      </Field>

      {isEdit ? null : (
        // Maketdagi `.el-choice` + `.el-check` (bayroqcha), izoh `aria-describedby`.
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={values.make_default}
            onChange={(event) => set("make_default", event.target.checked)}
            aria-labelledby={`${fieldId}-default-title`}
            aria-describedby={`${fieldId}-default-hint`}
            className="mt-px size-[18px] shrink-0 cursor-pointer accent-action"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id={`${fieldId}-default-title`} className="font-semibold">
              {t("cashboxCards.form.makeDefault")}
            </span>
            <span id={`${fieldId}-default-hint`} className="text-[13px] text-text-muted">
              {defaultCard
                ? t("cashboxCards.form.makeDefaultHintCurrent", { name: defaultCard.name })
                : t("cashboxCards.form.makeDefaultHint")}
            </span>
          </span>
        </label>
      )}

      {canManageShift ? (
        <section aria-labelledby={`${fieldId}-shift`} className="border-t border-border pt-3">
          <p id={`${fieldId}-shift`} className="m-0 text-sm font-semibold text-text">
            {t("cashboxCards.form.shiftTitle")}
          </p>
          <p className="m-0 text-xs text-text-muted">{t("cashboxCards.form.shiftHint")}</p>
          <CardSwitchRow
            title={t("cashboxCards.form.photo")}
            hint={t("cashboxCards.form.photoHint")}
            checked={values.require_photo_on_shift_close}
            onToggle={(next) => set("require_photo_on_shift_close", next)}
          />
          <CardSwitchRow
            title={t("cashboxCards.form.ai")}
            hint={t("cashboxCards.form.aiHint")}
            checked={values.require_photo_on_shift_close && values.ai_check_enabled}
            disabled={!values.require_photo_on_shift_close}
            onToggle={(next) => set("ai_check_enabled", next)}
          />
        </section>
      ) : null}

      <CardNotice tone="info" icon={Info}>
        <span className="block">{t("cashboxCards.form.fullNumberNote")}</span>
        {isEdit ? null : <span className="block">{t("cashboxCards.form.newCardNote", { amount: zero })}</span>}
      </CardNotice>

      {serverError ? (
        <CardNotice tone="danger" alert>
          {serverError}
        </CardNotice>
      ) : null}
    </Dialog>
  );
};
