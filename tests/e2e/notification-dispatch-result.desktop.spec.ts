import { expect, test } from "@playwright/test";
import { mockDispatchApi, noHorizontalScroll, sendToEveryone, shot } from "./support/notificationDispatch";

/**
 * NS-1 — «Xabar yuborish» natijasi (maketlar `superadmin-notifications-send-result`, `-send-unknown`,
 * `-sent-detail-dialog`), 1440px. Barcha so'rovlar soxta, faqat `POST notifications/dispatch`.
 */
test.describe("Xabar yuborish — natija, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`natija kartasi: kanallar, «Yetkazilmaganlar» darhol, tafsilot oynasi (${theme})`, async ({ page }) => {
      const mock = await mockDispatchApi(page, { theme });
      await sendToEveryone(page);

      const card = page.getByTestId("dispatch-result");
      await expect(card.getByRole("heading", { name: "Yuborish natijasi" })).toBeVisible();
      await expect(card.getByText("Qisman yuborildi")).toBeVisible();
      await expect(card).toContainText("Telegram va SMS navbatga qo'yildi");
      const channels = card.getByRole("list", { name: "Kanallar bo'yicha natija" });
      await expect(channels.getByRole("img", { name: "Telegram: navbatda 131, o'tkazib yuborildi 17" })).toBeVisible();

      // «Yetkazilmaganlar» — qo'shimcha so'rov (limit 5), xom sabab yo'q.
      const table = card.getByRole("table", { name: "Yetkazilmaganlar" });
      await expect(table.getByRole("row")).toHaveCount(6);
      await expect(table).toContainText("Telegram ulanmagan");
      await expect(table).toContainText("Telegram xatosi");
      await expect(page.getByText(/bot was blocked/)).toHaveCount(0);

      // Forma qulflangan, «Yuborish» yo'q.
      await expect(page.getByTestId("dispatch-locked")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Yuborish/ })).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `result-desktop-${theme}`, card);

      await card.getByRole("button", { name: "Barcha 25 tasini ko'rish" }).click();
      const dialog = page.getByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
      await expect(dialog.getByText("25 ta qabul qiluvchiga kamida bitta kanal yetmadi")).toBeVisible();
      await expect(dialog.getByRole("table", { name: "Yetkazilmaganlar" }).getByRole("row")).toHaveCount(11);
      await shot(page, `detail-desktop-${theme}`);
      await dialog.getByRole("button", { name: "Keyingi sahifa" }).click();
      await expect(dialog.getByText("11–20 / 25 ta")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // «Yangi xabar» — forma ochiladi.
      await card.getByRole("button", { name: "Yangi xabar" }).click();
      await expect(page.getByTestId("dispatch-result")).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Sarlavha" })).toHaveValue("");
      expect(mock.posts).toHaveLength(1);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("504 → natija noma'lum: «Tarixdan tekshirish» (404), «Qayta urinish» o'sha client_request_id bilan", async ({ page }) => {
    const mock = await mockDispatchApi(page);
    mock.dispatchReplies = [
      { status: 504, body: { message: "Gateway Timeout" } },
      { status: 201, body: { statusCode: 201, data: { dispatched: 148, recipient_ids: [], channels: ["in_app", "realtime", "telegram", "sms"], by_channel: { in_app: 148, realtime: 148, telegram: 140, sms: 139 }, skipped_by_preference: 0, no_provider: [], channel_status: { in_app: { sent: 148 }, realtime: { emitted: 148 }, telegram: { queued: 140, skipped: 8 }, sms: { queued: 139, skipped: 9 } } } } },
    ];
    mock.knownIds = new Set();
    await sendToEveryone(page);

    const unknown = page.getByTestId("dispatch-unknown");
    await expect(unknown.getByText("Noma'lum — tarixdan tekshiring")).toBeVisible();
    await expect(page.getByTestId("dispatch-locked")).toContainText("Natija noma'lum");
    await shot(page, "unknown-desktop-light", unknown);
    expect(mock.posts).toHaveLength(1);

    await unknown.getByRole("button", { name: "Tarixdan tekshirish" }).click();
    const dialog = page.getByRole("dialog", { name: "Yuborilgan xabar" });
    await expect(dialog.getByText("Xabar topilmadi")).toBeVisible();
    // Noma'lum kartadan ochilgan 404 — «Qayta urinish» ga yo'naltiradi (ro'yxat/havola emas).
    await expect(dialog.getByText(/serverga yetmagan/)).toBeVisible();
    await dialog.getByRole("button", { name: "Yopish" }).last().click();
    await expect(dialog).toBeHidden();

    await unknown.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(page.getByTestId("dispatch-result")).toBeVisible();
    expect(mock.posts).toHaveLength(2);
    expect(mock.posts[1].client_request_id).toBe(mock.posts[0].client_request_id);
    expect(mock.leaked).toEqual([]);
  });
});
