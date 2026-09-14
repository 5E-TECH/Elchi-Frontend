import { describe, expect, it } from "vitest";
import { missingForReady } from "../useConnections";
import uz from "../../../locales/uz/integrations.json";

/**
 * ⚠️ `missingForReady` endi MATN EMAS, i18n KALITI qaytaradi. Tekshiruv shu
 * bois ikki qatlamli: togri kalit tanlanganmi, VA kalitning ozbekcha matni
 * hali ham SABABNI aytadimi. Faqat kalitni tekshirish yetmaydi — matn bosh
 * qolsa ham test yashil bolib ketardi.
 */
const text = (key: string): string => (uz as Record<string, string>)[key] ?? "";

/**
 * USTADAGI UCH XATOLIK — QULFLASH.
 *
 * Uchalasi ham "jimgina noto'g'ri" turkumidan edi: xato chiqmaydi, tizim
 * ishlashda davom etadi, lekin operator zarar ko'radi.
 */

describe("⭐ 1. USTA VA KARTA bir xil gapiradi", () => {
  /**
   * NIMA BUZILGAN EDI. Usta oxiri HAR DOIM yashil "Ulanish yaratildi ...
   * endi kuzatish mumkin" derdi, ro'yxatdagi karta esa AYNI ulanishni
   * "E'tibor kerak" deb ko'rsatardi. Operator qaysi biriga ishonishni
   * bilmasdi va ustadan "tayyor" degan ishonch bilan chiqib ketardi.
   *
   * Endi ikkisi ham `missingForReady` dan kelib chiqadi — ya'ni bitta
   * manba. Bu test o'sha yagona manbani qulflaydi.
   */
  it("kargo: endpoint va sekret YO'Q bo'lsa ikkita bo'shliq", () => {
    const gaps = missingForReady({
      kind: "integration",
      role: "carrier",
      raw: { base_url: "https://ldg.uz" },
    });
    expect(gaps).toEqual(["gapDispatchEndpoint", "gapWebhookSecretCargo"]);
  });

  it("kargo: ikkisi ham bo'lsa bo'shliq YO'Q", () => {
    expect(
      missingForReady({
        kind: "integration",
        role: "carrier",
        raw: {
          base_url: "https://ldg.uz",
          dispatch_config: { endpoint: "/v1/orders" },
          has_webhook_secret: true,
        },
      }),
    ).toEqual([]);
  });

  it("⭐ har bir bo'shliq KEYINGI QADAMNI aytadi", () => {
    /**
     * "Sozlanmagan" degan matn hech narsa bermaydi. Operator NIMA
     * to'ldirishni va NEGA kerakligini bilishi kerak — shu bois har bir
     * satrda sabab bor (masalan "busiz posilka yuborilmaydi (400)").
     */
    const all = [
      ...missingForReady({ kind: "partner", role: undefined, raw: {} }),
      ...missingForReady({ kind: "integration", role: "carrier", raw: {} }),
      ...missingForReady({ kind: "integration", role: "payment", raw: {} }),
      ...missingForReady({ kind: "integration", role: "source", raw: {} }),
    ];
    expect(all.length).toBeGreaterThan(4);
    for (const gap of all) {
      // Har bir kalit haqiqatan tarjima faylida bolishi kerak.
      expect(text(gap), `"${gap}" kaliti uz tarjimasida yo'q`).not.toBe("");
      // Va matn "nima" va "nega" ni aytishi kerak — tire bilan ajratilgan.
      expect(text(gap), `"${gap}" matnida sabab yo'q`).toContain("—");
    }
  });

  it("hamkor: webhook manzili yo'q bo'lsa aytiladi", () => {
    const gaps = missingForReady({ kind: "partner", raw: {} });
    expect(gaps).toEqual(["gapWebhookUrl"]);
  });

  it("ko'zgu: manzil yetarli", () => {
    expect(
      missingForReady({
        kind: "integration",
        role: "mirror",
        raw: { base_url: "https://sheets.uz" },
      }),
    ).toEqual([]);
  });

  it("⭐ manba: market bog'lanishi TALAB qilinadi", () => {
    // Busiz `receiveExternalOrders` har importda 400 beradi.
    const gaps = missingForReady({
      kind: "integration",
      role: "source",
      raw: { base_url: "https://donoxon.uz" },
    });
    expect(gaps).toEqual(["gapMarketLink"]);
  });
});

describe("⭐ 2-3. USTA MANBA KODI — himoyalar o'rnida", () => {
  /**
   * Bu ikki xatolikni sof funksiya bilan tekshirib bo'lmaydi (ular
   * komponent holatida), shu bois manba kodi tekshiriladi. Zaif test, lekin
   * REGRESSIYANI ushlaydi: kimdir himoyani olib tashlasa bilinadi.
   */
  const wizard =
    Object.entries(
      import.meta.glob("./ConnectWizard.tsx", {
        eager: true,
        query: "?raw",
        import: "default",
      }) as Record<string, string>,
    )[0]?.[1] ?? "";

  it("manba topildi (test bo'shliqda ishlamasin)", () => {
    expect(wizard.length).toBeGreaterThan(1000);
  });

  it("⭐ API kalit tasdiqlanmaguncha 'Yakunlash' O'CHIRILGAN", () => {
    /**
     * Kalit javobda BIR MARTA keladi va bazada faqat hash'i saqlanadi —
     * qayta ko'rsatish IMKONSIZ. Ilgari "Yakunlash" bosilishi bilan kalit
     * ekrandan yo'qolardi va hech qanday ogohlantirish yo'q edi: operator
     * uni ko'chirmagan bo'lsa, hamkor integratsiyani boshlay olmasdi.
     */
    expect(wizard).toContain("keyCopied");
    expect(wizard).toMatch(/disabled=\{Boolean\(created\?\.apiKey\) && !keyCopied\}/);
  });

  it("nusxa olish TASDIQ sifatida hisoblanadi", () => {
    // Operator ikki marta bir narsani bildirmasin.
    expect(wizard).toContain("onCopy: () => setKeyCopied(true)");
  });

  it("⭐ ID bo'sh bo'lsa 3-qadamga O'TILMAYDI", () => {
    /**
     * Ilgari bunda ham davom etilardi va ikki narsa jimgina buzilardi:
     * "Sinash" hech narsa qilmasdi, "Konsolda ochish" esa `partner:`
     * (id'siz) manziliga o'tib BEGONA ulanishni ochardi.
     */
    expect(wizard).toContain('t("wzConnNoId")');
    expect(text("wzConnNoId")).toContain("id'si o'qilmadi");
    // Hamkor yo'lida kalit ham xabarda qaytariladi (u bir marta keladi).
    expect(wizard).toContain('t("wzPartnerNoId"');
    expect(text("wzPartnerNoId")).toContain("API kalit:");
  });

  it("⭐ 'Sinash' JIM qolmaydi", () => {
    // Ilgari `if (!created?.id) return;` — tugma bosiladi, javob yo'q.
    expect(wizard).not.toMatch(/if \(!created\?\.id\) return;/);
    expect(wizard).toContain('t("wzTestNoId")');
    expect(text("wzTestNoId")).toContain("sinov yuborib bo'lmaydi");
  });

  it("⭐ usta oxiri YAGONA manbadan hisoblanadi", () => {
    expect(wizard).toContain("missingForReady");
    // Shartsiz yashil banner qaytmasligi kerak.
    expect(wizard).toContain("gaps.length === 0");
    expect(wizard).toContain('t("wzNotReady")');
    expect(text("wzNotReady")).toContain("hali ISHLAMAYDI");
  });
});
