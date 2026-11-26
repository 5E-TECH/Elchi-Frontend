import { expect, test } from "@playwright/test";
import { passThroughPageData } from "./support/cashboxPassThrough";
import { setupShellSession } from "./support/shellSession";

/**
 * O'tkazma izi (ega 2026-11-26; BE #800) — superadmin, desktop 1440: kuryer → market to'g'ridan-to'g'ri o'tkazmasi
 * asosiy kassa tarixida «Kirim +300 000» va «Chiqim −300 000» bo'lib ko'rinmaydi — bitta neytral qator
 * «Marketga o'tkazma · Jasur Tursunov → Baraka Shop · Kassaga kirmadi · 300 000 so'm». Tafsilotda ikkala yozuv.
 */
test.use({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tashkent" });

test("/payments: iz jufti — bitta «Kassaga kirmadi» qatori, tafsilotda ikkala yozuv", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", passThroughPageData());
  await page.goto("/payments");

  const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
  const bodyRows = table.locator("tbody tr");
  await expect(bodyRows).toHaveCount(2);
  const trace = bodyRows.first();
  await expect(trace).toContainText("Marketga o'tkazma");
  await expect(trace).toContainText("Jasur Tursunov → Baraka Shop");
  await expect(trace).toContainText("Kassaga kirmadi");
  await expect(trace).toContainText(/300\s000 so'm/);
  await expect(table).not.toContainText(/[+−]300\s000/);

  await trace.getByRole("button", { name: "Marketga o'tkazma", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "O'tkazma izi" });
  const block = detail.getByRole("region", { name: "Kassaga kirmadi" });
  await expect(block).toContainText("Pul bu kassaga kirmadi: Jasur Tursunov → Baraka Shop");
  const legs = block.getByRole("list", { name: "Kassadagi yozuvlar" }).getByRole("listitem");
  await expect(legs).toHaveText([/#4512 · Kirim\s*\+300\s000 so'm/, /#4513 · Chiqim\s*−300\s000 so'm/]);
  // Qoldiq — juftdan keyingi (24 615 000), oraliq 24 915 000 emas.
  await expect(detail).toContainText(/24\s615\s000 so'm/);
  await expect(detail).not.toContainText(/24\s915\s000/);

  expect(leaked).toEqual([]);
});

test("asosiy kassa: iz — bitta qator, «Bugun» kirimiga qo'shilmaydi", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", passThroughPageData());
  await page.goto("/payments/main-cashbox");

  const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const trace = table.locator("tbody tr").first();
  await expect(trace).toContainText("Marketga o'tkazma");
  await expect(trace).toContainText("Kassaga kirmadi");
  // Juftdan keyingi qoldiq (oraliq 24 915 000 emas).
  await expect(trace).toContainText(/Balans: 24\s615\s000 so'm/);
  await expect(table).not.toContainText(/[+−]300\s000/);
  await expect(page.getByText(/^2 ta operatsiya · barcha vaqt$/)).toBeVisible();
  // Davr kartasi: faqat sotuv (420 000) — iz kirim ham, chiqim ham emas.
  await expect(page.getByRole("img", { name: /^Bugun: kirim 420\s000 so'm, chiqim 0 so'm/ })).toBeVisible();

  expect(leaked).toEqual([]);
});
