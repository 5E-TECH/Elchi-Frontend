import { describe, expect, it } from "vitest";
import { resolveBalance, toAmount } from "./settlement";

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
