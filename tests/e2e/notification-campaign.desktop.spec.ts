import { expect, test } from "@playwright/test";
import {
  mockCampaignApi,
  noHorizontalScroll,
  openAudience,
  shot,
} from "./support/notificationCampaign";

/**
 * KM-2 — «Xabar yuborish» → «Auditoriya» (kampaniya), 1440px. Maketlar `superadmin-notifications-send-audience`,
 * `-send-states`, `-send-audience-sample-dialog`, `-send-audience-save-dialog`, `-send-confirm-dialog`. Hamma so'rov soxta.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe("Xabar yuborish — auditoriya, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`konstruktor → jonli son → tasdiq → kampaniya progressi → bekor qilish (${theme})`, async ({
      page,
    }) => {
      const mock = await mockCampaignApi(page, { theme });
      const form = await openAudience(page);

      // «Rol» rejimi yo'q.
      await expect(form.getByRole("radio", { name: "Rol" })).toHaveCount(0);

      await form.getByRole("checkbox", { name: "Mijoz" }).check();
      await form.getByRole("checkbox", { name: "Market" }).check();
      await form.getByRole("checkbox", { name: "Xodim" }).check();
      await form.getByRole("button", { name: "Menejer" }).click();
      await form.getByRole("button", { name: "Logist" }).click();
      await expect(form.getByText("2 ta tanlandi")).toBeVisible();

      // Mijoz filtrsiz — son so'ralmaydi.
      await expect(form.getByText("Mijozlar uchun filtr tanlang")).toBeVisible();
      expect(mock.previews.filter((body) => body.include_customers)).toEqual([]);
      await shot(page, `audience-needs-filter-${theme}`);

      await form.getByRole("combobox", { name: "Viloyat" }).click();
      await page.getByRole("option", { name: "Toshkent sh." }).click();
      await form.getByRole("combobox", { name: "Tuman" }).click();
      await page.getByRole("option", { name: "Chilonzor tumani" }).click();
      await form.getByRole("textbox", { name: "Buyurtmalar soni — dan" }).fill("2");
      await form.getByRole("textbox", { name: "Buyurtmalar soni — gacha" }).fill("10");

      const summary = form.getByTestId("audience-summary");
      await expect(summary).toContainText("Auditoriya: 1 308 ta");
      await expect(summary).toContainText("Mijoz 1 186 · Market 98 · Xodim 24");
      await expect(summary).toContainText("Push: 314 ta foydalanuvchi");
      expect(mock.previews.at(-1)).toEqual({
        roles: ["market", "manager", "logist"],
        include_customers: true,
        segment: { region_id: "1", district_id: "11", min_orders: 2, max_orders: 10 },
      });

      // Kanal: Telegram — kampaniyada yo'q, SMS chizilmaydi, guruh kaliti yo'q.
      await expect(form.getByRole("checkbox", { name: "Telegram" })).toBeDisabled();
      await expect(form.getByRole("checkbox", { name: "SMS" })).toHaveCount(0);
      await expect(form.getByRole("textbox", { name: "Guruh kaliti" })).toHaveCount(0);
      await expect(form.getByText("314 ta foydalanuvchida yoqilgan")).toBeVisible();

      await form
        .getByRole("textbox", { name: "Sarlavha" })
        .fill("Kuzgi chegirma: yetkazish 20% arzon");
      await form
        .getByRole("textbox", { name: "Matn" })
        .fill(
          "31-oktabrgacha Toshkent bo'ylab yetkazish 20% arzon. Buyurtmada KUZ20 promokodini ayting.",
        );
      await form.getByRole("combobox", { name: "Kategoriya" }).click();
      await page.getByRole("option", { name: "Reklama" }).click();
      await form.getByRole("checkbox", { name: /Push/ }).check();
      await expect(form.getByText("Darhol · kampaniya · 1 308 ta qabul qiluvchi")).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `audience-ready-${theme}`, form);

      await form.getByRole("button", { name: /^Yuborish/ }).click();
      const confirm = page.getByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
      await expect(confirm).toContainText(
        "Mijoz (Toshkent sh., Chilonzor tumani), Market, Xodim: Menejer, Logist",
      );
      await expect(confirm.getByTestId("confirm-count")).toHaveText("1 308 ta");
      await expect(confirm).toContainText("Ilova ichida, Ochiq ekranga, Push");
      await expect(confirm).toContainText("Reklama");
      await expect(confirm).toContainText("Darhol");
      await shot(page, `audience-confirm-${theme}`);
      await confirm.getByRole("button", { name: /Ha, yuborish/ }).click();
      await expect(confirm).toBeHidden();

      expect(mock.campaigns).toHaveLength(1);
      expect(mock.campaigns[0].key).toMatch(UUID_RE);
      expect(mock.campaigns[0].body).toMatchObject({
        roles: ["market", "manager", "logist"],
        include_customers: true,
        type: "marketing.manual",
        category: "marketing",
        channels: ["in_app", "realtime", "push"],
      });
      expect(mock.campaigns[0].body).not.toHaveProperty("group_key");

      const progress = page.getByTestId("campaign-progress");
      await expect(progress.getByText("Yuborilmoqda")).toBeVisible();
      await expect(progress.getByTestId("campaign-counts")).toContainText("654 / 1 308 yuborildi");
      await expect(progress.getByRole("progressbar", { name: "Yuborildi" })).toHaveAttribute(
        "aria-valuenow",
        "50",
      );
      await expect(page.getByTestId("dispatch-locked")).toContainText(
        "Kampaniya navbatga qo'yildi",
      );
      await shot(page, `campaign-progress-${theme}`, progress);

      await progress.getByRole("button", { name: "Bekor qilish" }).click();
      const cancel = page.getByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
      await expect(cancel).toContainText("Qolgan 654 ta qabul qiluvchiga yuborilmaydi");
      await shot(page, `campaign-cancel-${theme}`);
      await cancel.getByRole("button", { name: "Kampaniyani bekor qilish" }).click();
      await expect(
        page
          .getByRole("region", { name: "Bildirishnomalar" })
          .getByText("Kampaniya bekor qilindi", { exact: true }),
      ).toBeVisible();
      await expect(progress.getByText("Bekor qilingan")).toBeVisible();
      await expect(progress.getByRole("button", { name: "Bekor qilish" })).toHaveCount(0);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("holatlar: faqat xodim, chegaradan oshdi, 0 ta, xato va «Qayta urinish»", async ({
    page,
  }) => {
    const mock = await mockCampaignApi(page);
    const form = await openAudience(page);
    await form.getByRole("checkbox", { name: "Xodim" }).check();
    await form.getByRole("button", { name: "Admin" }).click();
    await form.getByRole("button", { name: "Menejer" }).click();
    await form.getByRole("button", { name: "Kuryer" }).click();
    const summary = form.getByTestId("audience-summary");
    await expect(summary).toContainText("Auditoriya: 236 ta");
    await expect(summary).toContainText("Xodim: Kuryer 212 · Menejer 20 · Admin 4");
    await expect(form.getByText(/Mijoz filtrlari yashirin/)).toBeVisible();
    await shot(page, "state-staff-only", summary);

    mock.previewOverride = {
      status: 200,
      body: {
        data: {
          exact: false,
          total: 24310,
          by_role: {},
          by_channel: { push: null },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: false,
        },
      },
    };
    await form.getByRole("button", { name: "Logist" }).click();
    await expect(form.getByText("Auditoriya: 24 310 ta — chegara 20 000 ta")).toBeVisible();
    await expect(form.getByRole("button", { name: /^Yuborish/ })).toBeDisabled();
    await expect(form.getByText("Auditoriya chegaradan oshgan — yuborib bo'lmaydi")).toBeVisible();
    await shot(page, "state-over-cap");

    mock.previewOverride = {
      status: 200,
      body: {
        data: {
          exact: true,
          total: 0,
          by_role: {},
          by_channel: { push: 0 },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: false,
        },
      },
    };
    await form.getByRole("button", { name: "Registrator" }).click();
    await expect(summary).toContainText("Auditoriya: 0 ta");
    await expect(form.getByText("Auditoriya bo'sh — yuborib bo'lmaydi")).toBeVisible();

    mock.previewOverride = { status: 503, body: { message: "Service Unavailable: identity down" } };
    await form.getByRole("button", { name: "Admin" }).click();
    await expect(summary.getByText("Auditoriyani hisoblab bo'lmadi")).toBeVisible();
    await expect(page.getByText(/identity down/)).toHaveCount(0);
    await shot(page, "state-error");
    mock.previewOverride = null;
    await form.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(summary).toContainText("Auditoriya: 242 ta");
    expect(mock.leaked).toEqual([]);
  });

  test("namuna, segmentni saqlash va saqlangan segmentni tanlash / o'chirish", async ({ page }) => {
    const mock = await mockCampaignApi(page);
    const form = await openAudience(page);

    await form.getByRole("combobox", { name: "Saqlangan segment" }).click();
    await expect(page.getByRole("option", { name: /Toshkent — faol mijozlar/ })).toContainText(
      "1 308 ta",
    );
    await shot(page, "segments-list");
    await page.getByRole("option", { name: /Toshkent — faol mijozlar/ }).click();
    await expect(form.getByRole("checkbox", { name: "Mijoz" })).toBeChecked();
    await expect(form.getByRole("button", { name: "Logist" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(form.getByRole("textbox", { name: "Buyurtmalar soni — gacha" })).toHaveValue("10");
    await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 1 308 ta");

    await form.getByRole("button", { name: "Namunani ko'rish" }).click();
    const sample = page.getByRole("dialog", { name: "Auditoriya namunasi" });
    await expect(
      sample.getByRole("table", { name: "Auditoriya namunasi" }).getByRole("row"),
    ).toHaveCount(21);
    await expect(sample).toContainText("***7434");
    await expect(sample).toContainText("1 308 ta qabul qiluvchidan 20 tasi");
    expect(mock.previews.at(-1)).toMatchObject({ with_sample: true });
    await shot(page, "sample-dialog");
    await sample.getByRole("button", { name: "Yopish" }).first().click();

    await form.getByRole("button", { name: "Segmentni saqlash" }).click();
    const save = page.getByRole("dialog", { name: "Segmentni saqlash" });
    await expect(save).toContainText("Toshkent sh. · Chilonzor tumani");
    await expect(save).toContainText("2–10");
    await expect(save).toContainText("1 308 ta");
    await save.getByRole("textbox", { name: "Nomi" }).fill("Chilonzor — faol mijozlar");
    await shot(page, "save-dialog");
    await save.getByRole("button", { name: "Saqlash" }).click();
    await expect(
      page
        .getByRole("region", { name: "Bildirishnomalar" })
        .getByText("Segment saqlandi", { exact: true }),
    ).toBeVisible();

    await form.getByRole("combobox", { name: "Saqlangan segment" }).click();
    await page.getByRole("option", { name: /Uxlab qolgan/ }).click();
    await form
      .getByRole("button", { name: "«Uxlab qolgan mijozlar (iyuldan beri)» segmentini o'chirish" })
      .click();
    const del = page.getByRole("alertdialog", { name: "Segmentni o'chirasizmi?" });
    await expect(del).toContainText("Yuborilgan kampaniyalarga ta'sir qilmaydi");
    await del.getByRole("button", { name: "Segmentni o'chirish" }).click();
    await expect(
      page
        .getByRole("region", { name: "Bildirishnomalar" })
        .getByText("Segment o'chirildi", { exact: true }),
    ).toBeVisible();
    expect(mock.leaked).toEqual([]);
  });

  test("javob kelmadi (504) — «Qayta urinish» AYNI Idempotency-Key bilan", async ({ page }) => {
    const mock = await mockCampaignApi(page);
    mock.createReplies = [{ status: 504, body: { message: "Gateway Timeout" } }];
    const form = await openAudience(page);
    await form.getByRole("checkbox", { name: "Market" }).check();
    await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 98 ta");
    await form.getByRole("textbox", { name: "Sarlavha" }).fill("Yangi tariflar 1-noyabrdan");
    await form.getByRole("button", { name: /^Yuborish/ }).click();
    await page
      .getByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" })
      .getByRole("button", { name: /Ha, yuborish/ })
      .click();

    const progress = page.getByTestId("campaign-progress");
    await expect(progress.getByText("Javob kelmadi")).toBeVisible();
    await shot(page, "campaign-unknown", progress);
    await progress.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(progress.getByText("Yuborilmoqda")).toBeVisible();
    expect(mock.campaigns).toHaveLength(2);
    expect(mock.campaigns[1].key).toBe(mock.campaigns[0].key);
    expect(mock.leaked).toEqual([]);
  });
});
