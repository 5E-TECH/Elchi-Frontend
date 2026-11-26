import { expect, test } from "@playwright/test";
import { passThroughPageData } from "./support/cashboxPassThrough";
import { setupShellSession } from "./support/shellSession";

/**
 * O'tkazma izi (ega 2026-11-26; BE #800) — telefon 390: `/payments` kartalarida kuryer → market juftidan bitta
 * «Kassaga kirmadi» kartasi (ishorasiz summa), tafsilotda ikkala yozuv.
 */
test.use({ timezoneId: "Asia/Tashkent" });

test("telefon: iz jufti — bitta karta, tafsilotda ikkala yozuv", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", passThroughPageData());
  await page.goto("/payments");

  const card = page.getByRole("button", {
    name: /^Marketga o'tkazma \(Jasur Tursunov → Baraka Shop\), Kassaga kirmadi 300\s000 so'm, /,
  });
  await expect(card).toHaveCount(1);
  await expect(page.getByRole("button", { name: /(Kirim|Chiqim) [+−]300\s000/ })).toHaveCount(0);

  await card.click();
  const detail = page.getByRole("dialog", { name: "O'tkazma izi" });
  const legs = detail.getByRole("list", { name: "Kassadagi yozuvlar" }).getByRole("listitem");
  await expect(legs).toHaveText([/#4512 · Kirim\s*\+300\s000 so'm/, /#4513 · Chiqim\s*−300\s000 so'm/]);

  expect(leaked).toEqual([]);
});
