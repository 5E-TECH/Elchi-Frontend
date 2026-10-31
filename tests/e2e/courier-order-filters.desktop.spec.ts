import { expect, test, type Page } from "@playwright/test";
import { mockCourierFilters, tashkentToday } from "./support/courierFilters";

/**
 * yKtzKXeM — kuryer buyurtmalari: qidiruv (ism, telefon) va sana oralig'i haqiqatan so'rovga ketadi va ro'yxatni
 * toraytiradi; filtr o'zgarsa sahifa 1 ga qaytadi; URL'da saqlanadi. Tuman va «Yetkazish» filtrlari bu yerda yo'q:
 * tuman — ega qarori (maketda yo'q), «Yetkazish» — API `where_deliver` ni olishi kerak. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

const searchBox = (page: Page) => page.getByRole("searchbox", { name: /Buyurtmalarni ism/ });
const lastParam = (requests: URLSearchParams[], name: string) => requests.at(-1)?.get(name);

const open = async (page: Page, url = "/orders") => {
  const mock = await mockCourierFilters(page);
  await page.goto(url);
  await expect(searchBox(page)).toBeVisible({ timeout: 60_000 });
  return mock;
};

test("⭐ mijoz ismi bo'yicha qidiruv — faqat mos buyurtma", async ({ page }) => {
  const { requests, leaked } = await open(page);
  await expect(page.getByText("Jasur Karimov").first()).toBeVisible();

  await searchBox(page).fill("Feruza");
  await expect.poll(() => lastParam(requests, "search")).toBe("Feruza");
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov")).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("⭐ telefon raqami bo'yicha qidiruv — faqat mos buyurtma", async ({ page }) => {
  const { requests } = await open(page);
  await searchBox(page).fill("993057164");
  await expect.poll(() => lastParam(requests, "search")).toBe("993057164");
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov")).toHaveCount(0);
});

test("⭐ sana oralig'i — faqat shu oraliqdagi buyurtmalar", async ({ page }) => {
  const { requests } = await open(page);
  await page.getByRole("button", { name: /Sana oralig'i/ }).click();
  await page.getByRole("button", { name: "Bugun", exact: true }).click();

  const today = tashkentToday();
  await expect.poll(() => lastParam(requests, "startDate")).toBe(today);
  expect(lastParam(requests, "endDate")).toBe(today);
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov")).toHaveCount(0);
});

test("⭐ filtr o'zgarsa sahifa 1 ga qaytadi", async ({ page }) => {
  const { requests } = await open(page, "/orders?status=waiting&page=2");
  await expect.poll(() => lastParam(requests, "page")).toBe("2");
  await expect(page.getByText("Mijoz 9").first()).toBeVisible();

  await searchBox(page).fill("Mijoz");
  await expect.poll(() => lastParam(requests, "search")).toBe("Mijoz");
  // Darhol 1-sahifa: eski raqam bilan ortiqcha so'rov ketmaydi.
  expect(
    requests.filter((params) => params.has("search")).map((params) => params.get("page")),
  ).toEqual(["1"]);
});

test("⭐ filtr URL'da — sahifa yangilansa yo'qolmaydi", async ({ page }) => {
  const { requests } = await open(page);
  await searchBox(page).fill("Feruza");
  await expect(page).toHaveURL(/orderSearch=Feruza/);
  await page.getByRole("button", { name: /Sana oralig'i/ }).click();
  await page.getByRole("button", { name: "Bugun", exact: true }).click();
  await expect(page).toHaveURL(/startDay=/);

  await page.reload();
  await expect(searchBox(page)).toHaveValue("Feruza", { timeout: 60_000 });
  await expect.poll(() => lastParam(requests, "search")).toBe("Feruza");
  expect(lastParam(requests, "startDate")).toBe(tashkentToday());
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov")).toHaveCount(0);
});
