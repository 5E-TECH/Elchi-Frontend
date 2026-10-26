import { test } from "@playwright/test";
import { runAuthPolicyScenarios } from "./support/authPolicy";

/** NDmZMzCP (1440px): login qulfi (429 LOGIN_LOCKED) va «Yangi parol o'rnating» (must_change_password). */
test.describe("Auth xavfsizligi — parol siyosati va login qulfi (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });
  runAuthPolicyScenarios();
});
