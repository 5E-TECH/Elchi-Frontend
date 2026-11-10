// dizayn-v2: superadmin-payments-shift-settings, superadmin-payments-shift-settings-receipts, superadmin-payments-shift-settings-correction
import { useMemo, useState } from "react";
import { CreditCard, Save, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  getReceiptErrorCode,
  useShiftCheckSettings,
  useUpdateShiftCheckSettings,
  type ShiftCheckCardSettings,
  type ShiftCheckSettings,
} from "../../../entities/payments";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  buttonClasses,
  Card,
  DataTable,
  PageHeader,
  QueryBoundary,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { DAILY_SCHEDULE_TAB, opsTabPath } from "../../ops/tabs";
import { cardSubtitle } from "../components/shiftCheck/aiStatusMeta";
import { CardTitle, ReportSendCard } from "./AutomationCards";
import { CellSwitch } from "./CellSwitch";
import { PaymentCorrectionCard } from "./PaymentCorrectionCard";
import { usePaymentCorrectionDraft, type PaymentCorrectionDraft } from "./paymentCorrectionDraft";
import { ReceiptSettingsCard, useReceiptSettingsDraft, type ReceiptSettingsDraft } from "./ReceiptSettingsCard";
import { diffShiftSettings, toDraft, type Draft } from "./settingsDiff";
import { SwitchRow } from "../../settings/ui/settingsUi";

/**
 * KASSA SMENASI SOZLAMALARI — `/payments/shift-settings`, faqat superadmin (maket `superadmin-payments-shift-settings`,
 * kiZgTybn). «Kartalar qoldig'ini tasdiqlash» kartasi: global kalitlar (`account_check_enabled`, `photo_required`,
 * `ai_check_enabled`) va «Har karta bo'yicha» jadvali (`require_photo_on_shift_close`, `ai_check_enabled`; AI faqat
 * rasm talab qilingan kartada — backend 400 qoidasi, rasm o'chsa AI ham o'chadi). «Saqlash» →
 * `PATCH finance/shift/settings` (faqat o'zgargan maydonlar). Pastda «Smena hisobotini yuborish» (gWI4gYkw) —
 * `AutomationCards.tsx`; backend javobida `report` bo'lmasa (eski backend) chizilmaydi va so'rovga kirmaydi. «Avtomatik
 * yopish» (y8Tqm9Ap) Ops → «Kun tartibi»ga ko'chdi (ega 2026-11-10) — uning o'rnida havola kartasi (avtomatik ochish va
 * kechikish xabari ham o'sha yerda). «Chek rasmi va AI tahlili» (QlLf33Ma) —
 * `ReceiptSettingsCard`, alohida `PATCH finance/receipt-settings`, lekin «Saqlash» bitta: faqat o'zgargan so'rov ketadi.
 * Eng pastda «To'lovlarni tuzatish muddati» (T6-FE-3, 2wgTzcG0) — `PaymentCorrectionCard`, o'z so'rovi
 * (`GET/PATCH finance/payment-corrections/settings`), shuning uchun `report` bo'lmasa ham chiziladi;
 * o'sha «Saqlash» bilan ketadi, «Kunlar soni» yaroqsiz bo'lsa «Saqlash» o'chiq.
 */

/** «Avtomatik yopish» o'rnida (ega 2026-11-10): smena jadvali Ops → «Kun tartibi»da — havola. */
const ScheduleLinkCard = () => {
  const { t } = useTranslation("payments");
  return (
    <Card
      className="min-w-0 flex-[1_1_400px]"
      title={<CardTitle icon={Timer} title={t("shiftCheck.settings.schedule.title")} />}
      description={t("shiftCheck.settings.schedule.description")}
    >
      <Link to={opsTabPath(DAILY_SCHEDULE_TAB)} className={buttonClasses({ variant: "secondary" })}>
        {t("shiftCheck.settings.schedule.open")}
      </Link>
    </Card>
  );
};

const SettingsForm = ({
  settings,
  receipts,
  correction,
}: {
  settings: ShiftCheckSettings;
  receipts: ReceiptSettingsDraft;
  correction: PaymentCorrectionDraft;
}) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const update = useUpdateShiftCheckSettings();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));

  const body = useMemo(() => diffShiftSettings(settings, draft), [draft, settings]);
  const shiftDirty = Object.keys(body).length > 0;
  const dirty = shiftDirty || receipts.dirty || correction.dirty;
  const saving = update.isPending || receipts.isSaving || correction.isSaving;
  // «Kunlar soni» 1–365 butun son emas — xato maydon ostida, «Saqlash» o'chiq.
  const invalid = correction.invalid;

  const setCard = (cardId: string, patch: Partial<Draft["cards"][string]>) =>
    setDraft((current) => {
      const next = { ...current.cards[cardId], ...patch };
      // AI faqat rasm talab qilingan kartada (backend: aks holda 400).
      if (!next.require_photo_on_shift_close) next.ai_check_enabled = false;
      return { ...current, cards: { ...current.cards, [cardId]: next } };
    });

  const save = async () => {
    if (!dirty || invalid || saving) return;
    // Uch bo'lim mustaqil: biri yiqilsa qolganlari saqlanadi, xato aniq aytiladi (yiqilganining qoralamasi qoladi).
    const correctionDays = correction.dirty ? correction.days : null;
    const results = await Promise.allSettled([
      ...(shiftDirty ? [update.mutateAsync(body)] : []),
      ...(receipts.dirty ? [receipts.save()] : []),
      ...(correction.dirty ? [correction.save()] : []),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (!failed) {
      notify.success(
        t("shiftCheck.settings.saved"),
        correctionDays !== null
          ? {
              description: t("paymentCorrection.settings.saved", {
                count: correctionDays,
                value: formatNumberLocalized(correctionDays, { language }),
              }),
            }
          : undefined,
      );
      return;
    }
    const code = getReceiptErrorCode(failed.reason);
    notify.error(t("shiftCheck.settings.saveError"), {
      description: code ? t(`receipt.errors.${code}`) : getApiErrorMessage(failed.reason) || undefined,
    });
  };

  const resultText = (card: ShiftCheckCardSettings) => {
    const value = draft.cards[card.card_id];
    if (!draft.account_check_enabled) return t("shiftCheck.settings.resultText.off");
    const photo = draft.photo_required && value?.require_photo_on_shift_close;
    const ai = photo && draft.ai_check_enabled && value?.ai_check_enabled;
    return ai
      ? t("shiftCheck.settings.resultText.photoAi")
      : photo
        ? t("shiftCheck.settings.resultText.photo")
        : t("shiftCheck.settings.resultText.none");
  };

  const cardName = (card: ShiftCheckCardSettings) => (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
        <CreditCard aria-hidden="true" size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-text">{card.name}</span>
        {cardSubtitle(card) ? <span className="text-[13px] text-text-muted">{cardSubtitle(card)}</span> : null}
      </span>
    </span>
  );

  const photoSwitch = (card: ShiftCheckCardSettings) => (
    <CellSwitch
      checked={Boolean(draft.cards[card.card_id]?.require_photo_on_shift_close)}
      label={t("shiftCheck.settings.cardPhoto", { card: card.name })}
      onToggle={(next) => setCard(card.card_id, { require_photo_on_shift_close: next })}
    />
  );
  const aiSwitch = (card: ShiftCheckCardSettings) => {
    const photoOn = Boolean(draft.cards[card.card_id]?.require_photo_on_shift_close);
    return (
      <span className="inline-flex items-center gap-2">
        <CellSwitch
          checked={Boolean(draft.cards[card.card_id]?.ai_check_enabled)}
          disabled={!photoOn}
          label={t("shiftCheck.settings.cardAi", { card: card.name })}
          onToggle={(next) => setCard(card.card_id, { ai_check_enabled: next })}
        />
        {photoOn ? null : <span className="text-[13px] text-text-muted">{t("shiftCheck.settings.needsPhoto")}</span>}
      </span>
    );
  };

  const columns: DataTableColumn<ShiftCheckCardSettings>[] = [
    { id: "card", header: t("shiftCheck.settings.card"), cell: cardName },
    { id: "photo", header: t("shiftCheck.settings.photo"), cell: photoSwitch },
    { id: "ai", header: t("shiftCheck.settings.ai"), cell: aiSwitch },
    {
      id: "result",
      header: t("shiftCheck.settings.result"),
      cell: (card) => <span className="text-[13px] text-text-muted">{resultText(card)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        back="/payments/main-cashbox"
        backLabel={t("shiftCheck.settings.back")}
        title={t("shiftCheck.settings.title")}
        description={t("shiftCheck.settings.subtitle")}
        actions={
          <Button
            leftIcon={Save}
            onClick={() => void save()}
            disabled={!dirty || invalid}
            loading={saving}
            loadingText={t("shiftCheck.settings.saving")}
          >
            {t("shiftCheck.settings.save")}
          </Button>
        }
      />
      <Card
        padding="none"
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard aria-hidden="true" size={18} className="text-text-muted" />
            {t("shiftCheck.settings.section")}
          </span>
        }
        description={t("shiftCheck.settings.sectionHint")}
        divided
      >
        <div className="flex flex-col divide-y divide-border">
          <SwitchRow
            title={t("shiftCheck.settings.accountCheck")}
            hint={t("shiftCheck.settings.accountCheckHint")}
            checked={draft.account_check_enabled}
            onToggle={(next) => setDraft((current) => ({ ...current, account_check_enabled: next }))}
          />
          <SwitchRow
            title={t("shiftCheck.settings.photo")}
            hint={t("shiftCheck.settings.photoHint")}
            checked={draft.photo_required}
            onToggle={(next) => setDraft((current) => ({ ...current, photo_required: next }))}
          />
          <SwitchRow
            title={t("shiftCheck.settings.ai")}
            hint={t("shiftCheck.settings.aiHint")}
            checked={draft.ai_check_enabled}
            onToggle={(next) => setDraft((current) => ({ ...current, ai_check_enabled: next }))}
          />
          <div className="flex flex-col gap-0.5 px-5 pb-3 pt-4 max-md:px-4">
            <h3 className="text-sm font-bold text-text">{t("shiftCheck.settings.perCard")}</h3>
            <p className="m-0 text-[13px] text-text-muted">{t("shiftCheck.settings.perCardHint")}</p>
          </div>
        </div>
        {settings.cards.length ? (
          <DataTable
            rows={settings.cards}
            columns={columns}
            getRowKey={(card) => card.card_id}
            label={t("shiftCheck.settings.perCardLabel")}
            cardsLabel={t("shiftCheck.settings.perCardLabel")}
            renderCard={(card) => (
              <div className="flex flex-col gap-2 px-4 py-3">
                {cardName(card)}
                <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text")}>
                  <span className="inline-flex items-center gap-2">
                    {photoSwitch(card)}
                    {t("shiftCheck.settings.photo")}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {aiSwitch(card)}
                    {t("shiftCheck.settings.ai")}
                  </span>
                </div>
                <span className="text-[13px] text-text-muted">{resultText(card)}</span>
              </div>
            )}
          />
        ) : (
          <p className="m-0 px-5 py-4 text-[13px] text-text-muted">{t("shiftCheck.settings.empty")}</p>
        )}
      </Card>
      <ReceiptSettingsCard receipts={receipts} />
      <div className="flex flex-wrap items-start gap-4">
        <ScheduleLinkCard />
        {draft.report ? (
          <ReportSendCard value={draft.report} onChange={(report) => setDraft((current) => ({ ...current, report }))} />
        ) : null}
      </div>
      <PaymentCorrectionCard correction={correction} />
    </>
  );
};

const ShiftSettingsPage = () => {
  const query = useShiftCheckSettings();
  const receipts = useReceiptSettingsDraft();
  const correction = usePaymentCorrectionDraft();
  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {/* QueryBoundary o'zi bitta `div` — kartalar orasidagi 24 / 16 px oraliq shu o'ramda (maketdagidek). */}
      <QueryBoundary query={query} skeleton="lines" isEmpty={() => false} className="flex flex-col gap-6 max-md:gap-4">
        {/* Saqlangandan keyin server qiymatlari bilan forma qaytadan boshlanadi (kalit — sozlamalar holati). */}
        {(settings) => (
          <SettingsForm key={JSON.stringify(settings)} settings={settings} receipts={receipts} correction={correction} />
        )}
      </QueryBoundary>
    </div>
  );
};

export default ShiftSettingsPage;
