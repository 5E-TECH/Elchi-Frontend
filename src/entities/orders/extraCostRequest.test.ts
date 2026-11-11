import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import {
  extraCostItemQuantity,
  extraCostTagKind,
  formatExtraCostItems,
  isDeferredExtraCost,
  isExtraCostReplayOrder,
  readDeferredExtraCostReply,
  readExtraCostItems,
  readExtraCostMode,
  readExtraCostRequest,
} from "./extraCostRequest";

/**
 * SPEC v2 — qo'shimcha xarajat alohida tranzaksiya: sotish / bekor darhol, xarajat `mode: "deferred"` so'rovda
 * kutadi; qaysi tovar uchun — `items`. Backend shartnomasi mock: javob `data.extra_cost_request`, buyurtma
 * `extra_cost_request`, ro'yxat qatorlarida `mode` + `items`.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options ?? {});

const REQUEST = {
  id: 77,
  status: "pending",
  mode: "deferred",
  action: "sell",
  amount: "20000",
  items: [
    { order_item_id: 11, product_id: 5, product_name: "Telefon g'ilofi", quantity: 1 },
    { order_item_id: "12", product_id: "6", product_name: " Zaryadka ", quantity: "2" },
  ],
  auto_approve_at: "2026-11-13T09:00:00.000Z",
  created_at: "2026-11-12T09:00:00.000Z",
  decided_at: null,
  reject_reason: null,
  reject_reason_label: null,
  immediate: false,
  auto_approved: false,
};

describe("extra cost request (SPEC v2) — o'qish", () => {
  it("buyurtma maydoni normallashadi: id matn, summa son, tovar nomi tozalanadi", () => {
    const request = readExtraCostRequest(REQUEST);
    expect(request).toEqual(
      expect.objectContaining({
        id: "77",
        status: "pending",
        mode: "deferred",
        action: "sell",
        amount: 20000,
      }),
    );
    expect(request?.items).toEqual([
      {
        order_item_id: "11",
        product_id: "5",
        product_name: "Telefon g'ilofi",
        quantity: 1,
        sold_quantity: null,
        returned_quantity: null,
      },
      {
        order_item_id: "12",
        product_id: "6",
        product_name: "Zaryadka",
        quantity: 2,
        sold_quantity: null,
        returned_quantity: null,
      },
    ]);
  });

  it("`null`, id'siz yoki massiv — `null`; noma'lum holat — `pending`, noma'lum rejim — `null`", () => {
    expect(readExtraCostRequest(null)).toBeNull();
    expect(readExtraCostRequest(undefined)).toBeNull();
    expect(readExtraCostRequest({ amount: 1 })).toBeNull();
    expect(readExtraCostRequest([REQUEST])).toBeNull();
    expect(readExtraCostRequest({ id: "1", status: "boshqa", mode: "x" })).toEqual(
      expect.objectContaining({
        status: "pending",
        mode: null,
        action: null,
        amount: 0,
        items: [],
      }),
    );
  });

  it("rejim: faqat `deferred` / `replay`; yo'q (eski javob) — kechiktirilgan emas", () => {
    expect(readExtraCostMode("deferred")).toBe("deferred");
    expect(readExtraCostMode("replay")).toBe("replay");
    expect(readExtraCostMode(undefined)).toBeNull();
    expect(isDeferredExtraCost({ mode: "deferred" })).toBe(true);
    expect(isDeferredExtraCost({ mode: "replay" })).toBe(false);
    expect(isDeferredExtraCost({})).toBe(false);
    expect(isDeferredExtraCost(null)).toBe(false);
  });

  it("tovar nomi zaxirasi: `product_name` → `name` → `product.name`; massiv bo'lmasa — bo'sh", () => {
    expect(
      readExtraCostItems([{ name: "A", quantity: 1 }, { product: { id: 9, name: "B" } }]),
    ).toEqual([
      expect.objectContaining({ product_name: "A", quantity: 1 }),
      expect.objectContaining({ product_id: "9", product_name: "B", quantity: null }),
    ]);
    expect(readExtraCostItems("x")).toEqual([]);
    expect(readExtraCostItems(null)).toEqual([]);
  });
});

describe("readDeferredExtraCostReply — sotish / bekor javobi", () => {
  it("⭐ `data.extra_cost_request` (pending + deferred) — amal bajarilgan, xarajat kutmoqda", () => {
    const reply = readDeferredExtraCostReply({
      statusCode: 201,
      data: { id: "o-1", extra_cost_request: REQUEST },
    });
    expect(reply).toEqual(expect.objectContaining({ id: "77", amount: 20000, mode: "deferred" }));
  });

  it("eski 202, `replay` rejim, hal qilingan so'rov yoki maydon yo'q — `null`", () => {
    expect(
      readDeferredExtraCostReply({ statusCode: 202, data: { approval_required: true } }),
    ).toBeNull();
    expect(
      readDeferredExtraCostReply({ data: { extra_cost_request: { ...REQUEST, mode: "replay" } } }),
    ).toBeNull();
    expect(
      readDeferredExtraCostReply({
        data: { extra_cost_request: { ...REQUEST, status: "approved" } },
      }),
    ).toBeNull();
    expect(readDeferredExtraCostReply({ data: { id: "o-1" } })).toBeNull();
    expect(readDeferredExtraCostReply({ data: {} })).toBeNull();
    expect(readDeferredExtraCostReply(undefined)).toBeNull();
  });
});

describe("formatExtraCostItems — «Telefon g'ilofi ×1, Zaryadka ×2»", () => {
  const items = readExtraCostItems(REQUEST.items);

  it("nom × soni, vergul bilan", () => {
    expect(formatExtraCostItems(items, { t, language: "uz" })).toBe(
      "Telefon g'ilofi ×1, Zaryadka ×2",
    );
  });

  it("ko'pi bilan `max` ta, qolgani «+N»", () => {
    const many = readExtraCostItems([
      { product_name: "A", quantity: 1 },
      { product_name: "B", quantity: 1 },
      { product_name: "C", quantity: 1 },
      { product_name: "D", quantity: 3 },
    ]);
    expect(formatExtraCostItems(many, { t, language: "uz" })).toBe("A ×1, B ×1, C ×1 +1");
    expect(formatExtraCostItems(many, { t, language: "uz", max: 2 })).toBe("A ×1, B ×1 +2");
  });

  it("nom yo'q — «Mahsulot #id» (id ham yo'q — «Mahsulot»); soni yo'q — faqat nom", () => {
    const unnamed = readExtraCostItems([{ product_id: 42, quantity: 2 }, { order_item_id: 3 }]);
    expect(formatExtraCostItems(unnamed, { t, language: "uz" })).toBe("Mahsulot #42 ×2, Mahsulot");
  });

  it("qisman sotish: sotilgan soni ko'rsatiladi, sotilmagani (0) chiqmaydi", () => {
    const partial = readExtraCostItems([
      { product_name: "A", quantity: 3, sold_quantity: 2, returned_quantity: 1 },
      { product_name: "B", quantity: 1, sold_quantity: 0, returned_quantity: 1 },
    ]);
    expect(extraCostItemQuantity(partial[0], "partly_sell")).toBe(2);
    expect(extraCostItemQuantity(partial[0], "sell")).toBe(3);
    expect(formatExtraCostItems(partial, { t, language: "uz", action: "partly_sell" })).toBe(
      "A ×2",
    );
  });

  it("tovar yo'q (eski javob) yoki hammasi 0 — `null`", () => {
    expect(formatExtraCostItems([], { t, language: "uz" })).toBeNull();
    expect(
      formatExtraCostItems(
        readExtraCostItems([{ product_name: "A", quantity: 1, sold_quantity: 0 }]),
        {
          t,
          language: "uz",
          action: "partly_sell",
        },
      ),
    ).toBeNull();
  });
});

describe("isExtraCostReplayOrder — hamkor buyurtmasi (backend `isPartnerSyncedOrder` bilan bir xil)", () => {
  it("bo'sh bo'lmagan `external_id` — replay yo'li; bo'sh / yo'q — kechiktirilgan", () => {
    expect(isExtraCostReplayOrder({ external_id: "BP-1" })).toBe(true);
    expect(isExtraCostReplayOrder({ external_id: 120 })).toBe(true);
    expect(isExtraCostReplayOrder({ external_id: "  " })).toBe(false);
    expect(isExtraCostReplayOrder({ external_id: null })).toBe(false);
    expect(isExtraCostReplayOrder({})).toBe(false);
    expect(isExtraCostReplayOrder(null)).toBe(false);
  });
});

describe("extraCostTagKind — holat yonidagi belgi", () => {
  const deferred = readExtraCostRequest(REQUEST);
  const replayPending = readExtraCostRequest({ ...REQUEST, mode: "replay" });

  it("kutilayotgan kechiktirilgan so'rov — ro'yxatda ham, tafsilotda ham", () => {
    expect(extraCostTagKind(deferred)).toBe("pending");
    expect(extraCostTagKind(deferred, { showDecided: true })).toBe("pending");
  });

  it("⭐ eski (replay) kutilayotgan so'rov — belgisiz (uni «Tasdiqqa yuborilgan» ko'rsatadi)", () => {
    expect(extraCostTagKind(replayPending)).toBeNull();
    expect(
      extraCostTagKind(readExtraCostRequest({ ...REQUEST, mode: undefined }), {
        legacyPending: true,
      }),
    ).toBeNull();
  });

  it("tasdiqlangan / rad etilgan — faqat `showDecided` (tafsilot, skaner); void / reversed — hech qayerda", () => {
    const approved = readExtraCostRequest({ ...REQUEST, status: "approved" });
    const rejected = readExtraCostRequest({ ...REQUEST, status: "rejected" });
    expect(extraCostTagKind(approved)).toBeNull();
    expect(extraCostTagKind(approved, { showDecided: true })).toBe("approved");
    expect(extraCostTagKind(rejected, { showDecided: true })).toBe("rejected");
    expect(
      extraCostTagKind(readExtraCostRequest({ ...REQUEST, status: "void" }), { showDecided: true }),
    ).toBeNull();
    expect(
      extraCostTagKind(readExtraCostRequest({ ...REQUEST, status: "reversed" }), {
        showDecided: true,
      }),
    ).toBeNull();
    expect(extraCostTagKind(null, { showDecided: true })).toBeNull();
  });

  it("⭐ tasdiqsiz market (`immediate: true`, holati `approved`) — «Xarajat tasdiqlangan» belgisi yo'q", () => {
    const immediate = readExtraCostRequest({ ...REQUEST, status: "approved", immediate: true });
    expect(immediate?.immediate).toBe(true);
    expect(extraCostTagKind(immediate)).toBeNull();
    expect(extraCostTagKind(immediate, { showDecided: true })).toBeNull();
    // Avtomatik tasdiqlangan (24 soat) — market tomonidan tasdiq, belgi bor.
    expect(
      extraCostTagKind(readExtraCostRequest({ ...REQUEST, status: "approved", auto_approved: true }), {
        showDecided: true,
      }),
    ).toBe("approved");
  });
});
