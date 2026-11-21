import { expect, test } from "@playwright/test";
import { AI_ORDER, mockAiTraceApi } from "./support/orderAiTrace";
import { mockOrderDetailApi, openOrderDetail } from "./support/orderDetail";

/**
 * «AI izi» (vncdmXOy) — 390px: sarlavhadagi qator, oyna pastki varaqa, o'zgargan maydonlar jadval emas — bloklar,
 * gorizontal skroll yo'q, tugma ≥ 44px. Soxta backend, faqat GET.
 */
const SUPERADMIN = { id: "1", role: "superadmin", name: "E2E superadmin", status: "active" };

test("superadmin: «AI izi» telefonda — bloklar, skrollsiz, tugma 44px", async ({ page }) => {
  const { leaked } = await mockOrderDetailApi(page, AI_ORDER, { profile: SUPERADMIN });
  await mockAiTraceApi(page);
  await openOrderDetail(page, "95");

  const row = page.getByTestId("order-ai-trace-row");
  await expect(row).toBeVisible();
  const open = row.getByRole("button", { name: "AI izi" });
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await open.click();

  const dialog = page.getByTestId("ai-trace-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("claude-sonnet-5")).toBeVisible();
  await expect(dialog.getByText(/Nilufar Rashidova, Admin/)).toBeVisible();
  // Telefonda jadval yashirin, har maydon — blok.
  await expect(dialog.getByTestId("ai-trace-edited")).toBeHidden();
  const list = dialog.getByTestId("ai-trace-edited-list");
  await expect(list).toBeVisible();
  await expect(list.locator("li").filter({ hasText: "Tuman" })).toContainText("Uchtepa tumani");

  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(leaked).toEqual([]);
});
