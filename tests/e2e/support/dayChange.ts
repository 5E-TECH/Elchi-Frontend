import { expect, type Page } from "@playwright/test";
import { CLOSED_AT_10, OPEN_UNLIMITED, mockOrderIntakeApi, openNewOrders } from "./orderIntake";

/**
 * Kun almashish soati (Trello #756) — «Bugungi qabul vaqti» oynasining ikkinchi qadami (superadmin): qator →
 * «O'zgartirish» → soat → «Saqlash» → asosiy qadamda yangi soat. Har kenglikda: toshish yo'q; telefonda tugmalar
 * ≥ 44 px va oyna pastki varaqa.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png` });
};
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);

export const runDayChange = async (
  page: Page,
  {
    label,
    theme,
    phone,
    withCutoff = false,
  }: { label: string; theme: "light" | "dark"; phone: boolean; withCutoff?: boolean },
) => {
  const { leaked, patches } = await mockOrderIntakeApi(page, {
    role: "superadmin",
    theme,
    intake: withCutoff
      ? { ...CLOSED_AT_10, is_open: true, closes_at: "2099-11-08T05:00:00.000Z" }
      : OPEN_UNLIMITED,
  });
  await openNewOrders(page);
  await page.getByTestId("order-intake-control").click();
  const dialog = page.getByRole("dialog", { name: "Bugungi qabul vaqti" });
  await expect(dialog.getByTestId("day-change-row")).toHaveText(
    /Kun almashish soati: 00:00 \(Toshkent\)/,
  );
  const change = dialog.getByRole("button", { name: "Kun almashish soatini o'zgartirish" });
  if (phone)
    expect((await change.boundingBox())!.height, "«O'zgartirish» ≥ 44px").toBeGreaterThanOrEqual(
      44,
    );
  await settled(page);
  await noOverflow(page);
  await shot(page, `day-change-row-${label}-${theme}`);

  await change.click();
  const step = page.getByRole("dialog", { name: "Kun almashish soati" });
  await expect(step).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const field = step.getByRole("textbox", { name: /Kun almashish soati/ });
  await expect(field).toBeFocused();
  if (withCutoff) {
    await expect(step.getByRole("note")).toHaveText(
      "Soat o'zgarsa, bugungi qabul vaqti yangi kunga o'tmasligi mumkin.",
    );
  }
  await field.fill("1800");
  await expect(field).toHaveValue("18:00");
  await settled(page);
  await noOverflow(page);
  if (phone) {
    const sheet = (await step.boundingBox())!;
    expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(844 - 1);
    for (const name of ["Orqaga", "Saqlash"]) {
      const button = (await step.getByRole("button", { name }).boundingBox())!;
      expect(button.height, `${name}: ≥ 44px`).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width, name).toBeLessThanOrEqual(390);
    }
  }
  await shot(page, `day-change-step-${label}-${theme}${withCutoff ? "-cutoff" : ""}`);

  await step.getByRole("button", { name: "Saqlash" }).click();
  await expect(
    page.getByRole("dialog", { name: "Bugungi qabul vaqti" }).getByTestId("day-change-row"),
  ).toHaveText(/Kun almashish soati: 18:00 \(Toshkent\)/);
  expect(patches).toEqual([{ day_change_time: "18:00" }]);
  expect(leaked).toEqual([]);
};
