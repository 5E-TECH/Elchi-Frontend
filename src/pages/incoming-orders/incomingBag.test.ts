import { describe, expect, it } from "vitest";
import type { IncomingOrder } from "../../entities/incoming-orders";
import { bagKeyOf, bagLabel, countBags, keepScannedInList } from "./lib";

/** «Qop» ustuni va yangilashda skan belgilarini saqlash — sof mantiq (IP-1, DamKku7C / eo3eeJxs). */

const order = (id: string, extra: Partial<IncomingOrder> = {}): IncomingOrder => ({
  id,
  qr_code_token: `tok-${id}`,
  ...extra,
});

describe("bagLabel / bagKeyOf / countBags", () => {
  it("hamkor qop id'si ustun; bo'lmasa token boshi 8 belgi + «…»; qopsiz — null", () => {
    expect(bagLabel(order("1", { external_batch_ref: " BP-24817 ", external_batch_token: "3733ff7bd1e2" }))).toBe("BP-24817");
    expect(bagLabel(order("2", { external_batch_token: "3733ff7bd1e2c4a5" }))).toBe("3733ff7b…");
    expect(bagLabel(order("3", { external_batch_token: "short" }))).toBe("short");
    expect(bagLabel(order("4", { external_batch_ref: "  ", external_batch_token: null }))).toBeNull();
    expect(bagLabel(order("5"))).toBeNull();
  });

  it("qoplar soni — token (bo'lmasa ref) bo'yicha, qopsizlar sanalmaydi", () => {
    const orders = [
      order("1", { external_batch_token: "A", external_batch_ref: "BP-1" }),
      order("2", { external_batch_token: "A", external_batch_ref: "BP-1" }),
      order("3", { external_batch_ref: "BP-2" }),
      order("4"),
    ];
    expect(orders.map(bagKeyOf)).toEqual(["A", "A", "BP-2", null]);
    expect(countBags(orders)).toBe(2);
    expect(countBags([])).toBe(0);
  });
});

describe("keepScannedInList — yangilangan ro'yxat bilan kesishma", () => {
  it("ro'yxatda qolgan posilkalar belgisi va tokeni saqlanadi, tartib o'zgarmaydi", () => {
    const list = [order("1"), order("3")];
    const kept = keepScannedInList(list, new Set(["1", "2", "3"]), ["tok-3", "tok-2", "tok-1"]);
    expect([...kept.ids]).toEqual(["1", "3"]);
    expect(kept.tokens).toEqual(["tok-3", "tok-1"]);
  });

  it("o'zgarish yo'q — o'sha obyektlar (jadval qayta chizilmaydi)", () => {
    const ids = new Set(["1"]);
    const tokens = ["tok-1"];
    const kept = keepScannedInList([order("1"), order("2")], ids, tokens);
    expect(kept.ids).toBe(ids);
    expect(kept.tokens).toBe(tokens);
  });

  it("bo'sh ro'yxat — hamma belgi olinadi", () => {
    const kept = keepScannedInList([], new Set(["1"]), ["tok-1"]);
    expect(kept.ids.size).toBe(0);
    expect(kept.tokens).toEqual([]);
  });
});
