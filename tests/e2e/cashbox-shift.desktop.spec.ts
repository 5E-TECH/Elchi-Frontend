import { expect, test } from "@playwright/test";
import { mockCashboxShift, REGIONAL_MANAGER_PROFILE } from "./support/cashboxShift";

/**
 * CB-2 (kfdfYDik, ega javobi CB-S4 — smena hamma kassada majburiy), desktop:
 *  - menejer «To'lovlar», filial kassasida smena yo'q (maket `manager-payments-overview-shift-closed`): ikki amal
 *    o'rnida bitta «Smenani ochish», banner; ochilgach avvalgi amallar qaytadi;
 *  - kassa tafsiloti (maket `manager-payments-cash-detail-courier-shift-closed`): forma o'rnida qulf → smena
 *    ochilgach forma; bo'sh forma yuborilsa fokus «Summa» ga (XsoWhKP5);
 *  - superadmin market kassasi — asosiy kassa smenasi yo'q bo'lsa ayni qulf.
 */
test("menejer «To'lovlar»: smena yo'q → «Smenani ochish» → oyna → smena ochiladi, avvalgi amallar qaytadi", async ({ page }) => {
  const mock = await mockCashboxShift(page, "manager", REGIONAL_MANAGER_PROFILE);
  await page.goto("/payments");

  await expect(page.getByText("Kassa va to'lovlarni boshqarish · smena yopiq")).toBeVisible();
  const banner = page.getByTestId("shift-banner");
  await expect(banner).toContainText("Smena boshlanmagan");
  await expect(banner).toContainText("filial kassasida smena ochilgandan keyin ishlaydi");
  await expect(page.getByRole("button", { name: "Kuryerdan qabul qilish" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "HQ'ga o'tkazish" })).toHaveCount(0);

  await page.getByRole("button", { name: "Smenani ochish" }).click();
  const dialog = page.getByRole("dialog", { name: "Smenani ochish" });
  await expect(dialog).toContainText("Urgut filiali kassasi · yangi smena boshlanadi");
  await expect(dialog).toContainText("Ravshan Ortiqov");
  await expect(dialog).toContainText(/1\s200\s000/);
  await dialog.getByRole("textbox").fill("Ertalabki smena");
  await dialog.getByRole("button", { name: "Smenani ochish" }).click();

  await expect(page.getByText("Smena ochildi", { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("shift-banner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeVisible();
  expect(mock.opens).toEqual([{ comment: "Ertalabki smena" }]);
  expect(mock.leaked).toEqual([]);
});

test("menejer kuryer kassasi: forma o'rnida qulf, tarix ko'rinadi → smena ochilgach forma; xato fokus «Summa» da", async ({ page }) => {
  const mock = await mockCashboxShift(page, "manager", REGIONAL_MANAGER_PROFILE);
  await page.goto("/payments/cash-detail/209?type=courier");

  const locked = page.getByTestId("shift-locked-card");
  await expect(locked.getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeVisible();
  await expect(locked).toContainText("Smena ochilgach ishlaydi");
  await expect(locked).toContainText("Filial kassasida smena ochilgandan keyin kuryerdan pul qabul qilish ishlaydi.");
  await expect(locked).toContainText("Balans va operatsiyalar tarixi ko'rinib turadi.");
  await expect(page.getByRole("heading", { name: "Operatsiyalar tarixi" })).toBeVisible();
  await expect(page.getByPlaceholder("0")).toHaveCount(0);

  await locked.getByRole("button", { name: "Smenani ochish" }).click();
  const dialog = page.getByRole("dialog", { name: "Smenani ochish" });
  await dialog.getByRole("button", { name: "Smenani ochish" }).click();
  await expect(page.getByText("Smena ochildi", { exact: true })).toBeVisible();
  await expect(page.getByTestId("shift-locked-card")).toHaveCount(0);

  // XsoWhKP5: bo'sh forma — fokus birinchi xato maydonga, «To'lov turi» xatosi darhol aytiladi.
  await page.getByRole("button", { name: /qabul qilish$/i }).click();
  const amount = page.getByPlaceholder("0");
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "To'lov turini tanlang" })).toBeVisible();
  expect(mock.opens).toEqual([{}]);
  expect(mock.leaked).toEqual([]);
});

test("superadmin market kassasi: asosiy kassa smenasi yo'q — «marketga to'lov» qulfi", async ({ page }) => {
  const mock = await mockCashboxShift(page, "superadmin");
  await page.goto("/payments/cash-detail/3?type=market");

  await expect(page.getByTestId("shift-locked-card")).toContainText(
    "Asosiy kassada smena ochilgandan keyin marketga to'lov ishlaydi.",
  );
  expect(mock.leaked).toEqual([]);
});
