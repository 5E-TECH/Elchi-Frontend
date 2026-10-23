import { expect, test } from "@playwright/test";
import { mockFinancialEntryApi, openHistoryTab, submitManualExpense } from "./support/financialEntry";
import { expectToast } from "./support/toast";

/** Balans → Tarix → "Yozuv qo'shish" (GtAoqHlk) — 1440px. Daftarga haqiqiy yozuv YO'Q: gateway soxta. */
test.describe("Balans → Yozuv qo'shish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC1: manual_expense → 201, payload DTO bilan AYNAN mos, tarix sahifa yangilanmasdan yangilanadi", async ({ page }) => {
    const { state, posts, leaked, historyGets, balanceGets } = await mockFinancialEntryApi(page);
    await openHistoryTab(page);
    await page.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });
    const getsBefore = historyGets();
    const balanceGetsBefore = balanceGets();
    expect(balanceGetsBefore).toBeGreaterThan(0);

    const dialog = await submitManualExpense(page, "Ofis ijarasi, oktabr");
    const response = page.waitForResponse(
      (res) => res.url().endsWith("/finance/financial-balance/entries") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Saqlash" }).click();
    expect((await response).status()).toBe(201);

    // forbidNonWhitelisted: ortiqcha maydon yo'q, summa ishorali (chiqim −).
    expect(posts).toHaveLength(1);
    expect(posts[0].status).toBe(201);
    expect(posts[0].body).toEqual({ amount: -1000, source_type: "manual_expense", comment: "Ofis ijarasi, oktabr" });
    expect(posts[0].idempotencyKey).toBeTruthy();

    await expect(dialog).toBeHidden();
    await expectToast(page, "Yozuv qo'shildi", { tone: "success" });
    // Tarix DARHOL yangilanadi: yangi qator jadvalda, reload yo'q.
    const newRow = page.locator("tr").filter({ hasText: "Ofis ijarasi, oktabr" });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText("Qo'lda chiqim");
    await expect(newRow).toContainText("Bosh admin");
    expect(historyGets()).toBeGreaterThan(getsBefore);
    // XAtqsRNH d6a10d / 26eb9d: yuqoridagi balans kartalari ([cashbox, "financial-balance"]) ham darhol qayta so'raladi.
    await expect.poll(balanceGets).toBeGreaterThan(balanceGetsBefore);
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    expect(state.history).toHaveLength(2);
    expect(leaked).toEqual([]);
  });

  test("tarmoq uzilsa: oynada \"Tarmoq xatosi\" (xom \"Network Error\" emas), qayta \"Saqlash\" o'sha kalit bilan bir marta yozadi", async ({ page }) => {
    const { state, posts, leaked } = await mockFinancialEntryApi(page, { failFirstPost: true });
    await openHistoryTab(page);

    const dialog = await submitManualExpense(page, "Kommunal to'lov");
    await dialog.getByRole("button", { name: "Saqlash" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Tarmoq xatosi");
    await expect(dialog.getByText("Network Error")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    const response = page.waitForResponse(
      (res) => res.url().endsWith("/finance/financial-balance/entries") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Saqlash" }).click();
    expect((await response).status()).toBe(201);
    await expect(dialog).toBeHidden();

    expect(posts.map((post) => post.status)).toEqual([0, 201]);
    expect(posts[1].idempotencyKey).toBe(posts[0].idempotencyKey);
    expect(posts[1].body).toEqual(posts[0].body);
    await expect(page.locator("tr").filter({ hasText: "Kommunal to'lov" })).toHaveCount(1);
    expect(state.history).toHaveLength(2);
    expect(leaked).toEqual([]);
  });
});
