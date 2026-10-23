import { isUnsentCancelledOrder, type Order } from "./courierOrdersModel";

/**
 * «Bekor qilingan» tab qatorlari (wtmkmJ8h 65c007) — HOZIRGI qoida qotiriladi. Backend `courier_cancelled_tab`
 * `total` i qisman sotuv bola buyurtmalarini (ayniqsa filial/HQ qo'lidagi, `canceled_post_id` yo'q) ham sanaydi,
 * frontend esa ularni yashiradi — `index.tsx` dagi «Jami» izohi (b). Qaysi tomon to'g'ri — egasi/backend qarori;
 * qoida o'zgarsa shu test va izoh birga yangilanadi.
 */
const order = (fields: Record<string, unknown>) => ({ id: "1", status: "cancelled", ...fields }) as unknown as Order;

describe("isUnsentCancelledOrder (65c007 — «Jami» bilan ma'lum farq)", () => {
  it("oddiy bekor (kuryer qo'lida, pochtaga yuborilmagan) — ko'rinadi", () => {
    expect(isUnsentCancelledOrder(order({ holder_type: "COURIER" }))).toBe(true);
    expect(isUnsentCancelledOrder(order({}))).toBe(true);
  });

  it("pochtaga yuborilgan bekor — yashiriladi (backend ham sanamaydi)", () => {
    expect(isUnsentCancelledOrder(order({ transport_status: "cancelled (sent)" }))).toBe(false);
  });

  it.each(["BRANCH", "HQ"])(
    "%s qo'lidagi qisman sotuv bola buyurtmasi — frontend yashiradi, backend `total` ga kiritadi (doimiy farq)",
    (holderType) => {
      expect(isUnsentCancelledOrder(order({ holder_type: holderType, parent_order_id: "77", canceled_post_id: null }))).toBe(
        false,
      );
    },
  );

  it("kuryer qo'lidagi bola buyurtma (`parent_order_id` bor) — frontend yashiradi", () => {
    expect(isUnsentCancelledOrder(order({ holder_type: "COURIER", parent_order_id: "77" }))).toBe(false);
  });
});
