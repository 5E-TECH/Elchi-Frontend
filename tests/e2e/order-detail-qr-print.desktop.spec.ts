import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_95 } from "./support/orderDetail";
import { readQr } from "./support/orderQr";

/**
 * TzfF0bmQ — buyurtma tafsilotida QR va yorliq: QR skaner bilan o'qiladi va mazmuni aynan shu buyurtma tokeni,
 * tokensiz buyurtmada karta yo'q, «Chop etish» — brauzer va PDF 100×60 mm. Soxta backend, 1440px.
 */
const TOKEN = "5c0c4c27af78467d451a027e";
const SUPERADMIN = { id: "1", role: "superadmin", name: "E2E superadmin", status: "active" };

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ QR ko'rinadi va skaner o'qiganda buyurtma tokeni chiqadi", async ({ page }) => {
  const { leaked } = await mockOrderDetailApi(
    page,
    { ...ORDER_95, qr_code_token: TOKEN },
    { profile: SUPERADMIN },
  );
  await openOrderDetail(page, "95");
  await expect(page.getByRole("heading", { name: "QR kod" })).toBeVisible();
  const qr = page.getByRole("img", { name: /buyurtmasining QR kodi/ });
  await expect(qr).toBeVisible();
  expect(await readQr(page, qr)).toBe(TOKEN);
  expect(leaked).toEqual([]);
});

test("⭐ tungi mavzuda ham QR o'qiladi (fon va ramka bilan)", async ({ page }) => {
  // Mavzu serverdagi `appearance.theme` dan sinxronlanadi (SettingsSync).
  const settings = { appearance: { theme: "dark", themeChosen: true, language: "uz" } };
  await mockOrderDetailApi(
    page,
    { ...ORDER_95, qr_code_token: TOKEN },
    { profile: { ...SUPERADMIN, settings } },
  );
  await openOrderDetail(page, "95");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  const qr = page.getByRole("img", { name: /buyurtmasining QR kodi/ });
  await expect(qr.locator("path")).toBeAttached();
  expect(await readQr(page, qr.locator(".."))).toBe(TOKEN);
});

test("⭐ «Brauzer orqali»: 100×60 mm yorliq, tashqi buyurtma nomi chekda, popup yo'q", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const printed: Array<{ size?: string; pages: number; text: string }> = [];
    (window as unknown as { __printed: typeof printed }).__printed = printed;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLIFrameElement)) continue;
          node.addEventListener("load", () => {
            node.contentWindow!.print = () => {
              const doc = node.contentDocument!;
              printed.push({
                size: /@page\{size:([^;]+);/.exec(doc.querySelector("style")?.textContent ?? "")?.[1],
                pages: doc.querySelectorAll(".p").length,
                text: doc.body.textContent ?? "",
              });
            };
          });
        }
    }).observe(document, { childList: true, subtree: true });
  });
  await mockOrderDetailApi(
    page,
    {
      ...ORDER_95,
      qr_code_token: TOKEN,
      items: [{ id: "i1", quantity: 2, product: null, product_name: "Kabel USB-C" }],
    },
    { profile: SUPERADMIN },
  );
  await openOrderDetail(page, "95");
  let popups = 0;
  page.on("popup", () => (popups += 1));

  await page.getByRole("button", { name: "Chop etish" }).click();
  await page.getByRole("menuitem", { name: /Brauzer orqali chop etish/ }).click();

  const printed = () =>
    page.evaluate(
      () =>
        (window as unknown as { __printed: Array<{ size?: string; pages: number; text: string }> })
          .__printed,
    );
  await expect.poll(async () => (await printed()).length, { timeout: 60_000 }).toBe(1);
  const [label] = await printed();
  expect(label.size).toBe("100mm 60mm");
  expect(label.pages).toBe(1);
  expect(label.text).toContain("Aliyev Vali");
  expect(label.text).toContain("Kabel USB-C ×2");
  expect(popups).toBe(0);
});

test("⭐ token yo'q — QR kartasi yo'q, «Chop etish» qoladi", async ({ page }) => {
  await mockOrderDetailApi(page, { ...ORDER_95, qr_code_token: null }, { profile: SUPERADMIN });
  await openOrderDetail(page, "95");
  await expect(page.getByRole("heading", { name: "QR kod" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chop etish" })).toBeVisible();
});

test("⭐ «Chop etish»: ikki usul, PDF yangi oynada ochiladi", async ({ page }) => {
  await mockOrderDetailApi(page, { ...ORDER_95, qr_code_token: TOKEN }, { profile: SUPERADMIN });
  await openOrderDetail(page, "95");
  await page.getByRole("button", { name: "Chop etish" }).click();
  await expect(page.getByRole("menuitem", { name: /Brauzer orqali chop etish/ })).toBeVisible();
  const pdf = page.getByRole("menuitem", { name: /PDF yorliq \(100×60 mm\)/ });
  await expect(pdf).toBeVisible();

  const popup = page.waitForEvent("popup", { timeout: 60_000 });
  await pdf.click();
  const pdfWindow = await popup;
  await expect.poll(() => pdfWindow.url(), { timeout: 30_000 }).toMatch(/^blob:/);
});

for (const [role, profile, visible] of [
  ["market", { id: "m7", role: "market", name: "Kimdur Kimdur", status: "active" }, true],
  ["kuryer", { id: "93", role: "courier", name: "Kuryer", status: "active" }, false],
] as const) {
  test(`⭐ ${role}: QR va «Chop etish» ${visible ? "bor" : "yo'q"}`, async ({ page }) => {
    await mockOrderDetailApi(page, { ...ORDER_95, qr_code_token: TOKEN }, { profile });
    await page.goto("/orders/edit/95");
    await expect(page.getByText("Aliyev Vali").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "QR kod" })).toHaveCount(visible ? 1 : 0);
    await expect(page.getByRole("button", { name: "Chop etish" })).toHaveCount(visible ? 1 : 0);
  });
}
