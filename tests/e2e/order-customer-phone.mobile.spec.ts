import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";

/**
 * iOiPoBMG (ega 2026-11-20) — 390px: buyurtma tafsilotida mijoz telefoni (va qo'shimcha raqami) bosilsa qo'ng'iroq.
 * Nishon ≥ 44px, ikki nishon ustma-ust emas, gorizontal skroll yo'q.
 */
const ORDER = { ...ORDER_96, customer: { ...ORDER_96.customer, extra_number: "+998971112233" } };

test.describe.configure({ timeout: 120_000 });

const box = async (locator: Locator) => {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
};

const expectCallable = async (page: Page) => {
  const phone = page.getByRole("link", { name: "Qo'ng'iroq qilish: Aliyev Vali, +998 90 123 45 67" });
  const extra = page.getByRole("link", { name: "Qo'ng'iroq qilish: Aliyev Vali, +998 97 111 22 33" });
  await expect(phone).toHaveAttribute("href", "tel:+998901234567");
  await expect(extra).toHaveAttribute("href", "tel:+998971112233");
  await extra.scrollIntoViewIfNeeded();
  const [first, second] = [await box(phone), await box(extra)];
  expect(first.height).toBeGreaterThanOrEqual(44);
  expect(second.height).toBeGreaterThanOrEqual(44);
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 0.5);
  // Trial — haqiqiy qo'ng'iroq oynasi ochilmaydi.
  await phone.click({ trial: true });
  await extra.click({ trial: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};

for (const role of ["superadmin", "admin", "manager", "registrator", "market"]) {
  test(`⭐ ${role}: mijoz telefoni va qo'shimcha raqami — tel: havola`, async ({ page }) => {
    const profile = { id: role === "market" ? "m7" : "1", role, name: "E2E", status: "active" };
    const { leaked } = await mockOrderDetailApi(page, ORDER, { profile });
    await openOrderDetail(page);
    await expectCallable(page);
    expect(leaked).toEqual([]);
  });
}
