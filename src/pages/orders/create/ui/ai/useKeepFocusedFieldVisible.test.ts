import { describe, expect, it } from "vitest";
import { revealOffset } from "./useKeepFocusedFieldVisible";

describe("revealOffset — fokusdagi maydonni ko'rinadigan oraliqqa olib kirish", () => {
  const area = { top: 80, bottom: 300 };

  it("maydon oraliqda — skroll yo'q", () => {
    expect(revealOffset({ top: 200, bottom: 248 }, area)).toBe(0);
  });

  it("maydon panel / klaviatura ostida — pastki cheti oraliq chegarasigacha ko'tariladi", () => {
    expect(revealOffset({ top: 569, bottom: 637 }, area)).toBe(337);
  });

  it("maydon oraliqdan baland — tepasi ko'rinib qoladi", () => {
    expect(revealOffset({ top: 400, bottom: 800 }, area)).toBe(320);
  });

  it("maydon yuqorida (header ostida) — pastga tushiriladi", () => {
    expect(revealOffset({ top: 20, bottom: 68 }, area)).toBe(-60);
  });
});
