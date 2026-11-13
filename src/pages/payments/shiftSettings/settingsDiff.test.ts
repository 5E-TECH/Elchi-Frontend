import { normalizeShiftCheckSettings } from "../../../entities/payments";
import { diffShiftSettings, rebaseDraft, toDraft } from "./settingsDiff";

/**
 * `rebaseDraft` — sozlama qayta o'qilganda (realtime `card_changed`, «Saqlash»dan keyin) saqlanmagan o'zgarishlar
 * yangi server qiymatlari ustiga ko'chadi; tegilmagan kalitlar serverdan; o'chirilgan karta tushib qoladi.
 */

const card = (card_id: string, photo: boolean, ai: boolean) => ({
  card_id,
  name: `Karta ${card_id}`,
  require_photo_on_shift_close: photo,
  ai_check_enabled: ai,
  photo_required: photo,
  ai_enabled: ai,
});

const report = (format: "pdf" | "xlsx", superadminTelegram: boolean) => ({
  format,
  recipients: {
    superadmin: { telegram: superadminTelegram, in_app: true },
    couriers: { telegram: false, in_app: true },
    markets: { telegram: false, in_app: false },
  },
});

const settings = (patch: Record<string, unknown> = {}) =>
  normalizeShiftCheckSettings({
    account_check_enabled: true,
    main_account_check_enabled: true,
    branch_account_check_enabled: false,
    photo_required: true,
    ai_check_enabled: true,
    cards: [card("1", true, true), card("2", true, false)],
    report: report("pdf", true),
    ...patch,
  });

describe("rebaseDraft", () => {
  it("keeps the user's edits, takes untouched keys from the server, adds new cards and drops removed ones", () => {
    const before = settings();
    const draft = toDraft(before);
    draft.branch_account_check_enabled = true;
    draft.cards["2"] = { require_photo_on_shift_close: true, ai_check_enabled: true };
    draft.report = report("xlsx", true);

    const next = settings({
      photo_required: false,
      cards: [card("2", true, false), card("3", false, false)],
      report: report("pdf", false),
    });
    const rebased = rebaseDraft(before, next, draft);

    expect(rebased.branch_account_check_enabled).toBe(true);
    expect(rebased.photo_required).toBe(false);
    expect(rebased.cards).toEqual({
      "2": { require_photo_on_shift_close: true, ai_check_enabled: true },
      "3": { require_photo_on_shift_close: false, ai_check_enabled: false },
    });
    expect(rebased.report?.format).toBe("xlsx");
    expect(rebased.report?.recipients.superadmin).toEqual({ telegram: false, in_app: true });
    expect(diffShiftSettings(next, rebased)).toEqual({
      branch_account_check_enabled: true,
      cards: [{ card_id: "2", ai_check_enabled: true }],
      report: { format: "xlsx" },
    });
  });

  it("a server-side photo off on an edited card turns its AI off too (AI needs a photo)", () => {
    const before = settings();
    const draft = toDraft(before);
    draft.cards["2"] = { require_photo_on_shift_close: true, ai_check_enabled: true };
    const next = settings({ cards: [card("1", true, true), card("2", false, false)] });
    // Rasm kalitiga foydalanuvchi tegmagan — serverdagi «o'chiq» olinadi, AI ham o'chadi.
    expect(rebaseDraft(before, next, draft).cards["2"]).toEqual({
      require_photo_on_shift_close: false,
      ai_check_enabled: false,
    });
  });

  it("after a save the server already holds the edits — the draft equals the server and nothing is dirty", () => {
    const before = settings();
    const draft = toDraft(before);
    draft.branch_account_check_enabled = true;
    const next = settings({ branch_account_check_enabled: true });
    const rebased = rebaseDraft(before, next, draft);
    expect(rebased).toEqual(toDraft(next));
    expect(diffShiftSettings(next, rebased)).toEqual({});
  });
});
