import { describe, expect, it } from "vitest";
import { webhookOutcome, type WebhookLogRow } from "./webhookLogs";

/**
 * KIRUVCHI WEBHOOK NATIJASI — jadvaldagi yorliq.
 *
 * ⚠️ NEGA `status` YETMAYDI. Backend `status` ustunida faqat uch qiymat
 * bor (`rejected`/`verified`/`processed`), operatorning savoli esa boshqa:
 * NIMA bo'ldi? "Buyurtma yaratildi" bilan "darvoza sozlanmagan" ikkisi ham
 * `processed` — shu bois natija `error` ichidagi `apply: <natija>` dan
 * o'qiladi.
 */
const row = (over: Partial<WebhookLogRow> = {}): WebhookLogRow => ({
  id: "1",
  createdAt: "2026-09-13T10:00:00Z",
  integration_id: "9",
  provider_slug: "amocrm",
  delivery_id: null,
  event_type: "leads.status",
  signature_valid: true,
  status: "processed",
  error: null,
  processed_at: "2026-09-13T10:00:01Z",
  trace_id: null,
  ...over,
});

describe("webhookOutcome", () => {
  it("⭐ imzo xato bo'lsa hammasidan USTUN", () => {
    /**
     * Imzo yiqilgan hodisa uchun "natija" tushunchasi yo'q — u umuman
     * qo'llanmagan. Boshqa yorliq ko'rsatish xavfsizlik hodisasini
     * yashirardi.
     */
    expect(
      webhookOutcome(row({ signature_valid: false, status: "rejected" })).label,
    ).toBe("imzo xato");
  });

  it("buyurtma yaratilgani YASHIL", () => {
    const out = webhookOutcome(row({ error: "apply: inbound_created" }));
    expect(out).toEqual({ label: "buyurtma yaratildi", color: "green" });
  });

  it("⭐ sozlama xatosi QIZIL, kutilgan holat esa NEYTRAL", () => {
    /**
     * CRM bitimni bosqich o'zgargan sayin yuboradi — "boshqa bosqich"
     * asosiy oqim, ogohlantirish emas. Uni qizil qilsak jadval soxta
     * signal bilan to'lib, haqiqiy xato ko'rinmay qolardi.
     */
    expect(webhookOutcome(row({ error: "apply: inbound_no_gate" })).color).toBe(
      "red",
    );
    expect(
      webhookOutcome(row({ error: "apply: inbound_stage_skipped" })).color,
    ).toBe("default");
  });

  it("⭐ TIMEOUT sariq — 'yiqildi' emas, 'tekshirish kerak'", () => {
    /**
     * Timeout'da buyurtma YARATILGAN bo'lishi mumkin: order-service ishni
     * tugatgan, faqat javob yetib kelmagan. "Yiqildi" deb yozish operatorni
     * noto'g'ri xulosaga olib borardi.
     */
    const out = webhookOutcome(row({ error: "apply: inbound_timeout" }));
    expect(out.color).toBe("orange");
    expect(out.label).toContain("tekshirish");
  });

  it("sabab qo'shimchasi bo'lsa ham natija o'qiladi", () => {
    // Backend sababni yoniga yozadi: `apply: inbound_failed — market_id ...`
    const out = webhookOutcome(
      row({ error: "apply: inbound_failed — integration.market_id is required" }),
    );
    expect(out).toEqual({ label: "yaratilmadi", color: "red" });
  });

  it("xato yo'q bo'lsa toza qo'llanildi", () => {
    expect(webhookOutcome(row()).label).toBe("qo‘llanildi");
  });

  it("noma'lum natija QIZIL bo'lib qoladi", () => {
    // Yangi natija qo'shilib, xarita yangilanmasa — jimgina yashil
    // ko'rsatishdan ko'ra "xato" deb ko'rsatish xavfsizroq.
    expect(webhookOutcome(row({ error: "apply: something_new" })).color).toBe(
      "red",
    );
  });
});
