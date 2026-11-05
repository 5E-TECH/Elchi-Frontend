import { test } from "@playwright/test";
import {
  runTransferHappyPath,
  runTransferRejected,
  runTransferRoleVisibility,
} from "./support/mailTransferBranch";

/**
 * EzgWTudf (#212): jo'natilgan pochtani boshqa qabul qiluvchiga — Elchi v2 da boshqa filialga — o'tkazish
 * («Eski» pochta → «Filialga o'tkazish»), 1440px.
 */
test.describe("Pochtani boshqa filialga o'tkazish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1+TC2: superadmin — jo'natilganda tugma, o'tkazgach «Eski»da yangi filial; qabul qilinganda tugma yo'q", async ({
    page,
  }) => {
    await runTransferHappyPath(page);
  });

  test("TC1+TC2 tungi mavzuda", async ({ page }) => {
    await runTransferHappyPath(page, { theme: "dark" });
  });

  test("⭐ TC3: backend rad etsa — tushunarli matn oynada, oyna ochiq", async ({ page }) => {
    await runTransferRejected(page);
  });

  for (const [role, visible] of [
    ["superadmin", true],
    ["admin", true],
    ["registrator", false],
    ["manager", false],
  ] as const) {
    test(`TC4: ${role} — tugma ${visible ? "bor" : "yo'q"}`, async ({ page }) => {
      await runTransferRoleVisibility(page, role, visible);
    });
  }
});
