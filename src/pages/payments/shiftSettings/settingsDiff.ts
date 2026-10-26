import type { ShiftCheckSettings, UpdateShiftSettingsRequest } from "../../../entities/payments";

/** Smena sozlamalari formasi (kiZgTybn): qoralama va `PATCH finance/shift/settings` uchun faqat o'zgargan kalitlar. */
export type Draft = {
  account_check_enabled: boolean;
  photo_required: boolean;
  ai_check_enabled: boolean;
  cards: Record<string, { require_photo_on_shift_close: boolean; ai_check_enabled: boolean }>;
};

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
});

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
  return body;
};

