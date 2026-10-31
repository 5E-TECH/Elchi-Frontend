import { expect, test } from "@playwright/test";
import { openRegionCouriers } from "./support/regionCourierDistrict";

/**
 * YD7xyjX9 — viloyat oynasi: kuryer o'z tumani bilan ko'rinadi (`couriers[].districtId` → `districts[].name`), tumani
 * yo'q kuryerda — avvalgidek telefon. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ kuryer qatorida tuman nomi", async ({ page }) => {
  const { couriers, leaked } = await openRegionCouriers(page);
  await expect(couriers.getByRole("listitem").filter({ hasText: "Kuryer A" })).toContainText(
    "Arnasoy tumani",
  );
  const noDistrict = couriers.getByRole("listitem").filter({ hasText: "Kuryer Nol" });
  await expect(noDistrict).toContainText("+998");
  await expect(noDistrict).not.toContainText("tumani");
  expect(leaked).toEqual([]);
});
