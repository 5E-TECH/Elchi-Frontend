import { test } from "@playwright/test";
import { runDestinationManagerRejected, runForeignManagerReadOnly } from "./support/mailReceiveDestination";

/** HQ → filial pochtasini faqat manzil filial menejeri qabul qiladi (anKpzwxk) — telefon (390). */
test.describe("Pochta tafsiloti — qabul faqat manzil filial menejeriga (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ boshqa filial menejeri (kunduzgi): faqat o'qish, izoh", async ({ page }) => {
    await runForeignManagerReadOnly(page, { viewer: "other", theme: "light", label: "other-390" });
  });

  test("boshqa filial menejeri (tungi)", async ({ page }) => {
    await runForeignManagerReadOnly(page, { viewer: "other", theme: "dark", label: "other-390" });
  });

  test("manzil filial menejeri: server rad etsa — lokal xabar", async ({ page }) => {
    await runDestinationManagerRejected(page, { theme: "light", label: "rejected-390" });
  });
});
