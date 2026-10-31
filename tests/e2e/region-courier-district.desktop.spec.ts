import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * YD7xyjX9 — viloyat oynasi: kuryer o'z tumani bilan ko'rinadi (`couriers[].districtId` → `districts[].name`), tumani
 * yo'q kuryerda — avvalgidek telefon. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

const REGIONS = JSON.parse(
  readFileSync(resolve("tests/visual/fixtures/regions/stats-all.json"), "utf8"),
).data;

const DETAIL = {
  id: "1",
  name: "Jizzax viloyati",
  summary: {
    totalOrders: 12,
    totalDelivered: 9,
    totalCancelled: 1,
    pendingOrders: 2,
    totalRevenue: 1_800_000,
  },
  districts: [
    { id: "101", name: "Arnasoy tumani", totalOrders: 8, deliveredOrders: 6, activeCouriers: 1 },
    { id: "102", name: "Baxmal tumani", totalOrders: 4, deliveredOrders: 3, activeCouriers: 0 },
  ],
  couriers: [
    {
      id: "108",
      name: "Kuryer A",
      phoneNumber: "+998901112233",
      districtId: "101",
      totalOrders: 8,
      deliveredOrders: 6,
    },
    {
      id: "343",
      name: "Kuryer Nol",
      phoneNumber: "+998907778899",
      districtId: null,
      totalOrders: 4,
      deliveredOrders: 3,
    },
  ],
};

test("⭐ kuryer qatorida tuman nomi", async ({ page }) => {
  const stats = Object.fromEntries(
    REGIONS.regions.map((region: { id: string | number }) => [`region/stats/${region.id}`, DETAIL]),
  );
  const { leaked } = await setupShellSession(page, "superadmin", "Bosh admin", {
    "region/stats/all": REGIONS,
    ...stats,
  });
  await page.goto("/regions");
  await page.getByRole("radio", { name: "Jadval" }).first().click({ timeout: 90_000 });
  await page.getByRole("button", { name: "Toshkent shahri", exact: true }).click();

  const dialog = page.getByRole("dialog");
  const couriers = dialog.getByRole("list", { name: "Viloyat kuryerlari" });
  await expect(couriers).toBeVisible({ timeout: 30_000 });
  await expect(couriers.getByRole("listitem").filter({ hasText: "Kuryer A" })).toContainText(
    "Arnasoy tumani · +998",
  );
  const noDistrict = couriers.getByRole("listitem").filter({ hasText: "Kuryer Nol" });
  await expect(noDistrict).toContainText("+998");
  await expect(noDistrict).not.toContainText("tumani");
  expect(leaked).toEqual([]);
});
