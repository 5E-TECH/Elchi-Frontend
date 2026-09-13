import { describe, expect, it } from "vitest";
import { paymentOutcome, type PaymentRow } from "./payments";

/**
 * TO'LOVNING QO'LLANISH NATIJASI — jadvaldagi yorliq.
 *
 * ⚠️ ASOSIY QOIDA: `recorded` dan boshqa HAMMASI e'tibor talab qiladi —
 * pul kelgan, lekin buyurtmaga tegmagan. Ularni neytral (kulrang)
 * ko'rsatish yo'qolgan pulni yashirardi, ya'ni jadvalning maqsadi
 * buzilardi.
 */
const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "1",
  createdAt: "2026-09-13T10:00:00Z",
  integration_id: "12",
  provider_transaction_id: "PX-1",
  order_id: "4021",
  order_ref: "4021",
  amount: 250000,
  currency: "UZS",
  status: "succeeded",
  provider_status: "2",
  apply_outcome: "recorded",
  ...over,
});

describe("paymentOutcome", () => {
  it("buyurtmaga yozilgani YASHIL", () => {
    expect(paymentOutcome(row())).toEqual({
      label: "buyurtmaga yozildi",
      color: "green",
    });
  });

  it("⭐ qo'llanmagan to'lovlar QIZIL", () => {
    for (const outcome of [
      "order_not_found",
      "order_ref_missing",
      "order_already_closed",
      "amount_exceeds_total",
      "amount_invalid",
    ]) {
      expect(
        paymentOutcome(row({ apply_outcome: outcome })).color,
        `${outcome} qizil bo'lishi kerak`,
      ).toBe("red");
    }
  });

  it("⭐ natija YO'Q bo'lsa — 'uzilgan', neytral EMAS", () => {
    /**
     * `null` = yozuv band qilingan, lekin natija yozilmagan: jarayon yarim
     * yo'lda uzilgan (servis qulagan, tarmoq uzilgan). Pul kelgan bo'lishi
     * mumkin va hech qayerga yozilmagan — bu eng ko'rinishi kerak bo'lgan
     * holat, shu bois kulrang qilib qo'yish xato bo'lardi.
     */
    const out = paymentOutcome(row({ apply_outcome: null }));
    expect(out.color).toBe("orange");
    expect(out.label).toContain("uzilgan");
  });

  it("⭐ TIMEOUT sariq — 'xato' emas, 'tekshirish kerak'", () => {
    /**
     * Timeout'da buyurtma yangilangan BO'LISHI MUMKIN. "Xato" deb yozish
     * operatorni noto'g'ri xulosaga olib borardi.
     */
    const out = paymentOutcome(row({ apply_outcome: "timeout" }));
    expect(out.color).toBe("orange");
    expect(out.label).toContain("tekshirish");
  });

  it("holat qo'llanmagani NEYTRAL", () => {
    // `pending`/`failed` — kutilgan oqim, ogohlantirish emas.
    expect(paymentOutcome(row({ apply_outcome: "ignored_status" }))).toEqual({
      label: "holat qo‘llanmadi",
      color: "default",
    });
  });

  it("noma'lum natija QIZIL bo'lib qoladi", () => {
    // Yangi natija qo'shilib xarita yangilanmasa — yashil ko'rsatishdan
    // ko'ra xato deb ko'rsatish xavfsizroq.
    const out = paymentOutcome(row({ apply_outcome: "something_new" }));
    expect(out.color).toBe("red");
  });
});
