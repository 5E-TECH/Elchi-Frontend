import { describe, expect, it } from "vitest";
import { isConfigured } from "./useConnections";

/**
 * IKKI RO'YXATNI BITTA RO'YXATGA QO'SHISH.
 *
 * Elchi'da tashqi tizim ikki jadvalda: `partners` (bizga ulanadiganlar) va
 * `external_integrations` (biz ulanadiganlar). Foydalanuvchi uchun ikkisi ham
 * bitta ish — "tashqi tizim bilan ulanishni sozlash".
 */
describe("isConfigured — yagona qoida", () => {
  const partner = (over: Record<string, unknown> = {}) =>
    ({
      uid: "partner:1",
      kind: "partner" as const,
      id: "1",
      name: "Beepost",
      role: "source" as const,
      category: "marketplace" as const,
      is_active: true,
      subtitle: "",
      raw: over,
    }) as never;

  const integrationRole = (
    role: string,
    over: Record<string, unknown> = {},
  ) =>
    ({
      uid: "integration:1",
      kind: "integration" as const,
      id: "1",
      name: "X",
      role,
      category: "cargo" as const,
      is_active: true,
      subtitle: "",
      raw: over,
    }) as never;

  it("inbound: webhook manzili bo'lsa sozlangan", () => {
    expect(isConfigured(partner({ webhook_url: "https://a.uz/h" }))).toBe(true);
    expect(isConfigured(partner({}))).toBe(false);
  });

  it("⭐ outbound: eski yozuvdagi `api_url` ham hisobga olinadi", () => {
    /**
     * Maydon `base_url` ga ko'chirilgan, lekin eski yozuvlarda `api_url`
     * turadi. Faqat `base_url` ga qarasak, ishlab turgan ulanishlar
     * "sozlanmagan" bo'lib ko'rinardi.
     *
     * `mirror` roli tanlandi, chunki unda qo'shimcha shart yo'q.
     */
    expect(
      isConfigured(integrationRole("mirror", { base_url: "https://a.uz" })),
    ).toBe(true);
    expect(
      isConfigured(integrationRole("mirror", { api_url: "https://a.uz" })),
    ).toBe(true);
    expect(isConfigured(integrationRole("mirror", {}))).toBe(false);
  });

  describe("⭐ rolga xos shartlar (audit M2)", () => {
    /**
     * Ilgari FAQAT `base_url` tekshirilardi va kargo YASHIL ko'rinardi —
     * aslida esa ishlamasdi. Yashil nuqta "ishlaydi" degan ma'noni beradi;
     * ishlamaydigan ulanishni yashil ko'rsatish eng yomon holat, chunki
     * operator muammoni posilka jo'natilmaganda biladi.
     */
    const url = { base_url: "https://a.uz" };

    it("KARGO: dispatch endpointi VA webhook sekreti kerak", () => {
      expect(isConfigured(integrationRole("carrier", url))).toBe(false);
      expect(
        isConfigured(
          integrationRole("carrier", {
            ...url,
            dispatch_config: { endpoint: "/v1" },
          }),
        ),
      ).toBe(false);
      expect(
        isConfigured(
          integrationRole("carrier", {
            ...url,
            dispatch_config: { endpoint: "/v1" },
            has_webhook_secret: true,
          }),
        ),
      ).toBe(true);
    });

    it("TO'LOV: imzo sekreti kerak", () => {
      expect(isConfigured(integrationRole("payment", url))).toBe(false);
      expect(
        isConfigured(
          integrationRole("payment", { ...url, has_webhook_secret: true }),
        ),
      ).toBe(true);
    });

    it("MANBA: market bog'lanishi kerak (importsiz 400 beradi)", () => {
      expect(isConfigured(integrationRole("source", url))).toBe(false);
      expect(
        isConfigured(integrationRole("source", { ...url, market_id: "500" })),
      ).toBe(true);
    });

    it("KO'ZGU: manzil yetarli", () => {
      expect(isConfigured(integrationRole("mirror", url))).toBe(true);
    });
  });
});
