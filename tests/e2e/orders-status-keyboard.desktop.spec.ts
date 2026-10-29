import { expect, test } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * 4VWDJp3w — `/orders` «Filtrlar» → «Holat» (v2 `Select`, ko'p tanlov) faqat klaviatura bilan: Enter ro'yxatni
 * ochadi (`listbox`, `aria-controls`), ↓ ↓ faol variantni (`aria-activedescendant`) suradi, Enter uni tanlaydi —
 * URL'da `status` paydo bo'ladi va backend'ga uzatiladi; ko'p tanlovda ro'yxat ochiq qoladi. 1440px, soxta backend.
 */
const order = (id: number, status: string) => ({
  id: String(id),
  status,
  total_price: 150000,
  createdAt: "2026-10-16T08:00:00.000Z",
  customer: { name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  items: [],
});

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ «Holat»: Enter bilan ochiladi, ↓ ↓ + Enter — URL'da status=received, ro'yxat ochiq", async ({
  page,
}) => {
  const listRequests: URLSearchParams[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Faqat API so'rovi (sahifaning o'z `/orders` navigatsiyasi emas).
    if (/api\.elchipochta\.uz|:3004$/.test(url.host) && url.pathname === "/orders")
      listRequests.push(url.searchParams);
  });
  const { leaked } = await setupShellSession(page, "superadmin", "Bosh admin", {
    orders: [order(1001, "new"), order(1002, "received")],
  });
  await page.goto("/orders");
  await expect(page.getByText("Mijoz 1001").first()).toBeVisible({ timeout: 90_000 });

  const toggle = page.getByRole("button", { name: /^Filtrlar( \d+)?$/ });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const select = page.getByRole("combobox", { name: "Holat" });
  await select.focus();
  await select.press("Enter");

  const listbox = page.getByRole("listbox", { name: "Holat" });
  await expect(listbox).toBeVisible();
  await expect(select).toHaveAttribute("aria-controls", (await listbox.getAttribute("id")) ?? "");
  const activeLabel = async () => {
    const id = await select.getAttribute("aria-activedescendant");
    return id ? page.locator(`[id="${id}"]`).innerText() : null;
  };
  expect(await activeLabel()).toBe("Yangi");

  await page.keyboard.press("ArrowDown");
  expect(await activeLabel()).toBe("Yaratilgan");
  await page.keyboard.press("ArrowDown");
  expect(await activeLabel()).toBe("Qabul qilindi");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/[?&]status=received(&|$)/);
  await expect.poll(() => listRequests.at(-1)?.get("status")).toBe("received");
  await expect(listbox.getByRole("option", { name: "Qabul qilindi" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(listbox).toBeVisible();
  await expect(select).toBeFocused();
  expect(leaked).toEqual([]);
});
