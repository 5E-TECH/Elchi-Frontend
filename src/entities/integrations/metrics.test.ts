import { describe, expect, it } from "vitest";
import {
  connectionHealth,
  fmtMetric,
  metricsByUid,
  normalizeIntegrationMetrics,
  type ConnectionMetrics,
  type IntegrationMetrics,
} from "./metrics";

const m = (over: Partial<ConnectionMetrics> = {}): ConnectionMetrics => ({
  uid: "partner:7",
  kind: "partner",
  id: "7",
  events: 0,
  delivered: 0,
  failed: 0,
  queued: 0,
  success_rate: null,
  avg_ms: null,
  last_event_at: null,
  ...over,
});

/**
 * ULANISH HOLATI.
 *
 * Holat nuqtasi UCH joyda ko'rsatiladi (jadval, chap ro'yxat, detal
 * sarlavhasi) va ular AYNI qoidaga tayanishi kerak. Har joyda qaytadan
 * yozilsa, bir ekranda yashil, boshqasida sariq ko'rinardi — bu eng
 * chalkashtiruvchi nuqson bo'lardi.
 */
describe("connectionHealth", () => {
  it("TC1: hammasi joyida -> ok", () => {
    expect(connectionHealth({ isActive: true, configured: true, metrics: m() })).toBe("ok");
  });

  it("TC2: ⭐ o'chirilgan -> `off`, XATO emas", () => {
    // O'chirish — ataylab qilingan amal. Uni qizil ko'rsatish "muammo bor"
    // degan yolg'on signal bo'lardi.
    expect(
      connectionHealth({
        isActive: false,
        configured: true,
        metrics: m({ failed: 9 }),
      }),
    ).toBe("off");
  });

  it("TC3: sozlanmagan -> attention", () => {
    // Hodisalar hech qayerga ketmaydi, shuning uchun e'tibor kerak.
    expect(connectionHealth({ isActive: true, configured: false, metrics: m() })).toBe("attention");
  });

  it("TC4: ⭐ sozlama to'g'ri, lekin YETMAGAN hodisa bor -> attention", () => {
    /**
     * Aynan shu holat uchun metrika kerak bo'lgan: checklist yashil
     * bo'lib turadi-yu, hodisalar yetmayapti (hamkor 500 qaytaradi,
     * sekret almashtirilgan). Busiz muammo ko'rinmasdi.
     */
    expect(
      connectionHealth({
        isActive: true,
        configured: true,
        metrics: m({ events: 100, delivered: 97, failed: 3 }),
      }),
    ).toBe("attention");
  });

  it("TC5: metrika hali yo'q -> ok (xato deb ko'rsatilmaydi)", () => {
    // Yangi ulangan ulanishda hodisa bo'lmagan bo'lishi tabiiy.
    expect(connectionHealth({ isActive: true, configured: true, metrics: undefined })).toBe("ok");
  });

  it("TC6: o'chirilgan ustuvor — sozlanmagan bo'lsa ham `off`", () => {
    expect(connectionHealth({ isActive: false, configured: false })).toBe("off");
  });
});

describe("metricsByUid", () => {
  it("TC7: uid bo'yicha xarita yasaydi", () => {
    const data: IntegrationMetrics = {
      window_hours: 24,
      totals: { events: 5, failed: 1, queued: 0 },
      connections: [m({ uid: "partner:7" }), m({ uid: "integration:12" })],
    };

    const map = metricsByUid(data);

    expect(map.size).toBe(2);
    expect(map.get("partner:7")?.uid).toBe("partner:7");
    // `partners.id = 1` va `external_integrations.id = 1` bir vaqtda bo'lishi
    // mumkin — shuning uchun kalit `kind:id`, faqat `id` emas.
    expect(map.get("integration:12")).toBeDefined();
  });

  it("TC8: ma'lumot yo'q -> bo'sh xarita (xato emas)", () => {
    expect(metricsByUid(undefined).size).toBe(0);
  });
});

describe("fmtMetric", () => {
  /**
   * Bu funksiyaning butun mavjudlik sababi: `null` ni `0` deb ko'rsatmaslik.
   * `0 ms` "bir zumda javob berdi", `0%` esa "hammasi yiqildi" degan yolg'on.
   */
  it('null va undefined — "—"', () => {
    expect(fmtMetric(null)).toBe("—");
    expect(fmtMetric(undefined)).toBe("—");
    expect(fmtMetric(null, " ms")).toBe("—");
  });

  it('0 — haqiqiy o\'lchov, "—" EMAS', () => {
    // Nol hodisa ham o'lchov: "hodisa bo'lmadi" deb aytish kerak.
    expect(fmtMetric(0)).toBe("0");
    expect(fmtMetric(0, "%")).toBe("0%");
  });

  it("qiymatga qo'shimcha belgi qo'shiladi", () => {
    expect(fmtMetric(98.5, "%")).toBe("98.5%");
    expect(fmtMetric(184, " ms")).toBe("184 ms");
  });
});

/**
 * KENGAYTIRILGAN METRIKA — posilka / webhook / COD bloklari.
 *
 * Eng xavfli nuqson — o'lchanmagan qiymatni `0` qilib ko'rsatish: "qarz 0",
 * "0 ta yiqilgan" — operatorni "hammasi joyida" deb aldardi. Shu bois
 * normalizator yo'q / buzuq qiymatni `null` qoldiradi.
 */
describe("normalizeIntegrationMetrics", () => {
  const envelope = (connection: Record<string, unknown>) => ({
    statusCode: 200,
    data: { window_hours: 24, totals: { events: 1, failed: 0, queued: 0 }, connections: [{ ...m(), ...connection }] },
  });

  it("ESKI backend (bloklarsiz) — bloklar `null`, mavjud maydonlar o'zgarmaydi", () => {
    const res = normalizeIntegrationMetrics(envelope({ events: 5, delivered: 4 }));
    const [c] = res.connections;
    expect(c.events).toBe(5);
    expect(c.delivered).toBe(4);
    expect(c.shipments).toBeNull();
    expect(c.webhooks).toBeNull();
    expect(c.cod).toBeNull();
    expect(res.window_hours).toBe(24);
  });

  it("raqamlar o'qiladi; Postgres `numeric` satrlari songa aylanadi", () => {
    const [c] = normalizeIntegrationMetrics(
      envelope({
        shipments: { total: 12, delivered: 9, failed: 2, mismatch: 1 },
        webhooks: { success: 30, failed: "1", invalid_signature: 0 },
        cod: { dispatched: "15000000.00", collected: "9000000", remitted: 4000000, debt: "5000000.00" },
      }),
    ).connections;
    expect(c.shipments).toEqual({ total: 12, delivered: 9, failed: 2, mismatch: 1 });
    expect(c.webhooks).toEqual({ success: 30, failed: 1, invalid_signature: 0 });
    expect(c.cod).toEqual({ dispatched: 15_000_000, collected: 9_000_000, remitted: 4_000_000, debt: 5_000_000 });
  });

  it("⭐ yo'q / buzuq qiymat `null` — HECH QACHON 0", () => {
    const [c] = normalizeIntegrationMetrics(
      envelope({
        shipments: { total: 3, delivered: null, failed: "abc" },
        cod: { collected: "", debt: undefined },
      }),
    ).connections;
    expect(c.shipments).toEqual({ total: 3, delivered: null, failed: null, mismatch: null });
    expect(c.cod).toEqual({ dispatched: null, collected: null, remitted: null, debt: null });
  });

  it("⭐ `mismatch: null` (status xaritasi yo'q) saqlanadi — 0 ga aylanmaydi", () => {
    const [c] = normalizeIntegrationMetrics(
      envelope({ shipments: { total: 4, delivered: 4, failed: 0, mismatch: null } }),
    ).connections;
    expect(c.shipments?.mismatch).toBeNull();
  });

  it("blok o'rnida massiv yoki satr kelsa — blok `null`", () => {
    const [c] = normalizeIntegrationMetrics(envelope({ shipments: [1, 2], webhooks: "x" })).connections;
    expect(c.shipments).toBeNull();
    expect(c.webhooks).toBeNull();
  });

  it("javob qobig'i buzuq bo'lsa — bo'sh ro'yxat, xato emas", () => {
    expect(normalizeIntegrationMetrics(undefined).connections).toEqual([]);
    expect(normalizeIntegrationMetrics({ data: { connections: "x" } }).connections).toEqual([]);
  });
});
