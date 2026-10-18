import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * SMS HISOBLAGICHI — NARX (D5sxjGBY, TC6/TC7/TC10) — 1440px.
 * Prod'da tarif sozlanmagan (hammasi null) — shu yerda tarif `GET notifications/sms/tariffs`
 * dan keladi: xizmat 95, reklama 175 so'm / bo'lak. Hech narsa yuborilmaydi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const TARIFFS = { transactional: 95, promo: 175, security: 95 };
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

const mockSmsApi = async (page: Page) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      });
    }
    if (path === "notifications/sms/tariffs")
      return reply(route, { statusCode: 200, data: TARIFFS });
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  });
  return leaked;
};

/** "≈ 1 050 so'm (taxminiy)" → 1050. */
const costOf = async (page: Page, scope = page.locator("body")) => {
  const text = (await scope.getByTestId("sms-meter-cost").innerText()).trim();
  const digits = /\u2248\s*([\d\s\u00a0\u202f]+)\s*so'm/.exec(text)?.[1]?.replace(/\D/g, "");
  return { text, sum: digits ? Number(digits) : null };
};
const partsOf = async (scope: ReturnType<Page["locator"]>) =>
  Number((await scope.getByTestId("sms-meter-parts").innerText()).replace(/\D/g, ""));

const TEXT_50 = "Buyurtmangiz yetkazildi. Rahmat, Elchi pochta xizm"; // 50 lotin belgi

test.describe("SMS hisoblagichi — narx, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test('⭐ Kampaniya: TC6 reklama narxi oshadi, TC7 qabul qiluvchilar bilan qayta hisoblanadi, TC10 "taxminiy"', async ({
    page,
  }) => {
    const leaked = await mockSmsApi(page);
    await page.goto("/notifications/sms");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByTestId("sms-meter")).toBeVisible({ timeout: 60_000 });

    // «Xabar turi» — v2 segment (`radiogroup`).
    await panel.getByRole("radio", { name: "Xizmat xabari" }).click();
    await panel.getByLabel("Xabar matni").fill(TEXT_50);
    await panel.getByLabel("Telefon raqamlari (har qatorda bittadan)").fill("+998901234567");

    // TC10: narx yonida "taxminiy".
    await expect(panel.getByTestId("sms-meter-cost")).toContainText("(taxminiy)");
    const transactional = await costOf(page, panel);
    expect(await partsOf(panel)).toBe(1);
    expect(transactional.sum).toBe(1 * 95 * 1);

    // TC6: "Reklama" — reklama tarifi (175) qo'llanadi, narx OSHADI.
    await panel.getByRole("radio", { name: "Reklama" }).click();
    await expect
      .poll(async () => (await costOf(page, panel)).sum)
      .toBeGreaterThan(transactional.sum!);
    const promoParts = await partsOf(panel);
    expect((await costOf(page, panel)).sum).toBe(promoParts * 175 * 1);
    await expect(panel.getByTestId("sms-meter-cost")).toContainText("(taxminiy)");

    // TC7: qabul qiluvchilar 1 → 3 → 5 — narx har safar qayta hisoblanadi.
    await panel
      .getByLabel("Telefon raqamlari (har qatorda bittadan)")
      .fill("+998901234567\n+998911234567\n+998931234567");
    await expect.poll(async () => (await costOf(page, panel)).sum).toBe(promoParts * 175 * 3);
    await panel
      .getByLabel("Telefon raqamlari (har qatorda bittadan)")
      .fill("+998901234567\n+998911234567\n+998931234567\n+998941234567\n+998951234567");
    await expect.poll(async () => (await costOf(page, panel)).sum).toBe(promoParts * 175 * 5);

    // Xizmat xabariga qaytsa — yana arzon tarif.
    await panel.getByRole("radio", { name: "Xizmat xabari" }).click();
    await expect.poll(async () => (await costOf(page, panel)).sum).toBe(1 * 95 * 5);
    expect(leaked).toEqual([]);
  });

  test('⭐ Shablon muharriri: turi "Reklama" ga o\'zgarsa taxminiy narx oshadi', async ({
    page,
  }) => {
    const leaked = await mockSmsApi(page);
    await page.goto("/notifications/sms");
    await page.getByRole("tab", { name: "Shablonlar" }).click();
    const panel = page.getByRole("tabpanel", { name: "Shablonlar" });
    await panel.getByLabel("Matn").first().fill(TEXT_50);
    await expect(panel.getByTestId("sms-meter-cost")).toContainText("(taxminiy)");
    const transactional = await costOf(page, panel);
    expect(transactional.sum).toBe(95);

    // v2 `Select` (tugma-combobox, ro'yxat `#ui-portal` da — panel tashqarisida).
    await panel.getByRole("combobox", { name: "Xabar turi" }).click();
    await page.getByRole("option", { name: "Reklama" }).click();
    await expect.poll(async () => (await costOf(page, panel)).sum).toBeGreaterThan(95);
    expect((await costOf(page, panel)).sum).toBe((await partsOf(panel)) * 175);
    await expect(panel.getByTestId("sms-meter-cost")).toContainText("(taxminiy)");
    expect(leaked).toEqual([]);
  });
});
