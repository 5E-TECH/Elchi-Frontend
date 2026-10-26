import { describe, expect, it } from "vitest";
import {
  deriveEnteredOk,
  evaluateShiftAccountRow,
  isAccountCommentRequired,
  normalizeShiftCheckSettings,
  normalizeShiftReport,
  validateShiftPhoto,
} from "./shiftAccountCheck";

/** kiZgTybn — backend `shift-account-check.rules.ts` qoidalarining frontend nusxasi. */
describe("shift account check rules (kiZgTybn)", () => {
  const base = {
    entered: 1_000_000,
    expected: 1_000_000,
    photoRequired: false,
    hasPhoto: false,
    aiStatus: "not_required" as const,
    aiReadBalance: null,
    comment: "",
  };

  it("comment is required on a difference, AI mismatch or entered ≠ image — exactly like the backend", () => {
    expect(isAccountCommentRequired({ difference: 0, ai_status: "match", ai_entered_ok: true })).toBe(false);
    expect(isAccountCommentRequired({ difference: 0.004, ai_status: "match", ai_entered_ok: null })).toBe(false);
    expect(isAccountCommentRequired({ difference: -90_000, ai_status: "match", ai_entered_ok: true })).toBe(true);
    expect(isAccountCommentRequired({ difference: 0, ai_status: "mismatch", ai_entered_ok: true })).toBe(true);
    expect(isAccountCommentRequired({ difference: 0, ai_status: "match", ai_entered_ok: false })).toBe(true);
    expect(isAccountCommentRequired({ difference: null, ai_status: "pending", ai_entered_ok: null })).toBe(false);
  });

  it("entered vs image tolerates 1 so'm", () => {
    expect(deriveEnteredOk(100, 101)).toBe(true);
    expect(deriveEnteredOk(100, 102)).toBe(false);
    expect(deriveEnteredOk(null, 100)).toBeNull();
  });

  it("row errors: entered required, photo when required, comment when required", () => {
    expect(evaluateShiftAccountRow(base).errors).toEqual([]);
    expect(evaluateShiftAccountRow({ ...base, entered: null }).errors).toEqual(["entered"]);
    expect(evaluateShiftAccountRow({ ...base, photoRequired: true }).errors).toEqual(["photo"]);
    expect(evaluateShiftAccountRow({ ...base, photoRequired: true, hasPhoto: true }).errors).toEqual([]);
    const diff = evaluateShiftAccountRow({ ...base, entered: 910_000 });
    expect(diff.difference).toBe(-90_000);
    expect(diff.errors).toEqual(["comment"]);
    expect(evaluateShiftAccountRow({ ...base, entered: 910_000, comment: "Komissiya" }).errors).toEqual([]);
    // Kutilgan noma'lum (registrator) — farq hisoblanmaydi, yakuniy tekshiruv backendda.
    expect(evaluateShiftAccountRow({ ...base, expected: null, entered: 5 }).errors).toEqual([]);
    const enteredMismatch = evaluateShiftAccountRow({ ...base, hasPhoto: true, aiStatus: "match", aiReadBalance: 1_000_500 });
    expect(enteredMismatch.enteredOk).toBe(false);
    expect(enteredMismatch.commentRequired).toBe(true);
  });

  it("photo: jpeg/png/webp up to 5 MB", () => {
    expect(validateShiftPhoto({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateShiftPhoto({ type: "image/jpg", size: 1000 })).toBeNull();
    expect(validateShiftPhoto({ type: "image/gif", size: 1000 })).toBe("type");
    expect(validateShiftPhoto({ type: "image/webp", size: 5 * 1024 * 1024 + 1 })).toBe("size");
  });

  it("normalizes settings and report payloads (numeric strings, unknown statuses)", () => {
    const settings = normalizeShiftCheckSettings({
      data: {
        account_check_enabled: true,
        photo_required: true,
        ai_check_enabled: false,
        cards: [{ card_id: 5, name: "Humo", require_photo_on_shift_close: true, photo_required: true, ai_enabled: false }],
      },
    });
    expect(settings.account_check_enabled).toBe(true);
    expect(settings.cards[0]).toMatchObject({ card_id: "5", photo_required: true, ai_enabled: false });
    expect(normalizeShiftCheckSettings({}).account_check_enabled).toBe(false);

    const report = normalizeShiftReport({
      data: {
        shift: { id: 9, status: "closed", opened_by_name: "Ali" },
        cash: { expected_balance: "100.50", discrepancy: null },
        accounts: [{ card_id: "1", expected_balance: "2140000.00", ai_status: "weird", has_photo: false }],
        operations: [{ operation_type: "income", payment_method: "cash", count: "3", total: "1500" }],
      },
    });
    expect(report?.shift).toMatchObject({ id: "9", status: "closed", opened_by_name: "Ali" });
    expect(report?.cash.expected_balance).toBe(100.5);
    expect(report?.cash.discrepancy).toBeNull();
    expect(report?.accounts[0]).toMatchObject({ expected_balance: 2_140_000, ai_status: "not_required" });
    expect(report?.operations[0]).toEqual({ operation_type: "income", payment_method: "cash", count: 3, total: 1500 });
    expect(normalizeShiftReport({ data: {} })).toBeNull();
  });
});
