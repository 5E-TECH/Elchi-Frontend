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

/**
 * ⚠️ `webhookOutcome` i18n KALITINI qaytaradi (matn emas). Test ikki
 * narsani tekshiradi: to'g'ri kalit tanlanganini va u UCHALA tilda
 * tarjimaga egaligini — `uz` fallback tufayli yetishmagan kalit ekranda
 * o'zbekcha chiqadi va xato bilinmaydi.
 */
const LOCALES = ["uz", "ru", "en"] as const;

const bundles = import.meta.glob<Record<string, string>>(
  "../../locales/*/integrations.json",
  { eager: true, import: "default" },
);

const dictOf = (lang: string): Record<string, string> => {
  const hit = Object.entries(bundles).find(([p]) => p.includes(`/${lang}/`));
  if (!hit) throw new Error(`${lang} lokali topilmadi`);
  return hit[1];
};

const expectTranslated = (key: string) => {
  for (const lang of LOCALES) {
    expect(dictOf(lang)[key], `${lang}/${key} tarjimasi yo'q`).toBeTruthy();
  }
};

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
    const out = webhookOutcome(
      row({ signature_valid: false, status: "rejected" }),
    );
    expect(out.labelKey).toBe("woBadSignature");
    expectTranslated(out.labelKey);
  });

  it("buyurtma yaratilgani YASHIL", () => {
    const out = webhookOutcome(row({ error: "apply: inbound_created" }));
    expect(out).toEqual({ labelKey: "woOrderCreated", color: "green" });
    expectTranslated(out.labelKey);
  });

  it("⭐ sozlama xatosi QIZIL, kutilgan holat esa NEYTRAL", () => {
    /**
     * CRM bitimni bosqich o'zgargan sayin yuboradi — "boshqa bosqich"
     * asosiy oqim, ogohlantirish emas. Uni qizil qilsak jadval soxta
     * signal bilan to'lib, haqiqiy xato ko'rinmay qolardi.
     */
    expect(webhookOutcome(row({ error: "apply: inbound_no_gate" })).color).toBe("red");
    expect(webhookOutcome(row({ error: "apply: inbound_stage_skipped" })).color).toBe("default");
  });

  it("⭐ TIMEOUT sariq — 'yiqildi' emas, 'tekshirish kerak'", () => {
    /**
     * Timeout'da buyurtma YARATILGAN bo'lishi mumkin: order-service ishni
     * tugatgan, faqat javob yetib kelmagan. "Yiqildi" deb yozish operatorni
     * noto'g'ri xulosaga olib borardi.
     */
    const out = webhookOutcome(row({ error: "apply: inbound_timeout" }));
    expect(out.color).toBe("orange");
    expect(out.labelKey).toBe("woTimeout");
    expect(dictOf("uz")[out.labelKey]).toContain("tekshirish");
  });

  it("sabab qo'shimchasi bo'lsa ham natija o'qiladi", () => {
    // Backend sababni yoniga yozadi: `apply: inbound_failed — market_id ...`
    const out = webhookOutcome(
      row({ error: "apply: inbound_failed — integration.market_id is required" }),
    );
    expect(out).toEqual({ labelKey: "woNotCreated", color: "red" });
  });

  it("xato yo'q bo'lsa toza qo'llanildi", () => {
    expect(webhookOutcome(row()).labelKey).toBe("woApplied");
  });

  it("noma'lum natija QIZIL bo'lib qoladi", () => {
    // Yangi natija qo'shilib, xarita yangilanmasa — jimgina yashil
    // ko'rsatishdan ko'ra "xato" deb ko'rsatish xavfsizroq.
    expect(webhookOutcome(row({ error: "apply: something_new" })).color).toBe("red");
  });
});
