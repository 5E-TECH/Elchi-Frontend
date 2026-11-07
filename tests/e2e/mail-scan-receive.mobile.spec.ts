import { test } from "@playwright/test";
import { runMailScanReceive } from "./support/mailScanReceive";

/** Pochta tafsiloti: USB (Bluetooth) skan = darhol qabul (2026-11-07) — 390px, kuryer telefoni. */
test.describe("Pochta tafsiloti — skan = darhol qabul — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ kuryer: o'z pochtasida skan — buyurtma qabul qilinadi va kartasi yo'qoladi; oxirgisidan keyin «Bugungi»", async ({
    page,
  }) => {
    await runMailScanReceive(page, "courier");
  });
});
