import { test } from "@playwright/test";
import { runAuthPolicyScenarios } from "./support/authPolicy";

/** NDmZMzCP (390px): login qulfi va «Yangi parol o'rnating» — telefonda oyna pastki varaqa. */
test.describe("Auth xavfsizligi — parol siyosati va login qulfi (390px)", () => {
  test.describe.configure({ timeout: 120_000 });
  runAuthPolicyScenarios();
});
