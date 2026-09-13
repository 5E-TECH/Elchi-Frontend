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

  const integration = (over: Record<string, unknown> = {}) =>
    ({
      uid: "integration:1",
      kind: "integration" as const,
      id: "1",
      name: "LDG",
      role: "carrier" as const,
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
     */
    expect(isConfigured(integration({ base_url: "https://a.uz" }))).toBe(true);
    expect(isConfigured(integration({ api_url: "https://a.uz" }))).toBe(true);
    expect(isConfigured(integration({}))).toBe(false);
  });
});
