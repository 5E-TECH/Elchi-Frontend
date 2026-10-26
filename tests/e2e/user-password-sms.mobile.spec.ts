import { test } from "@playwright/test";
import { runUserPasswordSmsScenarios } from "./support/userPasswordSms";

/** aidsxJ2H (390px): o'sha oqimlar telefonda — oynalar pastki varaqa, gorizontal skroll yo'q. */
test.describe("Foydalanuvchi paroli — SMS va birinchi kirish (390px)", () => {
  test.describe.configure({ timeout: 120_000 });
  runUserPasswordSmsScenarios("390", { mobile: true });
});
