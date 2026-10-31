import { afterEach, describe, expect, it } from "vitest";
import type { IncomingOrder } from "../../entities/incoming-orders";
import { applyScanDraft, readScanDraft, SCAN_DRAFT_TTL_MS, writeScanDraft } from "./scanDraft";

const KEY = "elchi:incoming-scan:v1:user-1:121";
const parcel = (id: string, qr_code_token: string): IncomingOrder => ({ id, qr_code_token });

afterEach(() => {
  window.localStorage.clear();
});

describe("readScanDraft / writeScanDraft", () => {
  it("yozilgani o'qiladi; boshqa foydalanuvchi va boshqa manba ko'rmaydi", () => {
    writeScanDraft("user-1", "121", ["tok-1", "tok-2"], ["tok-2"], 1000);

    expect(readScanDraft("user-1", "121", 2000)).toEqual({ tokens: ["tok-1", "tok-2"], bagTokens: ["tok-2"], at: 1000 });
    expect(readScanDraft("user-2", "121", 2000)).toBeNull();
    expect(readScanDraft("user-1", "122", 2000)).toBeNull();
  });

  it("ro'yxat bo'shasa qoralama o'chadi", () => {
    writeScanDraft("user-1", "121", ["tok-1"], []);
    writeScanDraft("user-1", "121", [], []);

    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("smena muddati o'tgan qoralama tiklanmaydi", () => {
    writeScanDraft("user-1", "121", ["tok-1"], [], 0);

    expect(readScanDraft("user-1", "121", SCAN_DRAFT_TTL_MS)).not.toBeNull();
    expect(readScanDraft("user-1", "121", SCAN_DRAFT_TTL_MS + 1)).toBeNull();
  });

  it.each([
    ["buzuq JSON", "{oldin"],
    ["boshqa shakl", JSON.stringify({ tokens: "tok-1", bagTokens: [], at: 1 })],
    ["vaqtsiz", JSON.stringify({ tokens: ["tok-1"], bagTokens: [] })],
  ])("%s — qoralama yo'q deb olinadi", (_name, value) => {
    window.localStorage.setItem(KEY, value);

    expect(readScanDraft("user-1", "121")).toBeNull();
  });
});

describe("applyScanDraft", () => {
  it("ro'yxatdan chiqqan posilka qaytmaydi, tartib saqlanadi", () => {
    const restored = applyScanDraft([parcel("1", "tok-1"), parcel("3", "tok-3")], {
      tokens: ["tok-3", "tok-2", "tok-1"],
      bagTokens: ["tok-2", "tok-3"],
      at: 0,
    });

    expect(restored.tokens).toEqual(["tok-3", "tok-1"]);
    expect([...restored.ids]).toEqual(["3", "1"]);
    expect([...restored.bagTokens]).toEqual(["tok-3"]);
  });

  it("token ro'yxatdagi asl yozuvi bilan qaytadi, takrori bitta bo'ladi", () => {
    const restored = applyScanDraft([parcel("1", "AbC-1")], { tokens: ["abc-1", "AbC-1"], bagTokens: [], at: 0 });

    expect(restored.tokens).toEqual(["AbC-1"]);
    expect(restored.ids.size).toBe(1);
  });
});
