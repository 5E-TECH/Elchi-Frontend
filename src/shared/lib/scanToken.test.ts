import { describe, expect, it } from "vitest";
import { extractScannerToken, normalizeScannerCandidates } from "./scanToken";

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
