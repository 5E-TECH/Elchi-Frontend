import { describe, expect, it } from "vitest";
import {
  cancelBlock,
  isExactRemittance,
  normalizeCancelResult,
  normalizeRemittance,
  normalizeRemittanceResult,
  normalizeRemittancesPage,
  remittanceAdvanceContribution,
  overpayPreview,
  resolveBalance,
  toAmount,
} from "./settlement";

/**
 * ⚠️ POSTGRES `numeric` SATR BO'LIB KELADI.
 *
 * `provider_receivable.amount` — `numeric(14,2)`. TypeORM uni SATR qilib
 * qaytaradi (`"1500000.00"`). Uni to'g'ridan-to'g'ri qo'shsak, JS satrlarni
 * ULAB yuboradi: `"100" + "200" = "100200"` — ya'ni jami summa yuz baravar
 * katta chiqadi va buni hech narsa ushlab qolmaydi (xato bermaydi, faqat
 * son yolg'on bo'ladi).
 */
describe("toAmount", () => {
  it("⭐ satr son sifatida o'qiladi", () => {
    expect(toAmount("1500000.00")).toBe(1_500_000);
    expect(toAmount("0.50")).toBe(0.5);
  });

  it("son o'zgarmaydi", () => {
    expect(toAmount(1_500_000)).toBe(1_500_000);
  });

  it("⭐ jami hisoblashda satrlar ULANMAYDI", () => {
    // Aynan shu xato uchun funksiya yozilgan.
    const rows = [{ amount: "100" }, { amount: "200" }];
    const sum = rows.reduce((acc, r) => acc + toAmount(r.amount), 0);
    expect(sum).toBe(300);
  });

  it("null, undefined va yaroqsiz qiymat — 0", () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount("salom")).toBe(0);
    expect(toAmount("")).toBe(0);
  });
});

/**
 * «Qoldiq» bloki (IS-1): backend `payable_amount = max(0, outstanding − advance)` beradi. Eski backend bu
 * maydonlarni bermasa ham ekran yolg'on son ko'rsatmasligi kerak — formula shu yerda takrorlanadi.
 */
describe("resolveBalance", () => {
  it("⭐ backend maydonlari satr bo'lsa ham songa keltiriladi", () => {
    expect(
      resolveBalance({
        integration_id: "7",
        outstanding_amount: "4860000.00",
        outstanding_count: 23,
        advance_balance: "350000.00",
        payable_amount: "4510000.00",
      }),
    ).toEqual({ outstanding: 4_860_000, outstandingCount: 23, advance: 350_000, payable: 4_510_000, noDebt: false });
  });

  it("⭐ payable_amount kelmasa — yopilmagan qarz − avans", () => {
    const out = resolveBalance({ integration_id: "7", outstanding_amount: 1_000_000, outstanding_count: 2, advance_balance: 250_000 });
    expect(out.payable).toBe(750_000);
  });

  it("avans qarzdan katta — to'lanishi kerak 0, manfiy emas", () => {
    const out = resolveBalance({ integration_id: "7", outstanding_amount: 100_000, outstanding_count: 1, advance_balance: 490_000 });
    expect(out.payable).toBe(0);
    expect(out.noDebt).toBe(false);
  });

  it("eski backend (avanssiz) — avans 0, to'lanishi kerak = yopilmagan qarz", () => {
    const out = resolveBalance({ integration_id: "7", outstanding_amount: "5000000.00", outstanding_count: 3 });
    expect(out).toMatchObject({ advance: 0, payable: 5_000_000, outstanding: 5_000_000 });
  });

  it("qarz yo'q — noDebt; ma'lumot yo'q bo'lsa ham nollar", () => {
    expect(resolveBalance({ integration_id: "7", outstanding_amount: 0, outstanding_count: 0, advance_balance: 490_000, payable_amount: 0 })).toMatchObject({
      noDebt: true,
      advance: 490_000,
      payable: 0,
    });
    expect(resolveBalance(undefined)).toEqual({ outstanding: 0, outstandingCount: 0, advance: 0, payable: 0, noDebt: true });
  });

  it("manfiy avans 0 deb olinadi", () => {
    expect(resolveBalance({ integration_id: "7", outstanding_amount: 100, outstanding_count: 1, advance_balance: -50 }).advance).toBe(0);
  });
});

/**
 * IS-2 (utIffRFx, XAtqsRNH): `POST integrations/:id/remittances` javobi — natija oynasi yoki xabar shu asosda
 * tanlanadi. `numeric` satrlar songa, `cashbox_posted` faqat boolean bo'lsa o'qiladi.
 */
describe("normalizeRemittanceResult", () => {
  const BODY = {
    statusCode: 201,
    message: "Remittance recorded",
    data: {
      remittance_id: 84,
      integration_id: "7",
      remitted_amount: 5_000_000,
      settled_amount: 4_860_000,
      settled_count: 23,
      unapplied_amount: 140_000,
      advance_applied: 0,
      advance_balance: 490_000,
      warning: "To'lovning 140000 so'mi hech bir qarz qatoriga sig'madi",
      cashbox_posted: true,
    },
  };

  it("⭐ backend javobi (o'ram bilan) — songa keltiriladi, xom `warning` olinmaydi", () => {
    const result = normalizeRemittanceResult(BODY, 5_000_000);
    expect(result).toEqual({
      remittanceId: "84",
      remitted: 5_000_000,
      settledAmount: 4_860_000,
      settledCount: 23,
      unapplied: 140_000,
      advanceApplied: 0,
      advanceBalance: 490_000,
      cashboxPosted: true,
    });
    expect(JSON.stringify(result)).not.toContain("sig'madi");
  });

  it("satr summalar va o'ramsiz javob", () => {
    const result = normalizeRemittanceResult(
      { remittance_id: "9", settled_amount: "1282500.00", settled_count: "3", unapplied_amount: "0.00", cashbox_posted: false },
      1_282_500,
    );
    expect(result).toMatchObject({ remittanceId: "9", remitted: 1_282_500, settledAmount: 1_282_500, settledCount: 3, unapplied: 0 });
    expect(result.cashboxPosted).toBe(false);
    expect(result.advanceBalance).toBeNull();
  });

  it("eski / bo'sh javob — kassa holati noma'lum (`null`), summa yuborilganidan", () => {
    const result = normalizeRemittanceResult({ data: { id: "r1" } }, 250_000);
    expect(result).toMatchObject({ remittanceId: "r1", remitted: 250_000, settledCount: 0, cashboxPosted: null });
    expect(normalizeRemittanceResult(undefined, 10).remittanceId).toBeNull();
  });
});

describe("isExactRemittance — xabar yoki natija oynasi", () => {
  const exact = normalizeRemittanceResult(
    { remittance_id: 82, remitted_amount: 2_000_000, settled_amount: 2_000_000, settled_count: 6, unapplied_amount: 0, advance_applied: 0, cashbox_posted: true },
    2_000_000,
  );

  it("⭐ qarzga aniq tushdi va kassaga yozildi — xabar", () => {
    expect(isExactRemittance(exact)).toBe(true);
  });

  it("avansga o'tdi, avansdan ishlatildi, kassaga yozilmadi yoki noma'lum — oyna", () => {
    expect(isExactRemittance({ ...exact, unapplied: 140_000 })).toBe(false);
    expect(isExactRemittance({ ...exact, advanceApplied: 350_000 })).toBe(false);
    expect(isExactRemittance({ ...exact, cashboxPosted: false })).toBe(false);
    expect(isExactRemittance({ ...exact, cashboxPosted: null })).toBe(false);
    expect(isExactRemittance({ ...exact, settledCount: 0 })).toBe(false);
  });
});

describe("overpayPreview — ortiqcha summa (ega S2)", () => {
  const summary = resolveBalance({
    integration_id: "7",
    outstanding_amount: "4860000.00",
    outstanding_count: 23,
    advance_balance: 350_000,
    payable_amount: 4_510_000,
  });

  it("⭐ maket: 5 000 000 − 4 510 000 = 490 000 ortiq, avans 490 000 bo'ladi, 23 ta qarz yopiladi", () => {
    expect(overpayPreview(5_000_000, summary)).toEqual({ excess: 490_000, advanceAfter: 490_000, recordsClosed: 23 });
  });

  it("to'lanishi kerakka teng yoki kam — ortiqcha emas; qoldiq o'qilmagan — bilinmaydi", () => {
    expect(overpayPreview(4_510_000, summary)).toBeNull();
    expect(overpayPreview(1_500_000, summary)).toBeNull();
    expect(overpayPreview(5_000_000, null)).toBeNull();
    expect(overpayPreview(Number.NaN, summary)).toBeNull();
  });

  it("qarz yo'q (to'lanishi kerak = 0) — butun summa ortiq, avansga qo'shiladi", () => {
    const none = resolveBalance({ integration_id: "7", outstanding_amount: 0, outstanding_count: 0, advance_balance: 490_000, payable_amount: 0 });
    expect(overpayPreview(100_000, none)).toEqual({ excess: 100_000, advanceAfter: 590_000, recordsClosed: 0 });
  });

  it("avans qarzdan katta (to'lanishi kerak = 0, qarz bor) — qarz yopiladi, qolgani avans", () => {
    const covered = resolveBalance({ integration_id: "7", outstanding_amount: 200_000, outstanding_count: 2, advance_balance: 300_000 });
    expect(overpayPreview(50_000, covered)).toEqual({ excess: 50_000, advanceAfter: 150_000, recordsClosed: 2 });
  });

  it("tiyin aniqligi — suzuvchi nuqta qoldig'isiz", () => {
    const s = resolveBalance({ integration_id: "7", outstanding_amount: "0.30", outstanding_count: 1, advance_balance: "0.10" });
    expect(overpayPreview(0.3, s)).toEqual({ excess: 0.1, advanceAfter: 0.1, recordsClosed: 1 });
  });
});

/* ═══════════ IS-3 «Olingan to'lovlar» va bekor qilish (DxdZFdIk) ═══════════ */

const ROW = {
  id: 82,
  integration_id: "7",
  created_at: "2026-10-14T06:20:00.000Z",
  amount: "1500000.00",
  settled_count: 1,
  settled_amount: "1150000.00",
  unapplied_amount: "350000.00",
  advance_applied: "0.00",
  reference: " To'lov topshiriqnomasi №4518 ",
  note: "",
  created_by: "1",
  status: "active",
  cashbox_posted: true,
  cancelled_at: null,
  cancel_reason: null,
};

describe("normalizeRemittance", () => {
  it("⭐ `numeric` satrlar songa, bo'sh matn `null` ga, id satrga", () => {
    expect(normalizeRemittance(ROW)).toEqual({
      id: "82",
      createdAt: "2026-10-14T06:20:00.000Z",
      amount: 1_500_000,
      settledCount: 1,
      settledAmount: 1_150_000,
      toAdvance: 350_000,
      advanceApplied: 0,
      reference: "To'lov topshiriqnomasi №4518",
      note: null,
      status: "active",
      cashboxPosted: true,
      cancelledAt: null,
      cancelReason: null,
    });
  });

  it("eski yozuv: settled/advance `null`, kassa noma'lum; manfiy qoldiq avans emas; noma'lum holat — faol", () => {
    const r = normalizeRemittance({
      ...ROW,
      settled_amount: null,
      unapplied_amount: "-100.00",
      advance_applied: null,
      cashbox_posted: null,
      status: undefined,
    });
    expect(r.settledAmount).toBeNull();
    expect(r.advanceApplied).toBeNull();
    expect(r.toAdvance).toBe(0);
    expect(r.cashboxPosted).toBeNull();
    expect(r.status).toBe("active");
  });
});

describe("normalizeRemittancesPage", () => {
  it("⭐ `{ statusCode, data: { items, pagination } }` qobig'i", () => {
    const page = normalizeRemittancesPage(
      { statusCode: 200, data: { items: [ROW], pagination: { total: 14, page: 2, limit: 10 } } },
      2,
      10,
    );
    expect(page.items.map((r) => r.id)).toEqual(["82"]);
    expect(page.pagination).toEqual({ total: 14, page: 2, limit: 10 });
  });

  it("massiv yoki bo'sh javob — buzilmaydi (eski mock / bo'sh backend)", () => {
    expect(normalizeRemittancesPage({ data: [ROW] }, 1, 10).items).toHaveLength(1);
    expect(normalizeRemittancesPage({ data: [] }, 1, 10)).toEqual({ items: [], pagination: { total: 0, page: 1, limit: 10 } });
    expect(normalizeRemittancesPage(undefined, 1, 10).items).toEqual([]);
  });
});

describe("remittanceAdvanceContribution / cancelBlock (backend assertAdvanceNotConsumed nusxasi)", () => {
  const r82 = normalizeRemittance(ROW);
  const r85 = normalizeRemittance({
    ...ROW,
    id: 85,
    created_at: "2026-10-15T06:20:00.000Z",
    unapplied_amount: 0,
    advance_applied: "140000.00",
  });

  it("hissa = max(qoldiq, 0) − avansdan ishlatilgan; eski yozuvda 0", () => {
    expect(remittanceAdvanceContribution(r82)).toBe(350_000);
    expect(remittanceAdvanceContribution(r85)).toBe(-140_000);
    expect(remittanceAdvanceContribution(normalizeRemittance({ ...ROW, advance_applied: null }))).toBe(0);
  });

  it("⭐ avans yetadi — bloklanmaydi", () => {
    expect(cancelBlock(r82, 350_000, [r82])).toBeNull();
    expect(cancelBlock(r82, 500_000, [r82])).toBeNull();
  });

  it("⭐ avansning bir qismi keyingi to'lovda ishlatilgan — bloklanadi, ishlatgan to'lov ko'rsatiladi", () => {
    expect(cancelBlock(r82, 210_000, [r85, r82])).toEqual({ used: 140_000, consumers: ["85"] });
  });

  it("ishlatgan to'lov sahifada yo'q — raqamsiz", () => {
    expect(cancelBlock(r82, 210_000, [r82])).toEqual({ used: 140_000, consumers: [] });
  });

  it("qoldiq o'qilmagan, bekor qilingan yoki hissasiz to'lov — oldindan aytilmaydi", () => {
    expect(cancelBlock(r82, null, [r82])).toBeNull();
    expect(cancelBlock({ ...r82, status: "cancelled" }, 0, [])).toBeNull();
    expect(cancelBlock(r85, 0, [])).toBeNull();
  });
});

describe("normalizeCancelResult", () => {
  it("⭐ backend javobi: qayta ochilgan qarzlar, kassa, summa; xom `message` o'qilmaydi", () => {
    expect(
      normalizeCancelResult({
        statusCode: 200,
        message: "To'lov bekor qilindi",
        data: { remittance_id: "82", amount: 1500000, status: "cancelled", reopened_count: 1, cashbox_reversed: true },
      }),
    ).toEqual({ idempotent: false, reopenedCount: 1, cashboxReversed: true, amount: 1_500_000 });
  });

  it("idempotent javob (allaqachon bekor qilingan) — sonlarsiz", () => {
    expect(normalizeCancelResult({ data: { remittance_id: "82", amount: 1500000, status: "cancelled", idempotent: true } })).toEqual({
      idempotent: true,
      reopenedCount: 0,
      cashboxReversed: false,
      amount: 1_500_000,
    });
  });
});
