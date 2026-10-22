import { expect, test } from "@playwright/test";
import { openProfileWithSessions } from "./support/profileSessions";

/**
 * EP-3 (Elchi Pochta #3) — /profile «Sessiyalar» (desktop): FAQAT o'z hisobining faol sessiyalari — soni, qurilma,
 * IP, «Kirgan vaqti», «Oxirgi faollik»; «Shu qurilma» tepada; nomsiz qurilma — «Noma'lum qurilma». Yozish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ sessiyalar soni, qurilmalar va vaqtlar; «Shu qurilma» tepada", async ({ page }) => {
  const { leaked, state } = await openProfileWithSessions(page, "superadmin");

  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("3 ta faol")).toBeVisible();

  const rows = card.getByRole("list", { name: "Faol sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole("heading", { level: 3 })).toHaveText("Telefon · Android · Chrome");
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();
  await expect(rows.nth(0).getByText("IP: 213.230.64.10")).toBeVisible();
  await expect(rows.nth(0).getByText("Oxirgi faollik")).toBeVisible();
  await expect(rows.nth(0).getByText("42 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByRole("heading", { level: 3 })).toHaveText("Kompyuter · Windows · Edge");
  await expect(rows.nth(1).getByText("7 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByText("Shu qurilma")).toHaveCount(0);
  await expect(rows.nth(2).getByRole("heading", { level: 3 })).toHaveText("Noma'lum qurilma");
  await expect(rows.nth(2).getByText("IP noma'lum")).toBeVisible();
  await expect(rows.nth(2).getByText("3 kun oldin")).toBeVisible();

  // Desktopda qurilma va vaqtlar bir qatorda (vaqtlar o'ngda).
  const deviceBox = await rows.nth(0).getByRole("heading", { level: 3 }).boundingBox();
  const timeBox = await rows.nth(0).getByText("Kirgan vaqti").boundingBox();
  expect(Math.abs((deviceBox?.y ?? 0) - (timeBox?.y ?? 999))).toBeLessThan(24);
  expect(timeBox?.x ?? 0).toBeGreaterThan((deviceBox?.x ?? 0) + 300);

  expect(state.sessionRequests).toBeGreaterThanOrEqual(1);
  expect(leaked).toEqual([]);
});
