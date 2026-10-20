import { expect, test } from "@playwright/test";
import { courierCashboxWithAck, setupShellSession } from "./support/shellSession";

/**
 * KI-1 · KI-S1 — kuryerning `/cash-box` sahifasi (390, maket `courier-cashbox-my-transfers-ack`):
 * kartada o'z javobi «Siz tasdiqlagansiz» / «Siz: noto'g'ri»; tartib — «Qabul qildi» → izoh → belgi oxirida;
 * karta nomi (aria-label) ham shu tartibda; javobsiz kartada belgi yo'q.
 */
test("kuryer 390: «Siz tasdiqlagansiz» / «Siz: noto'g'ri», belgi kartada oxirida", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "courier", "Bekzod Normurodov", {
    "finance/cashbox/my-cashbox": courierCashboxWithAck(),
  });
  await page.goto("/cash-box");

  const confirmed = page.getByRole("button", {
    name: /\(Qabul qildi: Mohira Qodirova · Kunlik tushum topshirildi · Siz tasdiqlagansiz\)/,
  });
  await expect(confirmed).toBeVisible();
  const badge = confirmed.locator("[data-payment-ack=confirmed]");
  await expect(badge).toHaveText("Siz tasdiqlagansiz");
  await expect(badge).toHaveAttribute("title", "Botdagi kvitansiyani siz tasdiqlagansiz");

  // Tartib: «Qabul qildi» → izoh → belgi (oxirgi).
  const order = await confirmed.evaluate((card) => {
    const badgeEl = card.querySelector("[data-payment-ack]")!;
    const line = badgeEl.parentElement!;
    return Array.from(line.children).map((child) => child.textContent?.trim() ?? "");
  });
  expect(order[order.length - 1]).toBe("Siz tasdiqlagansiz");
  expect(order.findIndex((text) => text.startsWith("Qabul qildi"))).toBeLessThan(
    order.findIndex((text) => text.includes("Kunlik tushum topshirildi")),
  );

  const disputed = page.getByRole("button", { name: /\(Qabul qildi: Mohira Qodirova · Siz: noto'g'ri\)/ });
  await expect(disputed.locator("[data-payment-ack=disputed]")).toHaveText("Siz: noto'g'ri");
  await expect(page.getByRole("button", { name: /\(Qabul qildi: Sanjar Aliqulov\)/ }).locator("[data-payment-ack]")).toHaveCount(0);
  await expect(page.getByText(/^Kuryer (tasdiqladi|: noto'g'ri)$/)).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await confirmed.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/ki1-courier-ack-390.png" });

  // Tafsilot oynasi (pastki varaqa): «Kvitansiya javobi» — o'sha matn.
  await confirmed.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Kvitansiya javobi")).toBeVisible();
  await expect(dialog.locator("[data-payment-ack=confirmed]")).toHaveText("Siz tasdiqlagansiz");
  await page.screenshot({ path: "test-results/ki1-courier-ack-detail-390.png" });

  expect(leaked).toEqual([]);
});
