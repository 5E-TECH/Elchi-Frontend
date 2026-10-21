import { expect, test } from "@playwright/test";
import { CONFLICT, mockSatoApi, openSatoCodes } from "./support/satoCodes";
import { toast } from "./support/toast";

/**
 * SA-1 — `/regions/sato-management` (1440): bitta sarlavha «Tumanlar va SATO kodlari», tablar «Tumanlarni
 * o'tkazish» (sukut) · «SATO kodlari» (`?tab=sato`); superadmin — preview + `/district`, KPI, 5 holat tabi, inline
 * kod muharriri (`PATCH district/sato/:id`, 409 → «Bu kod band: …»); admin — preview chaqirilmaydi.
 */
test.describe.configure({ timeout: 120_000 });

test("superadmin: «SATO kodlari» tabi → KPI, «Topildi» → ✎ → «Saqlash» → xabar, preview va /district qayta", async ({ page }) => {
  const mock = await mockSatoApi(page);
  await page.goto("/regions/sato-management");
  await expect(page.getByRole("heading", { name: "Tumanlar va SATO kodlari", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("tab", { name: "Tumanlarni o'tkazish" })).toHaveAttribute("aria-selected", "true");
  expect(mock.counts.preview).toBe(0);

  await page.getByRole("tab", { name: "SATO kodlari" }).click();
  await expect(page).toHaveURL(/\/regions\/sato-management\?tab=sato$/);
  const kpi = page.getByRole("region", { name: "SATO solishtirish natijasi" });
  await expect(kpi).toContainText("3 tasida kod bor");
  await expect(kpi.getByRole("meter", { name: "Mos kelganlar ulushi" })).toBeVisible();
  // 6 ta karta bir qatorda (1440).
  const cards = kpi.locator(":scope > *");
  await expect(cards).toHaveCount(6);
  const tops = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  const status = page.getByRole("tablist", { name: "SATO holati bo'yicha" });
  await expect(status.getByRole("tab")).toHaveText(["Topildi 12", "Topilmadi 3", "Kodi bor 3", "Takroriy nomlar 1", "Bazada yo'q 2"]);
  await expect(page.getByText("1–10 / 12 ta tuman")).toBeVisible();

  await page.getByRole("button", { name: "Kosonsoy tumani — SATO kodini o'zgartirish" }).click();
  const input = page.getByRole("textbox", { name: "Kosonsoy tumani — SATO kodi" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("1714207");
  await page.getByRole("button", { name: "Saqlash" }).click();

  await expect(toast(page, "SATO kodi saqlandi")).toBeVisible();
  expect(mock.patches).toEqual([{ path: "district/sato/104", body: { sato_code: "1714207" } }]);
  await expect.poll(() => mock.counts.preview).toBe(2);
  expect(mock.counts.district).toBe(2);
  await expect(status.getByRole("tab", { name: /^Topildi/ })).toHaveText("Topildi 11");
  await expect(status.getByRole("tab", { name: /^Kodi bor/ })).toHaveText("Kodi bor 4");
  expect(mock.leaked).toEqual([]);
});

test("409 → kod egasi so'raladi → «Bu kod band: Uchtepa tumani, Toshkent sh.»; server matni yo'q", async ({ page }) => {
  const mock = await mockSatoApi(page, { patch: () => CONFLICT });
  await openSatoCodes(page);

  await page.getByRole("tab", { name: /^Kodi bor/ }).click();
  await page.getByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" }).click();
  const input = page.getByRole("textbox", { name: "Yashnobod tumani — SATO kodi" });
  await input.fill("1726262");
  await input.press("Enter");

  await expect(page.getByText("Bu kod band: Uchtepa tumani, Toshkent sh.")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/already exists/)).toHaveCount(0);
  expect(mock.patches).toEqual([{ path: "district/sato/23", body: { sato_code: "1726262" } }]);

  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" })).toBeFocused();
});

test("admin: preview so'ralmaydi, «Kodsiz» · «Kodi bor», KPI yo'q; kod kiritish", async ({ page }) => {
  const mock = await mockSatoApi(page, { role: "admin" });
  await openSatoCodes(page);

  await expect(page.getByRole("tablist", { name: "SATO holati bo'yicha" }).getByRole("tab")).toHaveText([
    "Kodsiz 16",
    "Kodi bor 4",
  ]);
  await expect(page.getByRole("region", { name: "SATO solishtirish natijasi" })).toHaveCount(0);

  await page.getByRole("button", { name: "Urgut sh. — SATO kodini kiritish" }).click();
  await page.getByRole("textbox", { name: "Urgut sh. — SATO kodi" }).fill("1718236");
  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(toast(page, "SATO kodi saqlandi")).toBeVisible();
  expect(mock.patches).toEqual([{ path: "district/sato/32", body: { sato_code: "1718236" } }]);
  expect(mock.counts.preview).toBe(0);
  expect(mock.leaked).toEqual([]);
});
