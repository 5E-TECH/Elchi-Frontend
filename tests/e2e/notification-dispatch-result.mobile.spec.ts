import { expect, test } from "@playwright/test";
import { mockDispatchApi, noHorizontalScroll, sendToEveryone, shot } from "./support/notificationDispatch";

/** NS-1 — natija kartasi va tafsilot oynasi telefonda (390px): kartalar, 44px nishonlar, gorizontal skrollsiz. */
test.describe("Xabar yuborish — natija, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`natija kartasi telefonda (${theme})`, async ({ page }) => {
      const mock = await mockDispatchApi(page, { theme });
      await sendToEveryone(page);

      const card = page.getByTestId("dispatch-result");
      await expect(card.getByText("Qisman yuborildi")).toBeVisible();
      // Telefonda jadval emas — kartalar ro'yxati.
      const list = card.getByRole("list", { name: "Yetkazilmaganlar" });
      await expect(list.getByRole("listitem")).toHaveCount(5);
      await expect(card.getByRole("table")).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBe(true);

      const newMessage = card.getByRole("button", { name: "Yangi xabar" });
      const box = await newMessage.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const toggle = card.getByRole("button", { name: /Yetkazilmaganlar/ });
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await shot(page, `result-phone-${theme}`, card);

      await card.getByRole("button", { name: "Barcha 25 tasini ko'rish" }).click();
      const dialog = page.getByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
      await expect(dialog.getByRole("list", { name: "Yetkazilmaganlar" }).getByRole("listitem")).toHaveCount(10);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `detail-phone-${theme}`);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("natija noma'lum telefonda — tugmalar ustma-ust, asosiysi tepada", async ({ page }) => {
    const mock = await mockDispatchApi(page);
    mock.dispatchReplies = [{ status: 504, body: { message: "Gateway Timeout" } }];
    await sendToEveryone(page);
    const unknown = page.getByTestId("dispatch-unknown");
    const check = await unknown.getByRole("button", { name: "Tarixdan tekshirish" }).boundingBox();
    const retry = await unknown.getByRole("button", { name: "Qayta urinish" }).boundingBox();
    const fresh = await unknown.getByRole("button", { name: "Yangi xabar" }).boundingBox();
    expect(check!.y).toBeLessThan(retry!.y);
    expect(retry!.y).toBeLessThan(fresh!.y);
    for (const box of [check!, retry!, fresh!]) expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, "unknown-phone-light", unknown);
  });
});
