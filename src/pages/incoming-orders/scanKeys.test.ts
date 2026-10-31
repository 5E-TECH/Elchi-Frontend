import { describe, expect, it } from "vitest";
import type { IncomingOrder } from "../../entities/incoming-orders";
import { normalizeScanKey, scanKeyCandidates } from "../../shared/lib/scanToken";
import { findByScanKeys, indexByBatch, indexByToken, parcelToken } from "./lib";

/**
 * rQX8TqRV: xarita kaliti va skanerlangan qiymat BITTA shaklga keladi. Ilgari token aniq solishtirilardi, va
 * bu ekran skan yuzalari orasida yolg'iz edi: KATTA harfli yorliq «Bu QR ro'yxatda topilmadi» berardi.
 */
const TOKEN = "c9f6d82e571cc6f19d6f2d26";
const BAG = "BP-Qop-A1";
const parcel = (id: string, qr_code_token: string | null, external_batch_token?: string): IncomingOrder => ({
  id,
  qr_code_token,
  external_batch_token,
});
const orders = [parcel("1", TOKEN, BAG), parcel("2", "F0F0AABB", BAG), parcel("3", null), parcel("4", "  ")];

describe("indexByToken", () => {
  it("kalit normallashtirilgan, asl token buyurtmada o'zgarmay turadi", () => {
    const index = indexByToken(orders);
    expect([...index.keys()]).toEqual([TOKEN, "f0f0aabb"]);
    expect(parcelToken(index.get("f0f0aabb")!)).toBe("F0F0AABB");
  });

  it.each([
    ["kichik harf", TOKEN],
    ["KATTA harf", TOKEN.toUpperCase()],
    ["aralash registr", "C9F6d82E571cc6F19d6F2D26"],
    ["kirill tartibi", "с9а6в82у571сс6а19в6а2в26"],
    ["kirill tartibi KATTA", "С9А6В82У571СС6А19В6А2В26"],
    ["havola ichida", `https://elchi.uz/scan/${TOKEN.toUpperCase()}`],
  ])("%s — bir xil posilka", (_name, scanned) => {
    expect(findByScanKeys(indexByToken(orders), scanKeyCandidates(scanned, "https://elchi.uz"))?.id).toBe("1");
  });

  it("serverda katta harfli token ham kichik harfli skan bilan topiladi", () => {
    expect(findByScanKeys(indexByToken(orders), scanKeyCandidates("f0f0aabb"))?.id).toBe("2");
  });

  it("begona kod topilmaydi", () => {
    expect(findByScanKeys(indexByToken(orders), scanKeyCandidates("BEGONA-TOKEN"))).toBeUndefined();
  });
});

describe("indexByBatch", () => {
  it("qop tokeni ham shu kalit bilan: a'zolar bitta qopga yig'iladi", () => {
    const index = indexByBatch(orders);
    expect([...index.keys()]).toEqual([normalizeScanKey(BAG)]);
    expect(findByScanKeys(index, scanKeyCandidates(BAG.toUpperCase()))?.map((order) => order.id)).toEqual(["1", "2"]);
  });

  it("katta-kichik harfi farq qilgan qop tokenlari bitta kalitga tushadi", () => {
    const index = indexByBatch([parcel("1", "a", "abc"), parcel("2", "b", "ABC")]);
    expect(index.get("abc")?.map((order) => order.id)).toEqual(["1", "2"]);
  });
});
