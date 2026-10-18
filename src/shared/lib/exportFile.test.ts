import { describe, expect, it } from "vitest";
import { getFileNameFromDisposition } from "./exportFile";

describe("getFileNameFromDisposition (xWsCAA5N)", () => {
  it("`filename=\"…\"` va qo'shtirnoqsiz shakl", () => {
    expect(getFileNameFromDisposition('attachment; filename="barcha_buyurtmalar_2026-10-17.xlsx"')).toBe(
      "barcha_buyurtmalar_2026-10-17.xlsx",
    );
    expect(getFileNameFromDisposition("attachment; filename=hisobot.xlsx")).toBe("hisobot.xlsx");
  });

  it("`filename*=UTF-8''…` (RFC 5987) ustun", () => {
    expect(
      getFileNameFromDisposition(`attachment; filename="fallback.xlsx"; filename*=UTF-8''barcha_buyurtmalar%20o%CA%BBzbek.xlsx`),
    ).toBe("barcha_buyurtmalar oʻzbek.xlsx");
  });

  it("sarlavha yo'q yoki nomsiz — null", () => {
    expect(getFileNameFromDisposition(undefined)).toBeNull();
    expect(getFileNameFromDisposition("")).toBeNull();
    expect(getFileNameFromDisposition("attachment")).toBeNull();
    expect(getFileNameFromDisposition('attachment; filename=""')).toBeNull();
  });
});
