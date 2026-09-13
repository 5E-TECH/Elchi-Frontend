import { describe, expect, it } from "vitest";
import { money, toAmount } from "./settlement";

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

describe("money", () => {
  it("minglik ajratgich bilan chiqadi", () => {
    // Bo'sh joy turi muhim emas (lokal ` ` ishlatishi mumkin) — raqamlar
    // ajratilgani muhim.
    const out = money(1_500_000).replace(/\s/g, " ");
    expect(out).toContain("1 500 000");
    expect(out).toContain("so'm");
  });

  it("⭐ kasr qismi yaxlitlanadi — tiyin ko'rsatilmaydi", () => {
    /**
     * COD summalari butun so'mda yuritiladi. `1500000.4` ni "1 500 000,4"
     * deb ko'rsatish operatorni "tiyin qayerdan keldi?" degan savolga
     * olib borardi.
     */
    expect(money(1_500_000.4).replace(/\s/g, " ")).toContain("1 500 000");
    expect(money(1_500_000.6).replace(/\s/g, " ")).toContain("1 500 001");
  });

  it("0 ham ko'rsatiladi — bo'sh qolmaydi", () => {
    expect(money(0)).toContain("0");
  });
});
