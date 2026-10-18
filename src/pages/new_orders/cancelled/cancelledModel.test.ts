import { describe, expect, it } from "vitest";
import type { OrderListItem } from "../../../entities/order/types/order";
import {
  canSendHandover,
  extractMarketCancelledQrToken,
  formatCountdown,
  getOrderProductNames,
  normalizeCancelledAuthorization,
  normalizeCancelledMarketQr,
  resolveHandoverQrStage,
  scannerContainsMarketCancelledQr,
  splitCountdown,
  toOrderCardData,
} from "./cancelledModel";
import uz from "../../../locales/uz/newOrders.json";
import ru from "../../../locales/ru/newOrders.json";
import en from "../../../locales/en/newOrders.json";

/** Bekor qilinganlarni topshirish — sof qoidalar (dizayn v2 gacha `detail.tsx` ichida edi). */

const order = (overrides: Partial<OrderListItem> = {}): OrderListItem =>
  ({
    id: "501",
    market_id: "201",
    customer_id: "c1",
    product_quantity: 1,
    status: "cancelled",
    where_deliver: "center",
    total_price: 100000,
    to_be_paid: 0,
    paid_amount: 0,
    district_id: null,
    region_id: null,
    address: null,
    operator: null,
    comment: null,
    post_id: null,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    deleted: false,
    items: [],
    ...overrides,
  }) as OrderListItem;

describe("market QR bosqichi va jo'natish sharti", () => {
  it("QR o'chirilgan market — `notRequired`, token so'ralmaydi", () => {
    expect(resolveHandoverQrStage({ qrRequired: false, qrScanned: false, authorizationToken: "" })).toBe("notRequired");
    expect(
      canSendHandover({
        selectedCount: 2,
        pending: false,
        marketId: "201",
        qrRequired: false,
        qrScanned: false,
        authorizationToken: "",
      }),
    ).toBe(true);
  });

  it("QR kerak: skanerlanmaguncha (yoki token yo'q bo'lsa) jo'natib bo'lmaydi", () => {
    expect(resolveHandoverQrStage({ qrRequired: true, qrScanned: false, authorizationToken: "" })).toBe("required");
    expect(resolveHandoverQrStage({ qrRequired: true, qrScanned: true, authorizationToken: "" })).toBe("required");
    expect(resolveHandoverQrStage({ qrRequired: true, qrScanned: true, authorizationToken: "tok" })).toBe("scanned");

    const base = { selectedCount: 3, pending: false, marketId: "201", qrRequired: true };
    expect(canSendHandover({ ...base, qrScanned: false, authorizationToken: "" })).toBe(false);
    expect(canSendHandover({ ...base, qrScanned: true, authorizationToken: "" })).toBe(false);
    expect(canSendHandover({ ...base, qrScanned: false, authorizationToken: "tok" })).toBe(false);
    expect(canSendHandover({ ...base, qrScanned: true, authorizationToken: "tok" })).toBe(true);
  });

  it("tanlov bo'sh, so'rov ketmoqda yoki market noma'lum — jo'natilmaydi", () => {
    const ready = { qrRequired: true, qrScanned: true, authorizationToken: "tok" };
    expect(canSendHandover({ ...ready, selectedCount: 0, pending: false, marketId: "201" })).toBe(false);
    expect(canSendHandover({ ...ready, selectedCount: 1, pending: true, marketId: "201" })).toBe(false);
    expect(canSendHandover({ ...ready, selectedCount: 1, pending: false, marketId: "" })).toBe(false);
  });
});

describe("taymer", () => {
  it("«04:12» va ekran o'quvchi uchun daqiqa/soniya", () => {
    expect(formatCountdown(252)).toBe("04:12");
    expect(formatCountdown(-5)).toBe("00:00");
    expect(splitCountdown(252)).toEqual({ minutes: 4, seconds: 12 });
    expect(splitCountdown(-1)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("market QR va topshirish tokeni", () => {
  it("skaner matnidan `MCR-…` tokeni olinadi; boshqa matn — bo'sh", () => {
    expect(extractMarketCancelledQrToken("MCR-abc123")).toBe("MCR-abc123");
    expect(extractMarketCancelledQrToken("tok-501")).toBe("");
  });

  it("marketning bekor qilinganlar QR kodi taniladi (MCR-, matn, JSON)", () => {
    expect(scannerContainsMarketCancelledQr("MCR-abc123", "201")).toBe(true);
    expect(scannerContainsMarketCancelledQr("cancelled-market-201", "201")).toBe(true);
    expect(scannerContainsMarketCancelledQr(JSON.stringify({ market_id: "201", type: "cancelled" }), "201")).toBe(true);
    expect(scannerContainsMarketCancelledQr(JSON.stringify({ market_id: "999", type: "cancelled" }), "201")).toBe(false);
    expect(scannerContainsMarketCancelledQr("tok-501", "201")).toBe(false);
  });

  it("avtorizatsiya: token majburiy; muddat `expires_at` dan, bo'lmasa `remaining_seconds` (sukut 300 s)", () => {
    expect(() => normalizeCancelledAuthorization({ data: {} })).toThrow();
    const fixed = normalizeCancelledAuthorization({
      data: { authorization_token: "tok", expires_at: "2026-10-17T10:00:00.000Z" },
    });
    expect(fixed).toEqual({ authorizationToken: "tok", expiresAt: Date.parse("2026-10-17T10:00:00.000Z") });

    const before = Date.now();
    const relative = normalizeCancelledAuthorization({ authorizationToken: "tok2", remaining_seconds: 60 });
    expect(relative.authorizationToken).toBe("tok2");
    expect(relative.expiresAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(relative.expiresAt).toBeLessThan(before + 61_000);
  });

  it("QR javobi: rasm (URL / base64 / svg), token va matn", () => {
    expect(normalizeCancelledMarketQr({ data: { qr_image: "https://cdn/qr.png", token: "MCR-1" } })).toEqual({
      image: "https://cdn/qr.png",
      token: "MCR-1",
      payload: "MCR-1",
    });
    const svg = normalizeCancelledMarketQr({ data: { qr: { image: "<svg></svg>" } } });
    expect(svg.image?.startsWith("data:image/svg+xml")).toBe(true);
    expect(normalizeCancelledMarketQr({ token: "MCR-2" })).toEqual({ image: "", token: "MCR-2", payload: "MCR-2" });
  });
});

describe("buyurtma ko'rinishi", () => {
  it("katalogsiz mahsulot soxta `product` olmaydi; tuman va viloyat buyurtmadan", () => {
    const view = toOrderCardData(
      order({
        items: [
          { id: "i1", product_id: null, product_name: "Elektr choynak", order_id: "501", quantity: 1, createdAt: "", updatedAt: "" },
        ],
        district: { id: "d1", name: "Buxoro sh.", region: { id: "r1", name: "Buxoro viloyati" } },
        customer: { id: "c1", name: "Jamshid Karimov", phone_number: "+998938452061" },
      }),
    );
    expect(view.items?.[0]).toEqual({ id: "i1", quantity: 1, product_name: "Elektr choynak", product: null });
    expect(view.district).toEqual({ name: "Buxoro sh." });
    expect(view.region).toEqual({ name: "Buxoro viloyati" });
    expect(view.customer.name).toBe("Jamshid Karimov");
  });

  it("mahsulot nomlari: katalog nomi, bo'lmasa `product_name`", () => {
    expect(
      getOrderProductNames(
        order({
          items: [
            { id: "i1", product_id: "p1", order_id: "501", quantity: 1, createdAt: "", updatedAt: "", product: { id: "p1", name: "Qishki shapka" } },
            { id: "i2", product_id: null, product_name: "Qo'lqop", order_id: "501", quantity: 1, createdAt: "", updatedAt: "" },
          ],
        }),
      ),
    ).toBe("Qishki shapka, Qo'lqop");
  });
});

describe("newOrders:cancelled — uz/ru/en kalitlari", () => {
  /** Ko'plik shakllari (`_one`, `_few`, `_many`, `_other`) bitta kalit hisoblanadi. */
  const keysOf = (block: unknown, prefix = ""): string[] =>
    Object.entries(block as Record<string, unknown>).flatMap(([key, value]) =>
      value && typeof value === "object"
        ? keysOf(value, `${prefix}${key}.`)
        : [`${prefix}${key.replace(/_(zero|one|two|few|many|other)$/, "")}`],
    );
  const baseKeys = (block: unknown) => [...new Set(keysOf(block))].sort();

  it("uch tilda bir xil kalitlar", () => {
    const keys = baseKeys(uz.cancelled);
    expect(baseKeys(ru.cancelled)).toEqual(keys);
    expect(baseKeys(en.cancelled)).toEqual(keys);
  });

  it("o'zbekcha matnlar maketdagidek (fragment — matn manbai)", () => {
    expect(uz.cancelled.card.title).toBe("Bekor qilingan buyurtmalarni tayyorlash");
    expect(uz.cancelled.card.hint).toBe(
      "Buyurtmalar faqat QR skaner orqali tanlanadi. QR buzilgan bo'lsa, qo'lda tasdiqlash mumkin.",
    );
    expect(uz.cancelled.alert.requiredBody).toBe(
      "Jo'natish uchun avval market chiqargan QR kodni skanerlang. Skanerlangach, barcha buyurtmalar avtomatik tanlanadi.",
    );
    expect(uz.cancelled.selection.hint).toBe("Tanlangan buyurtmalar market uchun qaytarish pochtasiga qo'shiladi.");
    expect(uz.cancelled.manual.note).toBe(
      "Bu amal faoliyat jurnalida qo'lda tasdiqlangan buyurtma sifatida ko'rinadi.",
    );
    // Kod «Label yo'qolgan» (backend enum) — yorliq maketdagidek.
    expect(uz.cancelled.manualReasons.missing).toBe("Yorliq yo'qolgan");
    expect(uz.cancelled.market.handoverHint).toBe(
      "Qabul qilish tugmasini bosing va chiqqan QR kodni pochtada skaner qildiring.",
    );
  });
});
