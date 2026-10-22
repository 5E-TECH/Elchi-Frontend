import { describe, expect, it } from "vitest";

/**
 * VAQT MINTAQASI QO'RIQCHISI: `vitest.config.ts` testlarni Toshkent vaqtiga qotiradi. Bu test o'sha sozlama yo'qolsa
 * darhol yiqiladi — aks holda sanaga bog'liq testlar mahalliy kompyuterda (UTC+5) o'tib, CI'da (UTC) jimgina
 * yiqilardi (deploy #139/#140, 2026-10-22).
 */
describe("test muhiti — Asia/Tashkent", () => {
  it("brauzer mintaqasi Toshkent, siljish UTC+5 (yozgi vaqtsiz)", () => {
    expect(process.env.TZ).toBe("Asia/Tashkent");
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tashkent");
    expect(new Date("2026-01-15T00:00:00Z").getTimezoneOffset()).toBe(-300);
    expect(new Date("2026-07-15T00:00:00Z").getTimezoneOffset()).toBe(-300);
  });

  it("yarim tun fiksturasi o'sha kunda qoladi", () => {
    expect(new Date("2026-08-01T00:00:00+05:00").getDate()).toBe(1);
  });
});
