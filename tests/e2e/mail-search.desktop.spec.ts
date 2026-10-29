import { expect, test } from "@playwright/test";
import { mockMailSearchApi, openMailSearch } from "./support/mailSearch";

/** Pochta tafsiloti → qidiruv (`?q=`) va takroriy telefonlar (MD-1) — desktop 1280. */
test.describe("Pochta ichida qidiruv va takroriy telefonlar — desktop", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ banner chipi qidiruvga yozadi (`?q=`), tanlov qidiruvda yashirin qoladi, «topilmadi» → tozalash", async ({ page }) => {
    const { leaked } = await mockMailSearchApi(page);
    await openMailSearch(page);
    const search = page.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
    const table = page.getByRole("table", { name: "Pochtadagi buyurtmalar" });
    const region = page.getByRole("region", { name: "Tanlangan buyurtmalar" });

    const banner = page.getByTestId("mail-duplicate-phones");
    await expect(banner).toContainText("Takroriy telefon raqamlar aniqlandi (2 ta)");
    await expect(banner).toContainText("bu jo'natishni to'xtatmaydi");
    await expect(table.getByText("Takroriy raqam")).toHaveCount(4);
    // Ogohlantirish chizig'i — takroriy qatorning belgi katagida (3 px, `--color-warning`).
    const stripe = await table
      .getByRole("checkbox", { name: "№10207 ni tanlash" })
      .evaluate((box) => getComputedStyle(box.closest("td")!).boxShadow);
    expect(stripe).toMatch(/inset/);

    await table.getByRole("checkbox", { name: "№10212 ni tanlash" }).check();
    const chip = banner.getByRole("button", { name: /^\+998 90 233 51 79 raqamli 2 ta/ });
    await chip.click();
    await expect(page).toHaveURL(/\/mails\/2483\?q=%2B998\+90\+233\+51\+79$/);
    await expect(search).toHaveValue("+998 90 233 51 79");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("«+998 90 233 51 79» bo'yicha")).toContainText("2 ta");
    await expect(table.getByRole("checkbox", { name: /^№\d+ ni tanlash$/ })).toHaveCount(2);
    await expect(region).toContainText("1 ta buyurtma tanlandi / 9 ta");
    await expect(region).toContainText("1 tasi qidiruvda yashirin, lekin tanlangan qoladi");
    await expect(page.getByText("2 ta ko'rsatilmoqda · 9 tadan")).toBeVisible();

    await region.getByRole("button", { name: "Ko'rinayotganlarni tanlash (2)" }).click();
    await expect(page.getByRole("button", { name: "Pochtani jo'natish — 3 ta" })).toBeEnabled();

    // Qidiruv URL'da — sahifa yangilansa ham saqlanadi.
    await page.reload();
    await expect(search).toHaveValue("+998 90 233 51 79", { timeout: 60_000 });

    await search.fill("Baraka");
    await expect(page.getByText("«Baraka» bo'yicha")).toContainText("market nomi bo'yicha");

    await search.fill("Dilshod");
    // Ko'rinadigan sarlavha + doimiy jonli hudud (ekran o'quvchisi uchun) — bir xil matn.
    await expect(page.getByText("«Dilshod» bo'yicha buyurtma topilmadi").last()).toBeVisible();
    await expect(page.getByTestId("mail-search-status")).toHaveText("«Dilshod» bo'yicha buyurtma topilmadi");
    await expect(page.getByText("0 ta ko'rsatilmoqda · 9 tadan")).toBeVisible();
    await page.getByRole("button", { name: "Qidiruvni tozalash" }).last().click();
    await expect(page).toHaveURL(/\/mails\/2483$/);
    // Tugma yo'qoladi — fokus qidiruv maydoniga qaytadi.
    await expect(search).toBeFocused();
    await expect(table.getByRole("checkbox", { name: /^№\d+ ni tanlash$/ })).toHaveCount(9);
    expect(leaked).toEqual([]);
  });

  test("yozish: o'rtaga harf qo'shilsa kursor joyida qoladi, tez yozishda harf yo'qolmaydi, URL bir marta yoziladi", async ({ page }) => {
    const { leaked } = await mockMailSearchApi(page);
    await openMailSearch(page, "?q=Laylo");
    const search = page.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
    await expect(search).toHaveValue("Laylo");

    await search.click();
    // macOS Chromium'da `Home` maydonda kursorni siljitmaydi (u yerda qator boshi — Cmd+←), aks holda
    // «xy» oxiriga yozilib test faqat Mac'da yiqiladi. CI (Linux) avvalgidek `Home`.
    await search.press(process.platform === "darwin" ? "Meta+ArrowLeft" : "Home");
    await search.press("ArrowRight");
    await search.press("ArrowRight");
    await search.pressSequentially("xy");
    await expect(search).toHaveValue("Laxyylo");
    expect(await search.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(4);

    await search.fill("");
    await expect(page).toHaveURL(/\/mails\/2483$/);
    await search.pressSequentially("Laylo Hasanova");
    await expect(search).toHaveValue("Laylo Hasanova");
    await expect(page).toHaveURL(/\/mails\/2483\?q=Laylo\+Hasanova$/);
    await expect(
      page.getByRole("table", { name: "Pochtadagi buyurtmalar" }).getByRole("checkbox", { name: /^№\d+ ni tanlash$/ }),
    ).toHaveCount(2);
    expect(leaked).toEqual([]);
  });

  test("menejer qabul: banner qabul matni, `?from=` URL'dan olinadi, `q` qoladi", async ({ page }) => {
    await mockMailSearchApi(page, { role: "manager" });
    await openMailSearch(page, "?from=today&q=Laylo");
    await expect(page).toHaveURL(/\/mails\/2483\?q=Laylo$/);
    await expect(page.getByTestId("mail-duplicate-phones")).toContainText("bu qabul qilishni to'xtatmaydi");
    await expect(page.getByRole("link", { name: "Bugungi pochtalar" }).or(page.getByRole("button", { name: "Bugungi pochtalar" }))).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Pochtadagi buyurtmalar" }).getByRole("checkbox", { name: /^№\d+ ni tanlash$/ }),
    ).toHaveCount(2);
  });
});
