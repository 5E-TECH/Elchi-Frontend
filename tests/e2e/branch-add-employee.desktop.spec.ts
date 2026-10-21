import { expect, test } from "@playwright/test";
import {
  BRANCH,
  isSameDocument,
  markDocument,
  mockBranchAddEmployeeApi,
  openAddEmployee,
  spaNavigate,
} from "./support/branchAddEmployee";
import { expectToast } from "./support/toast";

/**
 * SZTZ4HEU «e638c6» — 1440px: kuryer yaratiladi, keyin filial «Xodim qo'shish» oynasi uni DARHOL ko'rsatadi
 * (avval `queryKeys.users` keshi 30 s yangi hisoblanib, oyna eski ro'yxatni berardi). Sahifa qayta yuklanmaydi.
 */
test.describe("Filial «Xodim qo'shish» — yangi xodim darhol — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("kuryer yaratilgach oyna ro'yxatida u bor (reload yo'q)", async ({ page }) => {
    const mock = await mockBranchAddEmployeeApi(page);
    await page.goto(`/branches/${BRANCH.id}`);
    await expect(page.getByRole("heading", { level: 1, name: BRANCH.name })).toBeVisible({ timeout: 60_000 });
    await markDocument(page);

    // 1) Oyna avval ochilgan — ro'yxat keshda (hali «yangi»).
    let dialog = await openAddEmployee(page);
    await expect(dialog.getByRole("option", { name: /Sardor Karimov/ })).toBeVisible();
    await expect(dialog.getByRole("option", { name: /Lola Kuryerova/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 2) Yangi kuryer (ilova ichida o'tib).
    await spaNavigate(page, "/all-users/create-user?role=courier");
    const form = page.getByRole("form", { name: /Kuryer/ });
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.locator('input[name="fullName"]').fill("Lola Kuryerova");
    await form.locator('input[name="phone"]').fill("901112233");
    await form.locator('input[name="password"]').fill("lola2026");
    await form.locator('input[name="homeRate"]').fill("25000");
    await form.locator('input[name="centerRate"]').fill("15000");
    await form.getByRole("button", { name: "Saqlash" }).click();
    await expectToast(page, /Kuryer/, { tone: "success" });
    expect(mock.creates).toHaveLength(1);

    // 3) Forma `navigate(-1)` — filial sahifasiga qaytadi; oyna yangi kuryerni ko'rsatadi. Soat to'xtatilgan — kesh
    //    o'z-o'zidan eskirmaydi, qayta GET faqat POST dan keyingi invalidatsiyadan.
    await expect(page).toHaveURL(new RegExp(`/branches/${BRANCH.id}$`));
    const getsAfterPost = mock.usersGets();
    dialog = await openAddEmployee(page);
    await expect.poll(() => mock.usersGets()).toBeGreaterThan(getsAfterPost);
    await expect(dialog.getByRole("option", { name: /Lola Kuryerova/ })).toBeVisible();
    await expect(dialog.getByRole("option", { name: /Sardor Karimov/ })).toBeVisible();
    expect(await isSameDocument(page)).toBe(true);
    expect(mock.leaked).toEqual([]);
  });
});
