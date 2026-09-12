import { describe, expect, it } from "vitest";
import { syncWhen } from "./syncHistory";

/**
 * `sync_date` — Postgres `bigint`. TypeORM uni SATR qilib qaytaradi, lekin
 * ba'zi yo'llarda son bo'lib keladi. Ikki shaklni ham ishlash kerak, aks
 * holda jurnal sanasi "Invalid Date" bo'lib chiqardi.
 */
describe("syncWhen", () => {
  it("son epoch'ni sanaga aylantiradi", () => {
    expect(syncWhen(1_700_000_000_000)).not.toBe("—");
  });

  it("⭐ SATR epoch'ni ham aylantiradi (bigint tuzog'i)", () => {
    expect(syncWhen("1700000000000")).toBe(syncWhen(1_700_000_000_000));
  });

  it("bo'sh, null va yaroqsiz qiymat — \"—\"", () => {
    expect(syncWhen(null)).toBe("—");
    expect(syncWhen(undefined)).toBe("—");
    expect(syncWhen("")).toBe("—");
    expect(syncWhen("salom")).toBe("—");
  });

  it("⭐ 0 ham \"—\" — epoch boshi haqiqiy sana EMAS", () => {
    /**
     * `sync_date = 0` "1970-yil" degani emas, "yozilmagan" degani. Uni
     * 1970 deb ko'rsatish operatorni chalg'itardi.
     */
    expect(syncWhen(0)).toBe("—");
    expect(syncWhen("0")).toBe("—");
  });
});
