import { test } from "@playwright/test";
import { runCreateInvestorScenarios } from "./support/userCreateInvestor";

/** O'sha oqim telefonda (390px) — gorizontal skroll yo'q. */
test.describe("Foydalanuvchi qo'shish — Investor (390px)", () => {
  test.describe.configure({ timeout: 180_000 });
  runCreateInvestorScenarios("390", { mobile: true });
});
