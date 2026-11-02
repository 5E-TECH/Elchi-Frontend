import { expect, test, type Page } from "@playwright/test";
import { mockCourierFilters, tashkentToday } from "./support/courierFilters";

/**
 * yKtzKXeM — kuryer buyurtmalari: qidiruv (ism, telefon), sana oralig'i va «Yetkazish» haqiqatan so'rovga ketadi va
 * ro'yxatni toraytiradi; filtr o'zgarsa sahifa 1 ga qaytadi; URL'da saqlanadi. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

const searchBox = (page: Page) => page.getByRole("searchbox", { name: /Buyurtmalarni ism/ });
const lastParam = (requests: URLSearchParams[], name: string) => requests.at(-1)?.get(name);
const deliverySelect = (page: Page) => page.getByRole("combobox", { name: "Yetkazish turi" });
const chooseDelivery = async (page: Page, name: string) => {
  await deliverySelect(page).click();
  await page.getByRole("option", { name }).click();
};

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

test("⭐ «Yetkazish» — faqat shu turdagi buyurtmalar, «barchasi» hammasini qaytaradi", async ({
  page,
}) => {
  const { requests, leaked } = await open(page);
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(deliverySelect(page)).toContainText("Yetkazish: barchasi");

  await chooseDelivery(page, "Markazgacha");
  await expect.poll(() => lastParam(requests, "where_deliver")).toBe("center");
  await expect(page.getByText("Jasur Karimov").first()).toBeVisible();
  await expect(page.getByText("Feruza Mirzayeva")).toHaveCount(0);

  // Filtrsiz javob keshda — yangi so'rov shart emas, ekrandagi ro'yxat bilan tekshiriladi.
  await chooseDelivery(page, "Yetkazish: barchasi");
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov").first()).toBeVisible();
  await expect(page).not.toHaveURL(/where_deliver/);
  expect(leaked).toEqual([]);
});

test("⭐ «Yetkazish» o'zgarsa sahifa 1 ga qaytadi", async ({ page }) => {
  const { requests } = await open(page, "/orders?status=waiting&page=2");
  await expect.poll(() => lastParam(requests, "page")).toBe("2");
  await expect(deliverySelect(page)).toBeVisible();

  await chooseDelivery(page, "Uygacha");
  await expect.poll(() => lastParam(requests, "where_deliver")).toBe("address");
  expect(
    requests.filter((params) => params.has("where_deliver")).map((params) => params.get("page")),
  ).toEqual(["1"]);
});

test("⭐ «Yetkazish» URL'da — sahifa yangilansa qoladi, «Barchasi» tabida ham ishlaydi", async ({
  page,
}) => {
  const { requests } = await open(page);
  await chooseDelivery(page, "Markazgacha");
  await expect(page).toHaveURL(/where_deliver=center/);

  await page.reload();
  await expect(deliverySelect(page)).toContainText("Markazgacha", { timeout: 60_000 });
  await expect.poll(() => lastParam(requests, "where_deliver")).toBe("center");
  await expect(page.getByText("Feruza Mirzayeva")).toHaveCount(0);

  await page.getByRole("tab", { name: /Barchasi/ }).click();
  await expect.poll(() => requests.at(-1)?.has("status")).toBe(false);
  expect(lastParam(requests, "where_deliver")).toBe("center");
});

test("⭐ URL'da noto'g'ri «Yetkazish» — API'ga ketmaydi (backend 400 qaytarardi)", async ({
  page,
}) => {
  const { requests } = await open(page, "/orders?status=waiting&where_deliver=xyz");
  await expect(deliverySelect(page)).toContainText("Yetkazish: barchasi");
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  expect(requests.some((params) => params.has("where_deliver"))).toBe(false);
});

test("⭐ 768px: qidiruv, sana va «Yetkazish» joyiga sig'adi", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  await expect(deliverySelect(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
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
