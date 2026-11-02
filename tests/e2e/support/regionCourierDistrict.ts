import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/** YD7xyjX9 — viloyat oynasi: kuryerlardan biri tumanga biriktirilgan, ikkinchisi yo'q. Soxta backend. */
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
      totalRevenue: 1_200_000,
    },
    {
      id: "343",
      name: "Kuryer Nol",
      phoneNumber: "+998907778899",
      districtId: null,
      totalOrders: 4,
      deliveredOrders: 3,
      totalRevenue: 600_000,
    },
  ],
};

export const openRegionCouriers = async (page: Page) => {
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
  const couriers = page.getByRole("dialog").getByRole("list", { name: "Viloyat kuryerlari" });
  await expect(couriers).toBeVisible({ timeout: 30_000 });
  return { couriers, leaked };
};
