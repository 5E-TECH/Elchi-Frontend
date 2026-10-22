import { expect, test } from "@playwright/test";
import { describedText, mockLoginApi, openLogin } from "./support/loginA11y";

/**
 * XsoWhKP5 «2368f6» — /login: forma xatolari ekran o'quvchiga yetadi (390px, telefon).
 * Bo'sh yuborish → fokus birinchi xato maydonda (telefon), xatosi `aria-describedby` orqali o'qiladi; parol ham
 * `aria-invalid`; server xatosi — bitta `role=alert` (xom backend matni emas).
 */
test.describe("/login a11y — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("bo'sh forma: fokus telefon maydonida, xatolar aria-describedby orqali; server xatosi role=alert", async ({ page }) => {
    const { logins } = await mockLoginApi(page);
    await openLogin(page);

    await page.getByRole("button", { name: "Kirish" }).click();
    const phone = page.locator('input[name="elchi-login-phone"]');
    const password = page.locator('input[name="password"]');
    await expect(phone).toBeFocused();
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-invalid", "true");
    expect(await describedText(page, 'input[name="elchi-login-phone"]')).toBe("Telefon raqam shart | Raqam +998 bilan boshlanadi");
    expect(await describedText(page, 'input[name="password"]')).toBe("Parol shart");
    await expect(phone).toHaveAccessibleDescription(/Telefon raqam shart/);
    await expect(password).toHaveAccessibleDescription("Parol shart");
    // Ilova darajasidagi bo'sh e'lon hududi (toast) hisobga olinmaydi — faqat forma ichidagi alert.
    const form = page.getByRole("form", { name: "Tizimga kirish" });
    await expect(form.getByRole("alert")).toHaveCount(0);
    expect(logins).toEqual([]);

    // To'g'ri telefon, parol yo'q → fokus parolga.
    await phone.fill("901234567");
    await page.getByRole("button", { name: "Kirish" }).click();
    await expect(password).toBeFocused();
    await expect(phone).not.toHaveAttribute("aria-invalid", "true");

    await password.fill("noto'g'ri");
    await page.getByRole("button", { name: "Kirish" }).click();
    const alert = form.getByRole("alert");
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText("Parol noto'g'ri yoki foydalanuvchi topilmadi");
    await expect(page.getByText("Invalid credentials RAW")).toHaveCount(0);
    await expect(form).toHaveAttribute("aria-describedby", (await alert.getAttribute("id"))!);
    expect(logins).toEqual([{ phone_number: "+998901234567", password: "noto'g'ri" }]);
  });
});
