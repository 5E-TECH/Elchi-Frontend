import { expect, test } from "@playwright/test";
import {
  courierCashboxWithAck,
  courierCashDetailWithAck,
  HQ_MANAGER_PROFILE,
  setupShellSession,
} from "./support/shellSession";

/**
 * KI-1 · KI-S1 — kvitansiya javobi yorlig'i ko'ruvchiga qarab (desktop):
 *  - kuryer (`/cash-box`, maket `courier-cashbox-my-transfers-ack`) — «Siz tasdiqlagansiz» / «Siz: noto'g'ri»;
 *  - xodim (menejer, kuryer kassasi tafsiloti) — «Kuryer tasdiqladi» / «Kuryer: noto'g'ri»
 *    (maketlar `manager-payments-cash-detail-courier-ack`, `manager-payments-history-detail-dialog-ack`).
 */
test("kuryer desktop: jadvalda «Siz …» belgilari va tafsilotdagi «Kvitansiya javobi»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "courier", "Bekzod Normurodov", {
    "finance/cashbox/my-cashbox": courierCashboxWithAck(),
  });
  await page.goto("/cash-box");

  const table = page.getByRole("table");
  await expect(table.locator("[data-payment-ack=confirmed]")).toHaveText("Siz tasdiqlagansiz");
  await expect(table.locator("[data-payment-ack=disputed]")).toHaveText("Siz: noto'g'ri");
  await expect(table.locator("[data-payment-ack=disputed]")).toHaveAttribute(
    "title",
    "Botdagi kvitansiyaga siz «Noto'g'ri» deb javob bergansiz",
  );
  await expect(table.locator("[data-payment-ack]")).toHaveCount(2);
  await page.screenshot({ path: "test-results/ki1-courier-ack-desktop.png" });

  await table.locator("tr", { has: page.locator("[data-payment-ack=disputed]") }).getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-payment-ack=disputed]")).toHaveText("Siz: noto'g'ri");
  expect(leaked).toEqual([]);
});

test("menejer desktop: kuryer kassasi tafsilotida «Kuryer tasdiqladi» / «Kuryer: noto'g'ri» (+ oyna)", async ({ page }) => {
  const { leaked } = await setupShellSession(
    page,
    "manager",
    "Mohira Qodirova",
    { "finance/cashbox/user/263": courierCashDetailWithAck() },
    HQ_MANAGER_PROFILE,
  );
  await page.goto("/payments/cash-detail/263?type=courier");

  const confirmed = page.locator("[data-payment-ack=confirmed]");
  await expect(confirmed).toHaveText("Kuryer tasdiqladi");
  await expect(confirmed).toHaveAttribute("title", "Kuryer botdagi kvitansiyani tasdiqladi");
  await expect(page.locator("[data-payment-ack=disputed]")).toHaveText("Kuryer: noto'g'ri");
  await expect(page.locator("[data-payment-ack]")).toHaveCount(2);
  await expect(page.getByText(/^Siz( tasdiqlagansiz|: noto'g'ri)$/)).toHaveCount(0);

  // Qator nomi (aria-label) — maketdagidek javob oxirida.
  const disputedRow = page.getByRole("button", { name: /, Kuryer: noto'g'ri$/ });
  await expect(disputedRow).toHaveCount(1);
  await disputedRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/ki1-manager-ack-desktop.png" });

  await disputedRow.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-payment-ack=disputed]")).toHaveText("Kuryer: noto'g'ri");
  await page.screenshot({ path: "test-results/ki1-manager-ack-detail-desktop.png" });
  expect(leaked).toEqual([]);
});
