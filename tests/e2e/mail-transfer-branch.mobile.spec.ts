import { test } from "@playwright/test";
import { runTransferHappyPath } from "./support/mailTransferBranch";

/** EzgWTudf (#212): «Filialga o'tkazish» telefonda (390px) — oyna pastki varaqa, gorizontal skroll yo'q. */
test.describe("Pochtani boshqa filialga o'tkazish — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: o'tkazish va «Eski»da yangi filial (kunduzgi)", async ({ page }) => {
    await runTransferHappyPath(page, { isPhone: true, label: "390" });
  });

  test("superadmin: o'tkazish (tungi)", async ({ page }) => {
    await runTransferHappyPath(page, { isPhone: true, label: "390", theme: "dark" });
  });
});
