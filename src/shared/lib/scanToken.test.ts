import { describe, expect, it } from "vitest";
import {
  extractScannerToken,
  isForeignScanUrl,
  latinizeKeyboardLayout,
  normalizeScanKey,
  normalizeScannerCandidates,
  scanKeyCandidates,
} from "./scanToken";

/** Rus tartibida skanerlangan hex token (raqamlar o'zgarmaydi). */
const latinToRussian = (value: string) =>
  value.replace(/[a-f]/g, (char) => ({ a: "ф", b: "и", c: "с", d: "в", e: "у", f: "а" })[char] ?? char);

describe("extractScannerToken", () => {
  it("extracts the token from a /scan/ URL or path", () => {
    expect(extractScannerToken("https://elchi.uz/scan/ABC123")).toBe("ABC123");
    expect(extractScannerToken("/scan/TOKEN?x=1")).toBe("TOKEN");
  });

  it("accepts a bare token", () => {
    expect(extractScannerToken("ABC-123_x")).toBe("ABC-123_x");
  });

  it("decodes url-encoded tokens", () => {
    expect(extractScannerToken("https://x/scan/a%2Db")).toBe("a-b");
  });

  it("returns null for empty or non-token input", () => {
    expect(extractScannerToken("")).toBeNull();
    expect(extractScannerToken("some random text!!")).toBeNull();
  });
});

describe("normalizeScannerCandidates", () => {
  it("includes the lowercased token among the candidates", () => {
    expect(normalizeScannerCandidates("https://elchi.uz/scan/ABC123")).toContain("abc123");
  });

  it("returns an empty list for blank input", () => {
    expect(normalizeScannerCandidates("")).toEqual([]);
  });
});

describe("latinizeKeyboardLayout", () => {
  it("rus tartibi — tugma bo'yicha, tovush bo'yicha emas", () => {
    expect(latinizeKeyboardLayout("3с9в1а")).toBe("3c9d1f");
    expect(latinizeKeyboardLayout("фисвуа")).toBe("abcdef");
  });

  it("registr saqlanadi (Caps Lock + kirill tartib)", () => {
    expect(latinizeKeyboardLayout("ФИСВУА")).toBe("ABCDEF");
  });

  it("o'zbek kirill tartibi: ў, қ, ғ, ҳ tugmalari", () => {
    expect(latinizeKeyboardLayout("ўқғҳ")).toBe("os-=");
    expect(latinizeKeyboardLayout("ИЕИғ1")).toBe("BTB-1");
  });

  it("kirill tartibda yozilgan havola qaytadi: «Ж» — «:», «.» — «/», «ю» — «.»", () => {
    expect(latinizeKeyboardLayout("реезыЖ..удсршюгя.ысфт.фис")).toBe("https://elchi.uz/scan/abc");
  });

  it("kirill harfi bo'lmasa qiymat tegilmaydi (lotindagi «.» «/» ga aylanmaydi)", () => {
    expect(latinizeKeyboardLayout("a.b,C-1")).toBe("a.b,C-1");
    expect(latinizeKeyboardLayout("1234567")).toBe("1234567");
  });
});

describe("normalizeScanKey va scanKeyCandidates", () => {
  const token = "3c9d1f8e571cc6f19d6f2d26";

  it("kichik, KATTA, aralash va kirill yozuv bir xil kalitga keladi", () => {
    expect(normalizeScanKey(token)).toBe(token);
    expect(normalizeScanKey(token.toUpperCase())).toBe(token);
    expect(normalizeScanKey("3C9d1F8E571cc6F19d6f2D26")).toBe(token);
    expect(normalizeScanKey(latinToRussian(token))).toBe(token);
    expect(normalizeScanKey(latinToRussian(token).toUpperCase())).toBe(token);
  });

  it("skanerlangan qiymat va xarita kaliti bir xil shaklda", () => {
    const key = normalizeScanKey(token);
    expect(scanKeyCandidates(token.toUpperCase())).toContain(key);
    expect(scanKeyCandidates(latinToRussian(token))).toContain(key);
    expect(scanKeyCandidates(`https://elchi.uz/scan/${token.toUpperCase()}`)).toContain(key);
  });

  it("boshqa ekranlar yordamchisi o'zgarmagan: kirill nomzod qo'shilmaydi", () => {
    expect(normalizeScannerCandidates("фисвуа", "https://elchi.uz")).toEqual(["фисвуа"]);
  });
});

describe("isForeignScanUrl", () => {
  const origin = "https://app.elchi.uz";

  it("treats another site's link without /scan/ as foreign (not an Elchi label)", () => {
    expect(isForeignScanUrl("https://barakashop.uz/mahsulot/48213", origin)).toBe(true);
    expect(isForeignScanUrl("http://example.com/", origin)).toBe(true);
  });

  it("keeps label links, app links and bare tokens", () => {
    expect(isForeignScanUrl("https://elchi.uz/scan/BTB-a8c3d4e5", origin)).toBe(false);
    expect(isForeignScanUrl("https://app.elchi.uz/orders/10241", origin)).toBe(false);
    expect(isForeignScanUrl("65f0c1aa22bb33cc44dd55ee", origin)).toBe(false);
    expect(isForeignScanUrl("POST-1a2b3c", origin)).toBe(false);
  });
});
