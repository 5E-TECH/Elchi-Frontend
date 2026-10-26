// dizayn-v2: superadmin-payments-shift-settings
import { useMemo, useState } from "react";
import { CreditCard, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useShiftCheckSettings,
  useUpdateShiftCheckSettings,
  type ShiftCheckCardSettings,
  type ShiftCheckSettings,
} from "../../../entities/payments";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, DataTable, PageHeader, QueryBoundary, type DataTableColumn } from "../../../shared/ui/primitives";
import { cardSubtitle } from "../components/shiftCheck/aiStatusMeta";
import { AutoCloseCard, ReportSendCard } from "./AutomationCards";
import { CellSwitch } from "./CellSwitch";
import { autoCloseDraftError, diffShiftSettings, toDraft, type Draft } from "./settingsDiff";
import { SwitchRow } from "../../settings/ui/settingsUi";

/**
 * KASSA SMENASI SOZLAMALARI — `/payments/shift-settings`, faqat superadmin (maket `superadmin-payments-shift-settings`,
 * kiZgTybn). «Kartalar qoldig'ini tasdiqlash» kartasi: global kalitlar (`account_check_enabled`, `photo_required`,
 * `ai_check_enabled`) va «Har karta bo'yicha» jadvali (`require_photo_on_shift_close`, `ai_check_enabled`; AI faqat
 * rasm talab qilingan kartada — backend 400 qoidasi, rasm o'chsa AI ham o'chadi). «Saqlash» →
 * `PATCH finance/shift/settings` (faqat o'zgargan maydonlar). Pastda «Avtomatik yopish» (y8Tqm9Ap) va «Smena
 * hisobotini yuborish» (gWI4gYkw) kartalari — `AutomationCards.tsx`; backend javobida `auto_close` / `report`
 * bo'lmasa (eski backend) chizilmaydi va so'rovga kirmaydi.
 */

const SettingsForm = ({ settings }: { settings: ShiftCheckSettings }) => {
  const { t } = useTranslation("payments");
  const update = useUpdateShiftCheckSettings();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));

  const body = useMemo(() => diffShiftSettings(settings, draft), [draft, settings]);
  const dirty = Object.keys(body).length > 0;
  // Avtomatik yopish yoqilgan, lekin vaqt yo'q — backend 1–12 ta kutadi; xato kartada, «Saqlash» o'chiq.
  const invalid = autoCloseDraftError(draft) !== null;

  const setCard = (cardId: string, patch: Partial<Draft["cards"][string]>) =>
    setDraft((current) => {
      const next = { ...current.cards[cardId], ...patch };
      // AI faqat rasm talab qilingan kartada (backend: aks holda 400).
      if (!next.require_photo_on_shift_close) next.ai_check_enabled = false;
      return { ...current, cards: { ...current.cards, [cardId]: next } };
    });

  const save = async () => {
    if (!dirty || invalid || update.isPending) return;
    try {
      await update.mutateAsync(body);
      notify.success(t("shiftCheck.settings.saved"));
    } catch (error) {
      notify.error(t("shiftCheck.settings.saveError"), { description: getApiErrorMessage(error) || undefined });
    }
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
            loading={update.isPending}
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
      {draft.auto_close || draft.report ? (
        <div className="flex flex-wrap items-start gap-4">
          {draft.auto_close ? (
            <AutoCloseCard
              value={draft.auto_close}
              timesError={invalid}
              onChange={(auto_close) => setDraft((current) => ({ ...current, auto_close }))}
            />
          ) : null}
          {draft.report ? (
            <ReportSendCard value={draft.report} onChange={(report) => setDraft((current) => ({ ...current, report }))} />
          ) : null}
        </div>
      ) : null}
    </>
  );
};

const ShiftSettingsPage = () => {
  const query = useShiftCheckSettings();
  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <QueryBoundary query={query} skeleton="lines" isEmpty={() => false}>
        {/* Saqlangandan keyin server qiymatlari bilan forma qaytadan boshlanadi (kalit — sozlamalar holati). */}
        {(settings) => <SettingsForm key={JSON.stringify(settings)} settings={settings} />}
      </QueryBoundary>
    </div>
  );
};

export default ShiftSettingsPage;
