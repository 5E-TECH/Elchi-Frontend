import { describe, expect, it } from "vitest";
import {
  findEnabledIndex,
  findTypeaheadIndex,
  firstEnabledIndex,
  isPrintableKey,
  lastEnabledIndex,
  matchesQuery,
  normalizeSearchText,
  pageIndex,
  splitMatch,
  stepIndex,
} from "./selectModel";

const items = [
  { label: "Toshkent sh." },
  { label: "Toshkent viloyati" },
  { label: "Samarqand" },
  { label: "Farg'ona", disabled: true },
  { label: "Andijon" },
];

describe("selectModel — qidiruv", () => {
  it("normalizeSearchText: kichik harf, apostrof turlari → ', uzunlik saqlanadi", () => {
    expect(normalizeSearchText("FARGʻONA")).toBe("farg'ona");
    expect(normalizeSearchText("O‘zbekiston")).toBe("o'zbekiston");
    expect(normalizeSearchText("Qo`qon").length).toBe("Qo`qon".length);
    expect(normalizeSearchText("ТОШКЕНТ")).toBe("тошкент");
  });

  it("matchesQuery: qism bo'yicha, registrsiz, bo'sh qidiruv — mos", () => {
    expect(matchesQuery("Anbar Savdo", "BAR")).toBe(true);
    expect(matchesQuery("Farg‘ona", "farg'o")).toBe(true);
    expect(matchesQuery("Nur Elektronika", "bar")).toBe(false);
    expect(matchesQuery("Nur", "   ")).toBe(true);
  });

  it("splitMatch: birinchi mos qism ajratiladi (asl matn registri saqlanadi)", () => {
    expect(splitMatch("Baraka Shop", "bar")).toEqual([
      { text: "Bar", match: true },
      { text: "aka Shop", match: false },
    ]);
    expect(splitMatch("Anbar Savdo", "bar")).toEqual([
      { text: "An", match: false },
      { text: "bar", match: true },
      { text: " Savdo", match: false },
    ]);
    expect(splitMatch("Nur", "x")).toEqual([{ text: "Nur", match: false }]);
  });
});

describe("selectModel — klaviatura", () => {
  it("findEnabledIndex / first / last o'chirilganni o'tkazadi", () => {
    expect(findEnabledIndex(items, 3, 1)).toBe(4);
    expect(findEnabledIndex(items, 3, -1)).toBe(2);
    expect(firstEnabledIndex(items)).toBe(0);
    expect(lastEnabledIndex(items)).toBe(4);
    expect(firstEnabledIndex([{ disabled: true }])).toBe(-1);
  });

  it("stepIndex aylanma; -1 dan — birinchi / oxirgi", () => {
    expect(stepIndex(items, 4, 1)).toBe(0);
    expect(stepIndex(items, 0, -1)).toBe(4);
    expect(stepIndex(items, 2, 1)).toBe(4);
    expect(stepIndex(items, -1, 1)).toBe(0);
    expect(stepIndex(items, -1, -1)).toBe(4);
  });

  it("pageIndex chegarada to'xtaydi", () => {
    expect(pageIndex(items, 0, 1)).toBe(4);
    expect(pageIndex(items, 4, -1)).toBe(0);
    expect(pageIndex(items, 1, 1, 2)).toBe(4); // 3 o'chirilgan → keyingisi
  });

  it("findTypeaheadIndex: bir xil harf — keyingisi, bir nechta harf — joriy qoladi", () => {
    expect(findTypeaheadIndex(items, "t", -1)).toBe(0);
    expect(findTypeaheadIndex(items, "t", 0)).toBe(1);
    expect(findTypeaheadIndex(items, "tt", 1)).toBe(0);
    expect(findTypeaheadIndex(items, "tosh", 0)).toBe(0);
    expect(findTypeaheadIndex(items, "f", 0)).toBe(-1); // Farg'ona o'chirilgan
  });

  it("isPrintableKey", () => {
    expect(isPrintableKey({ key: "a", ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isPrintableKey({ key: "a", ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(isPrintableKey({ key: "Enter", ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
  });
});
