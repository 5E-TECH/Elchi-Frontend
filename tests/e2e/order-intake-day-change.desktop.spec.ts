import { test } from "@playwright/test";
import { runDayChange } from "./support/dayChange";

/** Kun almashish soati (Trello #756) — 1440px: oyna ichida ikkinchi qadam, toshishsiz. */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Kun almashish soati — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });
  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: qator → «O'zgartirish» → 18:00 → Saqlash`, async ({ page }) => {
      await runDayChange(page, { label: "1440", theme, phone: false });
    });
  }
});
