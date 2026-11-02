import { describe, expect, it } from "vitest";
import type { IncomingOrder } from "../../entities/incoming-orders";
import {
  bagKeyOf,
  bagLabel,
  bagProgressIndex,
  bagProgressOf,
  countBags,
  countReceivedByBag,
  keepScannedInList,
  partialBagsInScan,
} from "./lib";

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

describe("countReceivedByBag — «Qop bo'yicha qabul qilindi» (r8EGkLrP)", () => {
  const bag = new Set(["p1", "p2", "p3"]);

  it("qop skani belgilaganlarning hammasi qabul qilinsa — hammasi", () => {
    expect(countReceivedByBag(bag, { received: 4, unmatched: [] })).toBe(3);
  });

  it("qopdagi posilka qabul qilinmasa — ayriladi; bittalab skanerlangan qabul qilinmagani ta'sir qilmaydi", () => {
    const unmatched = [
      { token: "p2", reason: "allaqachon received" },
      { token: "single", reason: "topilmadi" },
    ];
    expect(countReceivedByBag(bag, { received: 2, unmatched })).toBe(2);
  });

  it("qop skani bo'lmasa — 0; server qop tokenini o'zi ochgan bo'lsa (`batchTokens`) — qabul qilinganlarning hammasi", () => {
    expect(countReceivedByBag(new Set(), { received: 5, unmatched: [] })).toBe(0);
    expect(countReceivedByBag(new Set(), { received: 5, unmatched: [], batchTokens: ["bag-token"] })).toBe(5);
  });
});

describe("qop hisobi — bagProgressIndex / partialBagsInScan (DamKku7C, ega S3)", () => {
  const batch = (token: string, size: number | null, received: number, pending: number, ref: string | null = null) => ({
    token,
    ref,
    size,
    received,
    pending,
  });

  it("keldi = ilgari qabul qilinganlar + kutayotganlar; kartadagi misol: 3 dan 1 + 1 → 2/3", () => {
    expect(bagProgressIndex([batch("A", 3, 1, 1, "BP-24817")]).get("A")).toEqual({
      token: "A",
      label: "BP-24817",
      size: 3,
      arrived: 2,
      received: 1,
      missing: 1,
    });
  });

  it("nomi: ref, bo'lmasa token boshi (`bagLabel` bilan bir xil)", () => {
    expect(bagProgressIndex([batch("3733ff7bd1e2", 3, 0, 1)]).get("3733ff7bd1e2")?.label).toBe("3733ff7b…");
  });

  it("ilgari qabul qilingan a'zo kamomad emas: 1 + 2 = 3/3", () => {
    expect(bagProgressIndex([batch("A", 3, 1, 2)]).get("A")?.missing).toBe(0);
  });

  it("hajmi noma'lum qop hisobga kirmaydi; hamkor kam aytgan bo'lsa ham kamomad manfiy emas", () => {
    expect(bagProgressIndex([batch("A", null, 0, 2)]).size).toBe(0);
    expect(bagProgressIndex([batch("B", 2, 1, 2)]).get("B")?.missing).toBe(0);
  });

  it("bagProgressOf — posilkaning qop tokeni bo'yicha; qopsiz — null", () => {
    const bags = bagProgressIndex([batch("A", 3, 0, 2)]);
    expect(bagProgressOf(order("1", { external_batch_token: "A" }), bags)?.arrived).toBe(2);
    expect(bagProgressOf(order("2"), bags)).toBeNull();
  });

  it("partialBagsInScan: faqat skanerlangan posilkasi bor chala qoplar, skan soni bilan", () => {
    const bags = bagProgressIndex([batch("A", 3, 0, 2), batch("B", 2, 0, 1), batch("C", 2, 0, 2)]);
    const orders = [
      order("1", { external_batch_token: "A" }),
      order("2", { external_batch_token: "A" }),
      order("3", { external_batch_token: "B" }),
      order("4", { external_batch_token: "C" }),
      order("5"),
    ];
    expect(partialBagsInScan(orders, new Set(["1", "2", "4", "5"]), bags).map(({ token, scanned }) => [token, scanned])).toEqual([
      ["A", 2],
    ]);
    expect(partialBagsInScan(orders, new Set(["4", "5"]), bags)).toEqual([]);
  });
});
