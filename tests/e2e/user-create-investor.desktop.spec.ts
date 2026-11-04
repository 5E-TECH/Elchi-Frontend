import { test } from "@playwright/test";
import { runCreateInvestorScenarios } from "./support/userCreateInvestor";

/** «Foydalanuvchi qo'shish» → Investor (BeePost naqshi): login, investor yozuvi, boshlang'ich kapital. */
test.describe("Foydalanuvchi qo'shish — Investor (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });
  runCreateInvestorScenarios("1440");
});
