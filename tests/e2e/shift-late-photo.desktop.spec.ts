import { expect, test } from "@playwright/test";
import { mockShiftLatePhoto, SCREENSHOT_PNG } from "./support/shiftLatePhoto";

/**
 * BE-B (1440): avtomatik yopilgan ASOSIY kassa smenasi hisobotida karta rasmi holati («Yuklangan», «Rasm kutilmoqda» +
 * muddat, «Talab qilinmagan»), superadmin «Rasm yuklash» → oyna (skrinshot brauzerda JPEG ga keltiriladi, qoldiq, farqda
 * majburiy izoh) → multipart `photo` / `entered_balance` / `comment` → «Rasm yuklandi», qatorda «Keyin yuklandi»;
 * 409 `SHIFT_LATE_PHOTO_EXPIRED` — backend matni oynada, hisobot qayta o'qilib tugmalar yo'qoladi; menejer — tugmasiz.
 */
test("superadmin: avto-yopilgan smenaga kartaning rasmi keyin yuklanadi", async ({ page }) => {
  const mock = await mockShiftLatePhoto(page);
  await page.goto("/payments/shifts/31");
  // Birinchi ochilishda dev server sahifa bo'lagini yig'adi — kutish uzunroq.
  await expect(page.getByRole("table", { name: "Kartalar bo'yicha natijalar" })).toBeVisible({ timeout: 30_000 });

  const humo = page.getByTestId("shift-photo-status-2");
  await expect(humo).toContainText("Rasm kutilmoqda");
  await expect(humo).toContainText(/\d{2}:\d{2} gacha/);
  await expect(page.getByTestId("shift-photo-status-1")).toContainText("Yuklangan");
  await expect(page.getByTestId("shift-photo-status-4")).toContainText("Talab qilinmagan");

  await humo.getByRole("button", { name: "Rasm yuklash: Humo virtual" }).click();
  const dialog = page.getByRole("dialog", { name: "Rasmni keyin yuklash" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Humo virtual · Hamkorbank · ··4417");
  await expect(dialog.getByRole("button", { name: "Yuklash" })).toBeDisabled();

  await dialog.getByTestId("late-photo-input").setInputFiles({ name: "IMG_2211.png", mimeType: "image/png", buffer: SCREENSHOT_PNG });
  await expect(dialog.getByRole("img", { name: "Humo virtual skrinshoti" })).toBeVisible();
  await dialog.getByLabel(/^Ilovadagi qoldiq/).fill("1760000");
  await expect(dialog).toContainText("−90 000 so'm");
  // Farq bor — izoh yozilmaguncha «Yuklash» o'chiq, sababi tugmalar yonida (ko'rinib turadi).
  await expect(dialog.getByRole("button", { name: "Yuklash" })).toBeDisabled();
  await expect(dialog.getByTestId("late-photo-block-reason")).toHaveText("Farq sababini izohga yozing");
  await expect(dialog.getByTestId("late-photo-block-reason")).toBeInViewport();
  expect(mock.uploads).toEqual([]);

  await dialog.getByLabel(/^Izoh/).fill("Bank komissiyasi");
  await dialog.getByRole("button", { name: "Yuklash" }).click();
  await expect(page.getByText("Rasm yuklandi", { exact: true }).first()).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.uploads).toEqual([
    {
      cardId: "2",
      fields: ["photo", "entered_balance", "comment"],
      values: { entered_balance: "1760000", comment: "Bank komissiyasi" },
      photoType: "image/jpeg",
    },
  ]);
  await expect(humo).toContainText("Yuklangan");
  await expect(humo).toContainText("Keyin yuklandi");
  await expect(humo.getByRole("link", { name: /Ochish/ })).toHaveAttribute("href", "https://files.example/signed/2-late");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});

test("superadmin: muddat o'tgan (409) — backend matni oynada, hisobot qayta o'qiladi", async ({ page }) => {
  const mock = await mockShiftLatePhoto(page);
  await page.goto("/payments/shifts/31");
  await page.getByRole("button", { name: "Rasm yuklash: Visa virtual" }).click({ timeout: 30_000 });
  const dialog = page.getByRole("dialog", { name: "Rasmni keyin yuklash" });
  await dialog.getByTestId("late-photo-input").setInputFiles({ name: "IMG_2214.png", mimeType: "image/png", buffer: SCREENSHOT_PNG });
  await expect(dialog.getByRole("img", { name: "Visa virtual skrinshoti" })).toBeVisible();
  await dialog.getByLabel(/^Ilovadagi qoldiq/).fill("935000");
  mock.nextError = {
    status: 409,
    body: {
      code: "SHIFT_LATE_PHOTO_EXPIRED",
      message: "Rasmni keyin yuklash muddati tugagan (smena yopilganidan 24 soat o'tdi)",
      deadline: new Date(Date.now() - 60_000).toISOString(),
    },
  };
  const reads = mock.reportReads;
  await dialog.getByRole("button", { name: "Yuklash" }).click();

  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("Rasmni keyin yuklash muddati tugagan (smena yopilganidan 24 soat o'tdi)");
  await expect(alert).toContainText(/Muddat: /);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Yuklash" })).toBeDisabled();
  // Qayta urinish foydasiz — maydonlar ham o'chiq, faqat «Bekor qilish».
  await expect(dialog.getByLabel(/^Ilovadagi qoldiq/)).toBeDisabled();
  await expect(dialog.getByLabel(/^Izoh/)).toBeDisabled();
  await expect.poll(() => mock.reportReads).toBeGreaterThan(reads);
  await expect(page.getByRole("button", { name: /^(Rasm yuklash|Qayta yuklash):/ })).toHaveCount(0);
  expect(mock.uploads).toHaveLength(1);

  await dialog.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(dialog).toBeHidden();
  expect(mock.leaked).toEqual([]);
});

test("menejer: holat va muddat ko'rinadi, «Rasm yuklash» yo'q", async ({ page }) => {
  const mock = await mockShiftLatePhoto(page, "manager");
  await page.goto("/payments/shifts/31");
  const humo = page.getByTestId("shift-photo-status-2");
  await expect(humo).toContainText("Rasm kutilmoqda", { timeout: 30_000 });
  await expect(humo).toContainText(/\d{2}:\d{2} gacha/);
  await expect(page.getByRole("button", { name: /^(Rasm yuklash|Qayta yuklash):/ })).toHaveCount(0);
  expect(mock.leaked).toEqual([]);
});

test("planshet (768) va sidebar'li 1024: rasm ustuni kengaysa ham «Farq» ko'rinadi", async ({ page }) => {
  const mock = await mockShiftLatePhoto(page);
  mock.accounts[0] = { ...mock.accounts[0], late_uploaded: true };
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/payments/shifts/31");
    const table = page.getByRole("table", { name: "Kartalar bo'yicha natijalar" });
    await expect(table).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Qayta yuklash: Asosiy karta" })).toBeVisible();
    const fit = await table.evaluate((element) => {
      const wrap = element.parentElement as HTMLElement;
      const box = wrap.getBoundingClientRect();
      const farq = Array.from(element.querySelectorAll("th")).find((th) => th.textContent?.trim() === "Farq");
      return { farqRight: (farq?.getBoundingClientRect().right ?? Infinity) - box.left, width: wrap.clientWidth };
    });
    expect(fit.farqRight, `${width}px`).toBeLessThanOrEqual(fit.width);
  }
  expect(mock.leaked).toEqual([]);
});
