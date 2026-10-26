import { expect, test } from "@playwright/test";
import { EVENING_TASHKENT, mockSmsCampaignApi, openSegmentCampaign, pick } from "./support/smsCampaign";

/**
 * KM-1 — SMS kampaniya «Mijozlar segmenti» (1440px): faqat «Reklama», Viloyat / Tuman / Market tanlovi, «Oxirgi
 * buyurtma» oralig'i, «Buyurtmalar soni» minimumi → jonli auditoriya va bugungi limit; limitdan oshsa «Ko'rib
 * chiqish» o'chiq; 19:10 da tungi taqiq izohi. Hech narsa yuborilmaydi.
 */
test.describe("SMS kampaniya — mijozlar segmenti, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ segment → jonli auditoriya, limit, tungi taqiq izohi", async ({ page }) => {
    await page.clock.setFixedTime(EVENING_TASHKENT);
    const mock = await mockSmsCampaignApi(page);
    const panel = await openSegmentCampaign(page);

    // «Xabar turi» — faqat «Reklama» (xizmat xabari yo'q).
    await expect(panel.getByRole("textbox", { name: "Xabar turi" })).toHaveValue("Reklama");
    await expect(panel.getByText("Faqat reklama")).toBeVisible();
    await expect(panel.getByRole("radio", { name: "Xizmat xabari" })).toHaveCount(0);

    // Xom ID maydonlari yo'q — tanlovlar.
    await expect(panel.getByRole("textbox", { name: /ID$/ })).toHaveCount(0);
    await expect(panel.getByRole("combobox", { name: /^Tuman/ })).toBeDisabled();
    await pick(page, /^Viloyat/, "Toshkent sh.");
    await expect(panel.getByRole("combobox", { name: /^Tuman/ })).toBeEnabled();
    await pick(page, /^Tuman/, "Chilonzor tumani");
    await pick(page, /^Market/, "Baraka Shop");
    await panel.getByRole("button", { name: /^Oxirgi buyurtma/ }).click();
    await page.getByRole("button", { name: "Bu oy" }).click();
    await panel.getByRole("textbox", { name: "Buyurtmalar soni — dan" }).fill("2");

    const audience = panel.getByTestId("campaign-audience");
    await expect(audience).toHaveAttribute("data-state", "ready");
    await expect(audience).toContainText("Auditoriya: 386 ta");
    await expect(audience).toContainText("Yana 41 tasida rozilik yo'q, 3 tasining raqami noto'g'ri");
    await expect(audience).toContainText("Bugun qolgan: 420 / 500");
    await expect(audience).toContainText("Kerak: 386 ta");
    await expect
      .poll(() => mock.previews.at(-1))
      .toEqual({
        message_class: "promo",
        text: "Elchi",
        segment: {
          region_id: "1",
          district_id: "12",
          market_id: "3",
          // Toshkent yarim tuni (order-service yalang sanani UTC deb o'qiydi).
          last_order_from: "2026-10-01T00:00:00+05:00",
          // «Bu oy» 21-oktabrgacha; backend `< to` — oxirgi kun ham kirsin deb keyingi kun.
          last_order_to: "2026-10-22T00:00:00+05:00",
          min_orders: 2,
        },
      });

    // 19:10 (Toshkent) — reklama ertaga 09:00 da ketadi.
    await expect(panel.getByRole("radio", { name: /Darhol/ })).toBeChecked();
    await expect(panel.getByTestId("campaign-quiet-notice")).toContainText(
      "Hozir 19:10 — SMS ertaga, 09:00 da yuboriladi",
    );
    // KM-6: «Belgilangan vaqtda» endi tanlanadi (sinov — `sms-campaign-schedule.*.spec.ts`).
    await expect(panel.getByRole("radio", { name: /Belgilangan vaqtda/ })).not.toBeChecked();

    // Matn bor, auditoriya tayyor — «Ko'rib chiqish» ochiq.
    await panel.getByRole("textbox", { name: "Xabar matni" }).fill("Elchi: kuzgi chegirma 20%");
    await expect(panel.getByRole("button", { name: "Ko'rib chiqish" })).toBeEnabled();

    // Limitdan oshdi (qolgan 420) — qizil holat, «Ko'rib chiqish» o'chiq.
    mock.audience = { recipients: 450, blocked_no_consent: 0, skipped_invalid_phone: 0 };
    await panel.getByRole("textbox", { name: "Buyurtmalar soni — dan" }).fill("3");
    await expect(audience).toHaveAttribute("data-state", "limit");
    await expect(audience.getByRole("alert")).toContainText("Bugungi limit yetmaydi: kerak 450 ta, qolgan 420 ta");
    await expect(panel.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();

    expect(mock.leaked).toEqual([]);
  });
});

/**
 * sdNGqCBa — «Buyurtmalar soni» «dan – gacha» (`segment.max_orders`) va «Saqlangan segment» (`audience_segment_id`
 * — `segment` o'rniga). Faqat jonli preview so'raladi, hech narsa yuborilmaydi.
 */
test.describe("SMS kampaniya — «gacha» va saqlangan segment, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ «gacha» → max_orders; teskari oraliq so'ralmaydi; saqlangan segment → audience_segment_id; xodimli / o'chirilgan — aniq matn", async ({
    page,
  }) => {
    const mock = await mockSmsCampaignApi(page);
    const panel = await openSegmentCampaign(page);
    await panel.getByRole("textbox", { name: "Xabar matni" }).fill("Elchi: kuzgi chegirma 20%");
    const audience = panel.getByTestId("campaign-audience");
    const review = panel.getByRole("button", { name: "Ko'rib chiqish" });

    // «dan – gacha».
    await panel.getByRole("textbox", { name: "Buyurtmalar soni — dan" }).fill("2");
    await panel.getByRole("textbox", { name: "Buyurtmalar soni — gacha" }).fill("10");
    await expect(audience).toHaveAttribute("data-state", "ready");
    await expect.poll(() => mock.previews.at(-1)?.segment).toEqual({ min_orders: 2, max_orders: 10 });

    // Teskari oraliq: xato «gacha» ostida, so'rov ketmaydi, ko'rib chiqish yopiq.
    const sent = mock.previews.length;
    await panel.getByRole("textbox", { name: "Buyurtmalar soni — dan" }).fill("20");
    await expect(panel.getByText("«dan» «gacha» dan katta bo'lmasligi kerak (teskari oraliq)", { exact: true })).toBeVisible();
    await expect(audience).toHaveAttribute("data-state", "error");
    await expect(audience).toContainText(
      "Buyurtmalar soni: «dan» «gacha» dan katta bo'lmasligi kerak (teskari oraliq)",
    );
    await expect(review).toBeDisabled();
    await page.waitForTimeout(600);
    expect(mock.previews.length).toBe(sent);

    // Saqlangan segment: faqat mijoz shartlilari; tanlansa sharti filtrlarga ko'chadi, so'rovda audience_segment_id.
    await page.getByRole("combobox", { name: /^Saqlangan segment/ }).click();
    await expect(page.getByRole("option", { name: /Toshkent — faol mijozlar/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Kuryerlar va mijozlar/ })).toHaveCount(0);
    await page.getByRole("option", { name: /Toshkent — faol mijozlar/ }).click();
    await expect(panel.getByText("«Toshkent — faol mijozlar (2–10)» segmenti qo'llandi")).toBeVisible();
    await expect(panel.getByRole("textbox", { name: "Buyurtmalar soni — dan" })).toHaveValue("2");
    await expect(panel.getByRole("textbox", { name: "Buyurtmalar soni — gacha" })).toHaveValue("10");
    await expect(panel.getByRole("combobox", { name: /^Viloyat/ })).toContainText("Toshkent sh.");
    await expect(audience).toHaveAttribute("data-state", "ready");
    await expect
      .poll(() => mock.previews.at(-1))
      .toEqual({ message_class: "promo", text: "Elchi", audience_segment_id: "11" });
    await expect(review).toBeEnabled();
    await review.click();
    const dialog = page.getByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
    await expect(dialog).toBeVisible();
    const reviewed = mock.previews.at(-1)!;
    expect(reviewed.audience_segment_id).toBe("11");
    expect(reviewed).not.toHaveProperty("segment");
    // Yubormaymiz — faqat ko'rib chiqish.
    await dialog.getByRole("button", { name: "Bekor qilish" }).click();

    // Backend xodimli deb rad etdi (400 segment_not_customer_only) — aniq matn, xom matn yo'q.
    await page.getByRole("combobox", { name: /^Saqlangan segment/ }).click();
    await page.getByRole("option", { name: /Eski segment/ }).click();
    await expect(audience).toHaveAttribute("data-state", "error");
    await expect(audience).toContainText("Bu saqlangan segmentda xodimlar bor yoki mijozlar yo'q");
    await expect(panel.getByText(/broadcast bor/)).toHaveCount(0);
    await expect(review).toBeDisabled();

    // O'chirilgan segment — 404.
    await page.getByRole("combobox", { name: /^Saqlangan segment/ }).click();
    await page.getByRole("option", { name: /O'chirilgan segment/ }).click();
    await expect(audience).toContainText("Saqlangan segment topilmadi — o'chirilgan bo'lishi mumkin");
    await expect(review).toBeDisabled();

    expect(mock.leaked).toEqual([]);
  });
});
