import { test } from "@playwright/test";
import { runDayChange } from "./support/dayChange";

/** Kun almashish soati (Trello #756) — 390px: oyna ichida ikkinchi qadam, ≥ 44 px, pastki varaqa, toshishsiz. */
test.describe("Kun almashish soati — 390px", () => {
  test.describe.configure({ timeout: 90_000 });
  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: qator → «O'zgartirish» → 18:00 → Saqlash`, async ({ page }) => {
      await runDayChange(page, { label: "390", theme, phone: true });
    });
  }
  test("bugungi qabul vaqti qo'yilgan — ogohlantirish ko'rinadi", async ({ page }) => {
    await runDayChange(page, { label: "390", theme: "light", phone: true, withCutoff: true });
  });
});
