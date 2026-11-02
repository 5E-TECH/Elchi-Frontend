import {
  RECEIPT_SETTING_GROUPS,
  SHIFT_REPORT_RECIPIENT_GROUPS,
  type ReceiptGroupSettings,
  type ReceiptSettingGroup,
  type ReceiptSettings,
  type ShiftAutoCloseSettings,
  type ShiftCheckSettings,
  type ShiftReportSendSettings,
  type UpdateReceiptSettingsRequest,
  type UpdateShiftSettingsRequest,
} from "../../../entities/payments";

/**
 * Smena sozlamalari formasi (kiZgTybn; y8Tqm9Ap, gWI4gYkw): qoralama va `PATCH finance/shift/settings` uchun faqat
 * o'zgargan kalitlar. `auto_close` / `report` — backend javobida bo'lsa (aks holda `null`, blok chizilmaydi va
 * so'rovga kirmaydi).
 */
export type Draft = {
  account_check_enabled: boolean;
  photo_required: boolean;
  ai_check_enabled: boolean;
  cards: Record<string, { require_photo_on_shift_close: boolean; ai_check_enabled: boolean }>;
  auto_close: ShiftAutoCloseSettings | null;
  report: ShiftReportSendSettings | null;
};

const cloneReport = (report: ShiftReportSendSettings | null): ShiftReportSendSettings | null =>
  report
    ? {
        format: report.format,
        recipients: Object.fromEntries(
          SHIFT_REPORT_RECIPIENT_GROUPS.map((group) => [group, { ...report.recipients[group] }]),
        ) as ShiftReportSendSettings["recipients"],
      }
    : null;

export const toDraft = (settings: ShiftCheckSettings): Draft => ({
  account_check_enabled: settings.account_check_enabled,
  photo_required: settings.photo_required,
  ai_check_enabled: settings.ai_check_enabled,
  cards: Object.fromEntries(
    settings.cards.map((card) => [
      card.card_id,
      { require_photo_on_shift_close: card.require_photo_on_shift_close, ai_check_enabled: card.ai_check_enabled },
    ]),
  ),
  auto_close: settings.auto_close ? { ...settings.auto_close, times: [...settings.auto_close.times] } : null,
  report: cloneReport(settings.report),
});

const sameTimes = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Avtomatik yopish qoralamasi yaroqsizmi: yoqilgan, lekin vaqt yo'q (backend 1–12 ta kutadi). */
export const autoCloseDraftError = (draft: Draft): "times" | null =>
  draft.auto_close?.enabled && draft.auto_close.times.length === 0 ? "times" : null;

/** Faqat o'zgargan kalitlar (bo'sh — o'zgarish yo'q). */
export const diffShiftSettings = (base: ShiftCheckSettings, draft: Draft): UpdateShiftSettingsRequest => {
  const body: UpdateShiftSettingsRequest = {};
  if (draft.account_check_enabled !== base.account_check_enabled) body.account_check_enabled = draft.account_check_enabled;
  if (draft.photo_required !== base.photo_required) body.photo_required = draft.photo_required;
  if (draft.ai_check_enabled !== base.ai_check_enabled) body.ai_check_enabled = draft.ai_check_enabled;
  const cards = base.cards
    .map((card) => {
      const next = draft.cards[card.card_id];
      if (!next) return null;
      const patch: NonNullable<UpdateShiftSettingsRequest["cards"]>[number] = { card_id: card.card_id };
      if (next.require_photo_on_shift_close !== card.require_photo_on_shift_close) {
        patch.require_photo_on_shift_close = next.require_photo_on_shift_close;
      }
      if (next.ai_check_enabled !== card.ai_check_enabled) patch.ai_check_enabled = next.ai_check_enabled;
      return Object.keys(patch).length > 1 ? patch : null;
    })
    .filter((patch): patch is NonNullable<typeof patch> => patch !== null);
  if (cards.length) body.cards = cards;

  if (base.auto_close && draft.auto_close) {
    const before = base.auto_close;
    const next = draft.auto_close;
    const patch: NonNullable<UpdateShiftSettingsRequest["auto_close"]> = {};
    if (next.enabled !== before.enabled) patch.enabled = next.enabled;
    if (!sameTimes(next.times, before.times)) patch.times = [...next.times];
    if (next.scope !== before.scope) patch.scope = next.scope;
    if (next.warn_before_min !== before.warn_before_min) patch.warn_before_min = next.warn_before_min;
    if (Object.keys(patch).length) body.auto_close = patch;
  }

  if (base.report && draft.report) {
    const before = base.report;
    const next = draft.report;
    const patch: NonNullable<UpdateShiftSettingsRequest["report"]> = {};
    const recipients: NonNullable<NonNullable<UpdateShiftSettingsRequest["report"]>["recipients"]> = {};
    for (const group of SHIFT_REPORT_RECIPIENT_GROUPS) {
      const channels: { telegram?: boolean; in_app?: boolean } = {};
      if (next.recipients[group].telegram !== before.recipients[group].telegram) {
        channels.telegram = next.recipients[group].telegram;
      }
      if (next.recipients[group].in_app !== before.recipients[group].in_app) channels.in_app = next.recipients[group].in_app;
      if (Object.keys(channels).length) recipients[group] = channels;
    }
    if (Object.keys(recipients).length) patch.recipients = recipients;
    if (next.format !== before.format) patch.format = next.format;
    if (Object.keys(patch).length) body.report = patch;
  }
  return body;
};

/** Chek sozlamalari qoralamasi (QlLf33Ma). */
export type ReceiptDraft = Record<ReceiptSettingGroup, ReceiptGroupSettings>;

/** `PATCH finance/receipt-settings`: faqat o'zgargan kalitlar (bo'sh — o'zgarish yo'q). */
export const diffReceiptSettings = (base: ReceiptSettings, draft: ReceiptDraft): UpdateReceiptSettingsRequest => {
  const body: UpdateReceiptSettingsRequest = {};
  for (const group of RECEIPT_SETTING_GROUPS) {
    const before = base[group];
    const after = draft[group];
    const changes: Partial<ReceiptGroupSettings> = {};
    if (after.photo_required !== before.photo_required) changes.photo_required = after.photo_required;
    if (after.ai_enabled !== before.ai_enabled) changes.ai_enabled = after.ai_enabled;
    if (Object.keys(changes).length) body[group] = changes;
  }
  return body;
};
