import { expect, test } from "@playwright/test";
import {
  fixedActionColumnProblems,
  mockShipmentsApi,
  openShipments,
  shipmentRow,
} from "./support/integrationShipments";

/** Integratsiya → Posilkalar / Hodisalar (tokhPLMP) — 1440px. Backend soxta, yozuv yo'q. */
test.describe("Integratsiya posilkalari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC1-TC3, TC9: Mijoz (ism+telefon) va Manzil (shahar+tuman) ikki qatorda, Summa o'ngda pul formatida, biz/ular yonma-yon", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page);
    await openShipments(page);

    const row = shipmentRow(page, "Mijoz 2 Aliyev");
    const cells = row.locator("td");
    const headers = page.locator(".ant-table-thead th");
    const columnIndex = async (title: string) =>
      (await headers.allInnerTexts()).findIndex((text) => text.trim() === title);

    // Mijoz: ism va telefon — ikki ALOHIDA qator (ustma-ust).
    const customer = cells.nth(await columnIndex("Mijoz"));
    const name = customer.getByText("Mijoz 2 Aliyev");
    const phone = customer.getByText("+998901234562");
    const [nameBox, phoneBox] = [await name.boundingBox(), await phone.boundingBox()];
    expect(phoneBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 1);

    // Manzil: shahar va tuman ikki qatorda.
    const address = cells.nth(await columnIndex("Manzil"));
    const [cityBox, districtBox] = [
      await address.getByText("Toshkent shahri").boundingBox(),
      await address.getByText("Chilonzor tumani").boundingBox(),
    ];
    expect(districtBox!.y).toBeGreaterThanOrEqual(cityBox!.y + cityBox!.height - 1);

    // Summa: ming ajratgichi bilan va o'ngga tekislangan.
    const amount = cells.nth(await columnIndex("Summa (jo'natilgan)"));
    await expect(amount).toHaveText("1 252 000");
    expect(await amount.evaluate((td) => getComputedStyle(td).textAlign)).toMatch(/right|end/);
    const [amountText, amountCell] = [await amount.locator("span").boundingBox(), await amount.boundingBox()];
    expect(amountCell!.x + amountCell!.width - (amountText!.x + amountText!.width)).toBeLessThan(20);

    // TC9: ikki tomon statusi yonma-yon.
    const status = cells.nth(await columnIndex("Holat"));
    await expect(status.getByText("biz: Kutilmoqda")).toBeVisible();
    await expect(status.getByText("ular: delivered")).toBeVisible();
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

  test("⭐ TC6: \"Nomuvofiqlik\" pili — faqat biz/ular ajralgan qator qoladi", async ({ page }) => {
    const { leaked, requests } = await mockShipmentsApi(page);
    await openShipments(page);
    await expect(page.locator(".ant-table-tbody tr.ant-table-row")).toHaveCount(4);

    await page.getByRole("button", { name: /Nomuvofiqlik/ }).click();
    const rows = page.locator(".ant-table-tbody tr.ant-table-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Mijoz 2 Aliyev");
    await expect(rows.first()).toContainText("biz: Kutilmoqda");
    await expect(rows.first()).toContainText("ular: delivered");
    expect(requests.some((r) => r.startsWith("GET integrations/7/shipments") && r.includes("filter=mismatch"))).toBe(true);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC7: status xaritasi bo'sh ulanishda \"Nomuvofiqlik\" pili umuman yo'q", async ({ page }) => {
    await mockShipmentsApi(page);
    await openShipments(page, 8);
    await expect(page.getByRole("button", { name: /Yiqilgan/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nomuvofiqlik/ })).toHaveCount(0);
  });

  test("⭐ TC8: Hodisalar → \"Imzo xato\" pili faqat signature_valid=false qatorlarni qoldiradi", async ({ page }) => {
    const { leaked, requests } = await mockShipmentsApi(page);
    await page.goto("/integrations/connections?scope=external&c=integration:7&t=log");
    const rows = page.locator(".ant-table-tbody tr.ant-table-row");
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
    await expect(page.getByText("+998901234562")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("qotirilgan \"Buyurtma\" / \"Amal\" ustunlari foni shaffofmas — ostidan qo'shni ustun ko'rinmaydi", async ({ page }) => {
    await mockShipmentsApi(page);
    await openShipments(page);
    expect(await fixedActionColumnProblems(page)).toEqual([]);

    // "Qayta jo'natish" tugmasi o'z katakchasiga to'liq sig'adi (kesilmaydi).
    const retry = shipmentRow(page, "Mijoz 3 Aliyev").getByRole("button", { name: "Qayta jo'natish" });
    const [button, cell] = [await retry.boundingBox(), await retry.locator("xpath=ancestor::td").boundingBox()];
    expect(button!.x).toBeGreaterThanOrEqual(cell!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(cell!.x + cell!.width);
  });
});
