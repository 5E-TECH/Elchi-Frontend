import { expect, test, type Page } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_95, ORDER_96 } from "./support/orderDetail";

/**
 * BUYURTMA MA'LUMOTLARI — qabul mezonlari, aynan karta dalilidagi buyurtmalar
 * (95 = sold / kuryerda, 102 = waiting / filialda). Soxta backend, 1440px.
 */
const SUPERADMIN = { id: "1", role: "superadmin", name: "Bosh admin", status: "active" };
const MARKET = { id: "m7", role: "market", name: "Kimdur Kimdur", status: "active" };
const COURIER = { id: "93", role: "courier", name: "Xorazm Courier", phone_number: "+998970000090", status: "active" };

const ORDER_102 = {
  ...ORDER_95,
  id: "102",
  status: "waiting",
  sold_at: null,
  to_be_paid: 150000,
  paid_amount: 0,
  courier_id: null,
  holder_type: "BRANCH",
  holder_branch_id: "1",
  holder_courier_id: null,
  createdAt: "2026-07-19T20:30:00.000Z",
};

const createdEvent = (orderId: string, createdAt: string) => ({
  id: `created-${orderId}`,
  order_id: orderId,
  action: "created",
  from_status: null,
  to_status: "new",
  old_value: null,
  new_value: { status: "new" },
  changed_by: "m7",
  changed_by_role: "market",
  actor: { name: "Kimdur Kimdur", role: "market", phone_number: "+998992222222" },
  created_at: createdAt,
});

const openTariffs = async (page: Page) => {
  const block = page.getByTestId("meta-tariffs");
  await block.locator("button[aria-pressed]").click();
  return block;
};
const tariffFields = (page: Page) =>
  page.getByTestId("meta-tariffs").locator("[data-tariff]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-tariff")));

test.describe("Buyurtma ma'lumotlari — qabul mezonlari (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ tarif: superadmin 70 000 / 25 000; market faqat 70 000; kuryer faqat 25 000", async ({ page }) => {
    const cases = [
      { profile: SUPERADMIN, fields: ["marketTariff", "courierTariff", "courierShare", "branchShare"], show: { marketTariff: 70, courierTariff: 25 } },
      { profile: MARKET, fields: ["marketTariff"], show: { marketTariff: 70 } },
      { profile: COURIER, fields: ["courierTariff"], show: { courierTariff: 25 } },
    ] as const;
    for (const { profile, fields, show } of cases) {
      const { leaked } = await mockOrderDetailApi(page, ORDER_95, { profile });
      await openOrderDetail(page, "95");
      expect(await tariffFields(page), profile.role).toEqual(fields);
      const block = await openTariffs(page);
      for (const [field, thousands] of Object.entries(show)) {
        await expect(block.locator(`[data-tariff="${field}"] dd`), `${profile.role} ${field}`).toHaveText(
          new RegExp(`^${thousands}\\D?000 so'm$`),
        );
      }
      expect(leaked, profile.role).toEqual([]);
      await page.context().unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("⭐ /orders/edit/95: kuryer bloki ko'rinadi, telefon tel: havola va bosiladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, ORDER_95, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    expect(page.url()).toContain("/orders/edit/95");

    const courier = page.getByTestId("meta-courier");
    await expect(courier).toBeVisible();
    await expect(courier).toContainText("Xorazm Courier");
    const phone = courier.locator('a[href^="tel:"]');
    await expect(phone).toHaveAttribute("href", "tel:+998970000090");
    await expect(phone).toHaveText("+998970000090");
    // Bosiladigan: ko'rinadi, ustida boshqa element yo'q (trial click — haqiqiy qo'ng'iroq ochilmaydi).
    await phone.click({ trial: true });
    expect(leaked).toEqual([]);
  });

  test("⭐ tarif standart holatda XIRA; ko'z tugmasi bosilganda ochiladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, ORDER_95, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    const value = page.getByTestId("meta-tariffs").locator('[data-tariff="marketTariff"] dd');
    const toggle = page.getByTestId("meta-tariffs").locator("button[aria-pressed]");

    await expect(value).toHaveClass(/blur-sm/);
    await expect(value).toHaveAttribute("aria-hidden", "true");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const blurred = await value.evaluate((el) => getComputedStyle(el).filter);
    expect(blurred).toContain("blur");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(value).not.toHaveClass(/blur-sm/);
    // `transition-[filter]` — xiralik silliq yo'qoladi; animatsiya tugashini kutamiz.
    await expect.poll(() => value.evaluate((el) => getComputedStyle(el).filter)).toBe("none");
    await expect(value).toHaveText(/^70\D?000 so'm$/);
    expect(leaked).toEqual([]);
  });

  test("⭐ \"Hozir kimda\": 95 → COURIER (kuryerda), 102 → BRANCH (filialda)", async ({ page }) => {
    const first = await mockOrderDetailApi(page, ORDER_95, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    await expect(page.getByTestId("meta-holder")).toContainText("Kuryerda: Xorazm Courier");
    expect(first.leaked).toEqual([]);
    await page.context().unrouteAll({ behavior: "ignoreErrors" });

    const second = await mockOrderDetailApi(page, ORDER_102, { profile: SUPERADMIN });
    await openOrderDetail(page, "102");
    await expect(page.getByTestId("meta-holder")).toContainText("Filialda: HQ Toshkent");
    await expect(page.getByTestId("meta-holder")).not.toContainText("Kuryerda");
    expect(second.leaked).toEqual([]);
  });

  test.describe("brauzer UTC zonasida", () => {
    test.use({ timezoneId: "UTC" });

    test("⭐ yaratilgan sana (tarixda) Asia/Tashkent: 95 → 20.07.2026, 13:38:49; 102 → kun siljimaydi", async ({ page }) => {
      const first = await mockOrderDetailApi(page, ORDER_95, {
        profile: SUPERADMIN,
        tracking: () => [createdEvent("95", ORDER_95.createdAt)],
      });
      await openOrderDetail(page, "95");
      // Brauzer UTC — tekshiruv ma'noli bo'lishi uchun.
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe("UTC");
      await expect(page.getByTestId("tracking-event").first()).toContainText("20.07.2026, 13:38:49");
      expect(first.leaked).toEqual([]);
      await page.context().unrouteAll({ behavior: "ignoreErrors" });

      // 19-iyul 20:30 UTC — Toshkentda allaqachon 20-iyul 01:30.
      const second = await mockOrderDetailApi(page, ORDER_102, {
        profile: SUPERADMIN,
        tracking: () => [createdEvent("102", ORDER_102.createdAt)],
      });
      await openOrderDetail(page, "102");
      const event = page.getByTestId("tracking-event").first();
      await expect(event).toContainText("20.07.2026, 01:30:00");
      await expect(event).not.toContainText("19.07.2026");
      expect(second.leaked).toEqual([]);
    });
  });

  test("⭐ parent_order_id bor buyurtmada ota buyurtma havolasi ISHLAYDI (bosilganda #95 ochiladi)", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, ORDER_96, { profile: SUPERADMIN, extraOrders: [ORDER_95] });
    await openOrderDetail(page, "96");
    await expect(page.getByTestId("meta-id")).toContainText("#96");

    const banner = page.getByTestId("order-parent-banner");
    await expect(banner).toContainText("Bu buyurtma #95 ning qisman sotuvidan qolgan qismi");
    await banner.locator("a").click();

    await expect(page).toHaveURL(/\/orders\/edit\/95$/);
    await expect(page.getByTestId("meta-id")).toContainText("#95");
    // 95 ning o'zida ota yo'q — banner yo'q.
    await expect(page.getByTestId("order-parent-banner")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
