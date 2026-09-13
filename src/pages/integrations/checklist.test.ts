import { describe, expect, it } from "vitest";
import { buildChecks } from "./panels/ConnectionOverview";
import type { Connection } from "./useConnections";

/**
 * `raw` — asl backend yozuvi (`Partner` yoki `Integration`). Testda faqat
 * bir-ikki maydon kerak, shuning uchun `Record` qabul qilib ichida
 * kastlaymiz: to'liq yozuvni yasash o'nlab keraksiz maydon yozishni
 * talab qilardi.
 */
const conn = (
  over: Omit<Partial<Connection>, "raw"> & { raw?: Record<string, unknown> } = {},
): Connection =>
  ({
    uid: "partner:1",
    kind: "partner",
    id: "1",
    name: "Beepost",
    role: "source",
    category: "marketplace",
    is_active: true,
    subtitle: "",
    ...over,
    raw: (over.raw ?? {}) as Connection["raw"],
  }) as Connection;

/**
 * TAYYORLIK CHECKLISTI — har kamchilik tuzatiladigan joyni KO'RSATISHI shart.
 *
 * Foydalanuvchi shikoyati aynan shu edi: "beepostda webhook yo'q deb
 * ko'rsatilayapti lekin uni qayerdan qo'shish kerak, qayerdan kamchiliklarni
 * tuzatish nomalumligicha qolayapti".
 *
 * Muammoni ko'rsatib yechimga yo'l ko'rsatmaslik operatorni ekranlar bo'ylab
 * qidirishga majbur qiladi — shuning uchun bu qoida testda qulflangan.
 */
describe("checklist — har kamchilik tuzatish manziliga ega", () => {
  const cases: Array<[string, Connection]> = [
    ["hamkor (bo'sh)", conn({ kind: "partner", raw: {} })],
    ["hamkor (o'chiq)", conn({ kind: "partner", is_active: false, raw: {} })],
    [
      "integratsiya (bo'sh)",
      conn({ kind: "integration", role: "carrier", category: "cargo", raw: {} }),
    ],
  ];

  it.each(cases)("⭐ %s — bloklovchi kamchilikda `fixTab` bor", (_label, c) => {
    const blocking = buildChecks(c).filter((x) => !x.ok && !x.optional);
    expect(blocking.length).toBeGreaterThan(0);
    for (const check of blocking) {
      expect(check.fixTab, `${check.label} uchun fixTab yo'q`).toBeTruthy();
      expect(check.fixHint, `${check.label} uchun fixHint yo'q`).toBeTruthy();
    }
  });

  it("`fixTab` faqat mavjud tablarga ishora qiladi", () => {
    // Noto'g'ri kalit bo'lsa bosish HECH NARSA qilmasdi — jim buzilish.
    const valid = new Set([
      "overview",
      "settings",
      "shipments",
      "log",
      "settlement",
      "control",
      "security",
    ]);
    for (const [, c] of cases) {
      for (const check of buildChecks(c)) {
        if (check.fixTab) expect(valid.has(check.fixTab)).toBe(true);
      }
    }
  });

  it("⭐ webhook manzili yo'q bo'lsa Sozlamalarga yo'naltiradi", () => {
    const checks = buildChecks(conn({ kind: "partner", raw: {} }));
    const webhook = checks.find((c) => c.label === 'Webhook manzili');
    expect(webhook?.ok).toBe(false);
    expect(webhook?.fixTab).toBe('settings');
    expect(webhook?.fixHint).toContain('Webhook');
  });

  it("hammasi sozlangan bo'lsa bloklovchi kamchilik yo'q", () => {
    const checks = buildChecks(
      conn({ kind: "partner", raw: { webhook_url: "https://a.uz/h" } }),
    );
    expect(checks.filter((c) => !c.ok && !c.optional)).toEqual([]);
  });
});
