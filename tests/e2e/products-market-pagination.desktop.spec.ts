import { expect, test } from "@playwright/test";
import { mockProductsApi as mockApi } from "./support/products";

/**
 * 3qDsJpfW — market o'z mahsulotlarida sahifa va qidiruv; yaratish sahifasida «mavjud mahsulotlar» to'liq.
 * Kontrakt: FRONTEND_CHANGELOG 2026-10-14 (Guruh E): `GET /product/my-products` va `GET /product/market/:id`
 * `search` / `page` / `limit` (≤ 500) qabul qiladi, javob `{ data, total, page, limit }`, sukut limit 10.
 * Soxta backend serverdek: parametr bermasa — 10 ta. 1440px.
 *
 * MH-1 (ega qarori 2026-10-15): market faqat ko'radi (yaratish, tahrirlash, o'chirish yo'q; yaratish sahifasi —
 * 403), «Narx» ustuni (`price`), market operatori — `my-products` dan o'sha ro'yxat, biriktirilmagan bo'lsa (400) —
 * «Siz hali marketga biriktirilmagansiz» + «Qayta tekshirish»; planshetda (768) «Market» ustuni yashirin.
 */
test.describe("Market mahsulotlari: sahifa va qidiruv (3qDsJpfW) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1: 14 mahsulotli market — 2-sahifaga o'tganda `my-products?page=2` ketadi va 11–14 keladi", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market");
    await p.goto("/products");

    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Mahsulot 11", { exact: true })).toHaveCount(0);
    expect(requests.at(-1)?.get("page")).toBe("1");
    expect(requests.at(-1)?.get("limit")).toBe("10");

    await p.getByRole("button", { name: "2", exact: true }).click();

    await expect.poll(() => requests.at(-1)?.get("page")).toBe("2");
    await expect(p.getByText("Mahsulot 11", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 14", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 01", { exact: true })).toHaveCount(0);
  });

  test("⭐ TC2: 2-sahifadagi mahsulot nomi qidirilsa — `search` serverga ketadi va natija chiqadi", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market");
    await p.goto("/products");
    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });

    // Dizayn v2 `/products` (maket `market-products-list`): qidiruv maydoni — `searchbox`, nomi locale'dan.
    await p.getByRole("searchbox", { name: "Mahsulotlarni nomi bo'yicha qidirish" }).fill("Mahsulot 13");

    await expect.poll(() => requests.at(-1)?.get("search")).toBe("Mahsulot 13");
    expect(requests.at(-1)?.get("page")).toBe("1");
    await expect(p.getByText("Mahsulot 13", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 01", { exact: true })).toHaveCount(0);
  });

  test("⭐ TC4: yaratish sahifasi — 15 mahsulotli market (superadmin) jadvalida 15 tasi, `limit` bilan bitta so'rov", async ({ page: p }) => {
    const { requests } = await mockApi(p, "superadmin");
    await p.goto("/products/create-product/3");

    await expect(p.getByText("Mahsulot 15", { exact: true })).toBeVisible({ timeout: 90_000 });
    for (const n of [1, 10, 11, 15]) {
      await expect(p.getByText(`Mahsulot ${String(n).padStart(2, "0")}`, { exact: true })).toBeVisible();
    }
    expect(requests.at(-1)?.get("limit")).toBe("500");
  });

  test("MH-1: market — faqat ko'rish: yaratish va amallar yo'q, «Narx» ustuni, yaratish sahifasi — 403", async ({ page: p }) => {
    await mockApi(p, "market");
    await p.goto("/products");

    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Jami 14 ta mahsulot · Baraka Shop")).toBeVisible();
    await expect(p.getByText("Faqat ko'rish. Mahsulotni Elchi xodimlari qo'shadi va o'zgartiradi.")).toBeVisible();
    await expect(p.getByRole("button", { name: "Mahsulot yaratish" })).toHaveCount(0);
    await expect(p.getByRole("button", { name: /— tahrirlash$/ })).toHaveCount(0);
    await expect(p.getByRole("button", { name: /— o'chirish$/ })).toHaveCount(0);
    await expect(p.getByRole("columnheader")).toHaveText(["#", "Mahsulot nomi", "Narx"]);
    const first = p.getByRole("row").filter({ hasText: "Mahsulot 01" });
    await expect(first.getByRole("cell").nth(2)).toHaveText(/^10\s000 so'm$/);
    const fifth = p.getByRole("row").filter({ hasText: "Mahsulot 05" });
    // Narxsiz: ko'rinishda «—» (ekran o'quvchidan yashirin), ekran o'quvchiga «Narx kiritilmagan».
    await expect(fifth.getByRole("cell").nth(2).getByText("—")).toBeVisible();
    await expect(fifth.getByRole("cell").nth(2).getByText("Narx kiritilmagan")).toHaveClass(/sr-only/);

    await p.goto("/products/create-product/7");
    await expect(p).toHaveURL(/\/403$/, { timeout: 30_000 });
  });

  test("MH-1: market operatori — `my-products` dan o'sha ro'yxat, market nomi qatordan, faqat ko'rish", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market_operator");
    await p.goto("/products");

    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Jami 14 ta mahsulot · Baraka Shop")).toBeVisible();
    expect(requests.at(-1)?.get("page")).toBe("1");
    await expect(p.getByRole("button", { name: "Mahsulot yaratish" })).toHaveCount(0);
    await expect(p.getByRole("button", { name: /— tahrirlash$/ })).toHaveCount(0);
  });

  test("MH-1: market operatori biriktirilmagan (400) — bo'sh holat, «Qayta tekshirish» qayta so'raydi", async ({ page: p }) => {
    let unassigned = true;
    const { requests } = await mockApi(p, "market_operator", { unassigned: () => unassigned });
    await p.goto("/products");

    await expect(p.getByText("Siz hali marketga biriktirilmagansiz")).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Market biriktirilmagan", { exact: true })).toBeVisible();
    await expect(p.getByText(/Operator hech qaysi/)).toHaveCount(0);
    const before = requests.length;

    unassigned = false;
    await p.getByRole("button", { name: "Qayta tekshirish" }).click();
    await expect.poll(() => requests.length).toBeGreaterThan(before);
    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible();
  });

  test("MH-1: xodim — «Narx» ustuni, tahrirlash oynasida narx o'zgartiriladi (`PATCH product/:id` + price)", async ({ page: p }) => {
    const { patches } = await mockApi(p, "superadmin");
    await p.goto("/products");

    await expect(p.getByText("Mahsulot 01", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
    await expect(p.getByRole("columnheader")).toHaveText(["#", "Mahsulot nomi", "Market", "Narx", "Amallar"]);
    await p.getByRole("button", { name: "Mahsulot 01 — tahrirlash" }).first().click();
    const dialog = p.getByRole("dialog", { name: "Mahsulotni tahrirlash" });
    await expect(dialog.getByText("Mahsulot rasmi")).toBeVisible();
    const price = dialog.getByRole("textbox", { name: "Narx" });
    await expect(price).toHaveValue(/^10\s000$/);
    await price.fill("");
    await price.pressSequentially("125000");
    await dialog.getByRole("button", { name: "Saqlash" }).click();

    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0].path).toBe("product/101");
    expect(patches[0].body).toMatch(/name="price"\r\n\r\n125000\r\n/);
    await expect(p.getByRole("region", { name: "Bildirishnomalar" }).getByText("Mahsulot muvaffaqiyatli yangilandi")).toBeVisible();
  });
});

test.describe("MH-1: planshet (768) — «Market» ustuni yashirin, market nomi mahsulot nomi ostida", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test.describe.configure({ timeout: 120_000 });

  test("xodim ro'yxati", async ({ page: p }) => {
    await mockApi(p, "superadmin");
    await p.goto("/products");

    const first = p.getByRole("row").filter({ hasText: "Mahsulot 01" }).first();
    await expect(first).toBeVisible({ timeout: 90_000 });
    await expect(p.getByRole("columnheader", { name: "Market" })).toBeHidden();
    await expect(first.getByRole("cell").nth(1).getByText("Baraka Shop")).toBeVisible();
    await expect(p.getByRole("columnheader", { name: "Narx" })).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
