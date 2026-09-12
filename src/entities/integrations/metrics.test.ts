import { describe, expect, it } from "vitest";
import {
  connectionHealth,
  fmtMetric,
  metricsByUid,
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
    expect(
      connectionHealth({ isActive: true, configured: true, metrics: m() }),
    ).toBe("ok");
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
    expect(
      connectionHealth({ isActive: true, configured: false, metrics: m() }),
    ).toBe("attention");
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
    expect(
      connectionHealth({ isActive: true, configured: true, metrics: undefined }),
    ).toBe("ok");
  });

  it("TC6: o'chirilgan ustuvor — sozlanmagan bo'lsa ham `off`", () => {
    expect(
      connectionHealth({ isActive: false, configured: false }),
    ).toBe("off");
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

describe('fmtMetric', () => {
  /**
   * Bu funksiyaning butun mavjudlik sababi: `null` ni `0` deb ko'rsatmaslik.
   * `0 ms` "bir zumda javob berdi", `0%` esa "hammasi yiqildi" degan yolg'on.
   */
  it('null va undefined — "—"', () => {
    expect(fmtMetric(null)).toBe('—');
    expect(fmtMetric(undefined)).toBe('—');
    expect(fmtMetric(null, ' ms')).toBe('—');
  });

  it('0 — haqiqiy o\'lchov, "—" EMAS', () => {
    // Nol hodisa ham o'lchov: "hodisa bo'lmadi" deb aytish kerak.
    expect(fmtMetric(0)).toBe('0');
    expect(fmtMetric(0, '%')).toBe('0%');
  });

  it('qiymatga qo\'shimcha belgi qo\'shiladi', () => {
    expect(fmtMetric(98.5, '%')).toBe('98.5%');
    expect(fmtMetric(184, ' ms')).toBe('184 ms');
  });
});
