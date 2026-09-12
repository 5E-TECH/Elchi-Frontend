import { describe, expect, it } from "vitest";
import { groupByRole, isConfigured, type Connection } from "./useConnections";
import { ROLE_ORDER } from "./connections";

/**
 * IKKI RO'YXATNI BITTA RO'YXATGA QO'SHISH.
 *
 * Elchi'da tashqi tizim ikki jadvalda: `partners` (bizga ulanadiganlar) va
 * `external_integrations` (biz ulanadiganlar). Foydalanuvchi uchun ikkisi ham
 * bitta ish — "tashqi tizim bilan ulanishni sozlash".
 */
const conn = (over: Partial<Connection>): Connection => ({
  uid: "partner:1",
  kind: "partner",
  id: "1",
  name: "Beepost",
  role: "source",
  category: "marketplace",
  is_active: true,
  subtitle: "—",
  raw: {} as never,
  ...over,
});

describe("groupByRole", () => {
  it("TC1: rol bo'yicha guruhlaydi va TARTIBNI saqlaydi", () => {
    const items = [
      conn({ uid: "i:1", role: "carrier" }),
      conn({ uid: "p:1", role: "source" }),
      conn({ uid: "i:2", role: "payment" }),
    ];

    const groups = groupByRole(items, ROLE_ORDER);

    // `ROLE_ORDER` = source, carrier, payment, mirror
    expect(groups.map((g) => g.role)).toEqual(["source", "carrier", "payment"]);
  });

  it("TC2: BO'SH guruh ko'rsatilmaydi", () => {
    // Aks holda ro'yxatda "To'lov tizimlari" sarlavhasi ostida hech narsa
    // bo'lmagan bo'sh joy turardi.
    const groups = groupByRole([conn({ role: "source" })], ROLE_ORDER);

    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe("source");
  });

  it("TC3: bitta rolda bir nechta ulanish birga turadi", () => {
    const items = [
      conn({ uid: "p:1", role: "source", name: "Uzum" }),
      conn({ uid: "p:2", role: "source", name: "Olcha" }),
    ];

    const groups = groupByRole(items, ROLE_ORDER);

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.name)).toEqual(["Uzum", "Olcha"]);
  });

  it("TC4: ⭐ `uid` ikki jadvaldagi bir xil id'ni AJRATADI", () => {
    /**
     * `partners.id = 1` va `external_integrations.id = 1` bir vaqtda
     * bo'lishi mumkin — id'lar mustaqil ketadi. Faqat `id` bo'yicha
     * tanlasak, bir bosishda IKKI ulanish belgilanib qolardi.
     */
    const a = conn({ uid: "partner:1", kind: "partner", id: "1" });
    const b = conn({
      uid: "integration:1",
      kind: "integration",
      id: "1",
      role: "carrier",
    });

    expect(a.uid).not.toBe(b.uid);
    const groups = groupByRole([a, b], ROLE_ORDER);
    const all = groups.flatMap((g) => g.items.map((i) => i.uid));
    expect(new Set(all).size).toBe(2);
  });

  it("TC5: ro'yxatda yo'q rol tushib qolmaydi (ROLE_ORDER to'liq)", () => {
    const items = ROLE_ORDER.map((role, idx) =>
      conn({ uid: `x:${idx}`, role }),
    );

    const groups = groupByRole(items, ROLE_ORDER);

    expect(groups).toHaveLength(ROLE_ORDER.length);
  });
});

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
