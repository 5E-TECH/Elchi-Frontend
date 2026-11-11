import {
  RECEIPT_SETTING_GROUPS,
  SHIFT_REPORT_RECIPIENT_GROUPS,
  type ReceiptGroupSettings,
  type ReceiptSettingGroup,
  type ReceiptSettings,
  type ShiftCheckSettings,
  type ShiftReportSendSettings,
  type UpdateReceiptSettingsRequest,
  type UpdateShiftSettingsRequest,
} from "../../../entities/payments";

/**
 * Asosiy kassa kaliti: `main_account_check_enabled` (BE-A), bo'lmasa (eski backend) `account_check_enabled` — sahifa
 * superadmin uchun sukut kassani (`'0'`, asosiy) o'qiydi, ikkalasi bir xil.
 */
export const mainAccountCheck = (settings: ShiftCheckSettings): boolean =>
  settings.main_account_check_enabled ?? settings.account_check_enabled;

/**
 * Smena sozlamalari formasi (kiZgTybn; gWI4gYkw; BE-A): qoralama va `PATCH finance/shift/settings` uchun faqat o'zgargan
 * kalitlar. `report` — backend javobida bo'lsa (aks holda `null`, blok chizilmaydi va so'rovga kirmaydi). Smena jadvali
 * (`auto_open`, `auto_close`, `late_alert`) — Ops → «Kun tartibi» (`pages/daily-schedule`), bu formaga kirmaydi.
 */
export type Draft = {
  /** ASOSIY kassa kaliti (BE-A; eski backendda — barcha kassalar). */
  account_check_enabled: boolean;
  /** BE-A: filiallar kaliti; eski backend bermasa `null` — kalit chizilmaydi va so'rovga kirmaydi. */
  branch_account_check_enabled: boolean | null;
  photo_required: boolean;
  ai_check_enabled: boolean;
  cards: Record<string, { require_photo_on_shift_close: boolean; ai_check_enabled: boolean }>;
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
  account_check_enabled: mainAccountCheck(settings),
  branch_account_check_enabled: settings.branch_account_check_enabled,
  photo_required: settings.photo_required,
  ai_check_enabled: settings.ai_check_enabled,
  cards: Object.fromEntries(
    settings.cards.map((card) => [
      card.card_id,
      { require_photo_on_shift_close: card.require_photo_on_shift_close, ai_check_enabled: card.ai_check_enabled },
    ]),
  ),
  report: cloneReport(settings.report),
});

/** Faqat o'zgargan kalitlar (bo'sh — o'zgarish yo'q). */
export const diffShiftSettings = (base: ShiftCheckSettings, draft: Draft): UpdateShiftSettingsRequest => {
  const body: UpdateShiftSettingsRequest = {};
  if (draft.account_check_enabled !== mainAccountCheck(base)) body.account_check_enabled = draft.account_check_enabled;
  if (
    base.branch_account_check_enabled !== null &&
    draft.branch_account_check_enabled !== null &&
    draft.branch_account_check_enabled !== base.branch_account_check_enabled
  ) {
    body.branch_account_check_enabled = draft.branch_account_check_enabled;
  }
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
