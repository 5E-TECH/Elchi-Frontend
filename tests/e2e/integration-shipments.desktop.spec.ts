import { expect, test } from "@playwright/test";
import { mockShipmentsApi, openShipments, shipmentErrorPanel, shipmentRow, shipmentRows } from "./support/integrationShipments";

/** Integratsiya → Posilkalar / Hodisalar (tokhPLMP) — 1440px, dizayn v2 `DataTable`. Backend soxta, yozuv yo'q. */
test.describe("Integratsiya posilkalari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC1-TC3, TC9: Mijoz (ism+telefon) va Manzil (tuman+viloyat) ikki qatorda, Summa o'ngda pul formatida, biz/ular yonma-yon", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page);
    await openShipments(page);

    const row = shipmentRow(page, "Mijoz 2 Aliyev");
    const cells = row.locator("td");
    const headers = page.locator('table[aria-label="Posilkalar"] thead th');
    const columnIndex = async (title: string) =>
      (await headers.allInnerTexts()).findIndex((text) => text.trim().toLowerCase() === title.toLowerCase());

    // Mijoz: ism va telefon — ikki ALOHIDA qator (ustma-ust), telefon `formatPhone` bilan.
    const customer = cells.nth(await columnIndex("Mijoz"));
    const name = customer.getByText("Mijoz 2 Aliyev");
    const phone = customer.getByText("+998 90 123 45 62");
    const [nameBox, phoneBox] = [await name.boundingBox(), await phone.boundingBox()];
    expect(phoneBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 1);

    // Manzil: tuman va viloyat ikki qatorda (maket: «Chilonzor tumani / Toshkent sh.»).
    const address = cells.nth(await columnIndex("Manzil"));
    const [districtBox, cityBox] = [
      await address.getByText("Chilonzor tumani").boundingBox(),
      await address.getByText("Toshkent shahri").boundingBox(),
    ];
    expect(cityBox!.y).toBeGreaterThanOrEqual(districtBox!.y + districtBox!.height - 1);

    // Summa: ming ajratgichi + valyuta (`formatMoneyLocalized`) va o'ngga tekislangan.
    const amount = cells.nth(await columnIndex("Summa (jo'natilgan)"));
    await expect(amount).toHaveText(/^1\s252\s000 so'm$/);
    expect(await amount.evaluate((td) => getComputedStyle(td).textAlign)).toMatch(/right|end/);
    const [amountText, amountCell] = [await amount.locator("span").first().boundingBox(), await amount.boundingBox()];
    expect(amountCell!.x + amountCell!.width - (amountText!.x + amountText!.width)).toBeLessThan(20);

    // TC9: ikki tomon statusi yonma-yon — bizniki tarjima qilingan badge, ularniki xom.
    const status = cells.nth(await columnIndex("Holat"));
    await expect(status.getByText("Kutilmoqda")).toBeVisible();
    await expect(status.getByText("Ular: delivered")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC4: buyurtma raqami (#1252, uuid emas) bosilganda buyurtma kartasi ochiladi", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page);
    await openShipments(page);
    const link = shipmentRow(page, "Mijoz 2 Aliyev").getByRole("link", { name: "#1252" });
    await expect(link).toHaveText("#1252");
    await link.click();
    await expect(page).toHaveURL(/\/orders\/edit\/1252$/);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC6: «Nomuvofiqlik» chipi — faqat biz/ular ajralgan qator qoladi", async ({ page }) => {
    const { leaked, requests } = await mockShipmentsApi(page);
    await openShipments(page);
    await expect(shipmentRows(page)).toHaveCount(4);

    await page.getByRole("button", { name: /Nomuvofiqlik/ }).click();
    await expect(shipmentRows(page)).toHaveCount(1);
    await expect(shipmentRows(page).first()).toContainText("Mijoz 2 Aliyev");
    await expect(shipmentRows(page).first()).toContainText("Kutilmoqda");
    await expect(shipmentRows(page).first()).toContainText("Ular: delivered");
    expect(requests.some((r) => r.startsWith("GET integrations/7/shipments") && r.includes("filter=mismatch"))).toBe(true);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC7: status xaritasi bo'sh ulanishda «Nomuvofiqlik» chipi umuman yo'q", async ({ page }) => {
    await mockShipmentsApi(page);
    await openShipments(page, 8);
    await expect(page.getByRole("button", { name: /Yiqilgan/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nomuvofiqlik/ })).toHaveCount(0);
  });

  test("⭐ TC8: Hodisalar → «Imzo xato» chipi faqat signature_valid=false qatorlarni qoldiradi", async ({ page }) => {
    const { leaked, requests } = await mockShipmentsApi(page);
    await page.goto("/integrations/connections?scope=external&c=integration:7&t=log");
    const rows = page.locator('table[aria-label="Kiruvchi webhooklar"] tbody tr');
    await expect(rows).toHaveCount(4, { timeout: 60_000 });

    await page.getByRole("button", { name: /Imzo xato/ }).click();
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) await expect(row).toContainText("imzo xato");
    expect(requests.some((r) => r.startsWith("GET integrations/webhook-logs") && r.includes("invalid_signature=true"))).toBe(true);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC11: telefonni ko'rish huquqi yo'q rol (registrator) — raqam maskalangan", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page, { id: "5", role: "registrator" });
    await openShipments(page);
    const row = shipmentRow(page, "Mijoz 2 Aliyev");
    await expect(row.getByText("*** 4562")).toBeVisible();
    await expect(page.getByText("+998 90 123 45 62")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("xatoli posilka ostida «Xato: …» qatori to'liq enli, «Qayta jo'natish» o'z qatoriga sig'adi", async ({ page }) => {
    await mockShipmentsApi(page);
    await openShipments(page);

    const panel = shipmentErrorPanel(page, "Mijoz 3 Aliyev");
    await expect(panel).toContainText("Xato: HTTP 502 Bad Gateway");
    const retry = panel.getByRole("button", { name: "Qayta jo'natish" });
    const [button, cell, table] = [
      await retry.boundingBox(),
      await panel.boundingBox(),
      await page.locator('table[aria-label="Posilkalar"]').boundingBox(),
    ];
    // Panel jadval eni bo'yicha (colSpan), tugma uning ichida.
    expect(Math.abs(cell!.width - table!.width)).toBeLessThanOrEqual(2);
    expect(button!.x).toBeGreaterThanOrEqual(cell!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(cell!.x + cell!.width);
    // Xatosiz qator ostida panel yo'q (qayta jo'natish tashuvchida ikkinchi yozuv yaratmasin).
    await expect(shipmentErrorPanel(page, "Mijoz 1 Aliyev")).toHaveCount(0);
  });
});
