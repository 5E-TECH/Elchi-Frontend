import { test } from "@playwright/test";
import { runUserPasswordSmsScenarios } from "./support/userPasswordSms";

/**
 * aidsxJ2H (1440px): yaratishda parolni tizim yaratadi va SMS yuboradi (natija oynasi, holat, qayta yuborish),
 * «Qo'lda kiritish»; birinchi kirishda bloklovchi «Yangi parol o'rnating» (`old_password`, 400 chiqarmaydi).
 */
test.describe("Foydalanuvchi paroli — SMS va birinchi kirish (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });
  runUserPasswordSmsScenarios("1440");
});
