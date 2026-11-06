import { test } from "@playwright/test";
import { runDestinationManagerRejected, runForeignManagerReadOnly } from "./support/mailReceiveDestination";

/** HQ → filial pochtasini faqat manzil filial menejeri qabul qiladi (anKpzwxk, Elchi-Backend #620/#621) — 1440. */
test.describe("Pochta tafsiloti — qabul faqat manzil filial menejeriga", () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("⭐ boshqa filial menejeri (kunduzgi): «Faqat o'qish», izoh, qabul tugmasi yo'q", async ({ page }) => {
    await runForeignManagerReadOnly(page, { viewer: "other", theme: "light", label: "other-1440" });
  });

  test("boshqa filial menejeri (tungi)", async ({ page }) => {
    await runForeignManagerReadOnly(page, { viewer: "other", theme: "dark", label: "other-1440" });
  });

  test("HQ menejeri: faqat o'qish", async ({ page }) => {
    await runForeignManagerReadOnly(page, { viewer: "hq", theme: "light", label: "hq-1440" });
  });

  test("manzil filial menejeri: qabul tugmasi bor; server 403 post_receive_manager_only — lokal xabar", async ({ page }) => {
    await runDestinationManagerRejected(page, { theme: "light", label: "rejected-1440" });
  });
});
