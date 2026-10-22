import { describe, expect, it } from "vitest";
import type { Logist, LogistRegion } from "../../../../../entities/logist";
import {
  assignedRegionIds,
  diffAssignment,
  filterRegions,
  logistInitials,
  matchesLogist,
  needsConfirmation,
  regionCardKind,
  regionCountByLogist,
  resolveSelectedLogist,
  sortLogists,
  sortRegions,
} from "./assignment";

const region = (id: string, name: string, logistId: string | null = null): LogistRegion => ({
  id,
  name,
  logistId,
});
const logist = (id: string, name: string, status: Logist["status"] = "active"): Logist => ({
  id,
  name,
  phone_number: `+99890000000${id}`,
  status,
});

describe("regionCardKind — 6 holat", () => {
  it.each([
    [null, false, "free"],
    ["7", false, "other"],
    ["1", true, "assigned"],
    [null, true, "adding"],
    ["7", true, "transfer"],
    ["1", false, "removing"],
  ] as const)("logist_id=%s, belgi=%s → %s", (owner, checked, kind) => {
    expect(regionCardKind(region("5", "Jizzax", owner), "1", checked)).toBe(kind);
  });
});

describe("tartib", () => {
  it("Toshkent shahri va viloyati avval, qolganlari alifbo bo'yicha (qisqa nom)", () => {
    const sorted = sortRegions([
      region("3", "Samarqand viloyati"),
      region("2", "Toshkent viloyati"),
      region("4", "Andijon viloyati"),
      region("1", "Toshkent shahri"),
      region("5", "Qoraqalpog'iston Respublikasi"),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["1", "2", "4", "5", "3"]);
  });

  it("logistlar: faollari avval, so'ng ism bo'yicha", () => {
    const sorted = sortLogists([
      logist("4", "Malika Yusupova", "inactive"),
      logist("3", "Sherzod Nazarov"),
      logist("1", "Aziz Rahimov"),
      logist("2", "Dilnoza Karimova"),
    ]);
    expect(sorted.map((item) => item.name)).toEqual([
      "Aziz Rahimov",
      "Dilnoza Karimova",
      "Sherzod Nazarov",
      "Malika Yusupova",
    ]);
  });
});

describe("o'zgarishlar", () => {
  const regions = [
    region("1", "Toshkent sh."),
    region("5", "Jizzax", "2"),
    region("7", "Navoiy", "1"),
    region("12", "Surxondaryo", "1"),
    region("3", "Buxoro"),
  ];

  it("server holati: logistdagi viloyatlar va har logist soni", () => {
    expect([...assignedRegionIds(regions, "1")]).toEqual(["7", "12"]);
    expect(Object.fromEntries(regionCountByLogist(regions))).toEqual({ "1": 2, "2": 1 });
  });

  it("qo'shish, o'tkazish va olib tashlash — tasdiq faqat olib tashlash yoki o'tkazishda", () => {
    const draft = new Set(["7", "5", "3"]);
    const diff = diffAssignment(regions, "1", draft);
    expect(diff.added.map((change) => change.region.id)).toEqual(["3"]);
    expect(diff.transferred.map((change) => change.region.id)).toEqual(["5"]);
    expect(diff.removed.map((change) => change.region.id)).toEqual(["12"]);
    expect(diff.total).toBe(3);
    expect(needsConfirmation(diff)).toBe(true);

    const onlyAdd = diffAssignment(regions, "1", new Set(["7", "12", "1"]));
    expect(onlyAdd.total).toBe(1);
    expect(needsConfirmation(onlyAdd)).toBe(false);

    expect(diffAssignment(regions, "1", new Set(["7", "12"])).total).toBe(0);
  });

  it("filtr: Belgilangan — joriy belgilar, Logistsiz — serverdagi holat", () => {
    const draft = new Set(["7", "3"]);
    expect(filterRegions(regions, "all", draft)).toHaveLength(5);
    expect(filterRegions(regions, "checked", draft).map((item) => item.id)).toEqual(["7", "3"]);
    expect(filterRegions(regions, "free", draft).map((item) => item.id)).toEqual(["1", "3"]);
  });
});

describe("qidiruv, bosh harflar, tanlov", () => {
  it("ism yoki telefon raqamlari bo'yicha", () => {
    const item = { ...logist("1", "Aziz Rahimov"), phone_number: "+998901234567" };
    expect(matchesLogist(item, "aziz")).toBe(true);
    expect(matchesLogist(item, "90 123")).toBe(true);
    expect(matchesLogist(item, "Dilnoza")).toBe(false);
    expect(matchesLogist(item, "  ")).toBe(true);
  });

  it("bosh harflar", () => {
    expect(logistInitials("Aziz Rahimov")).toBe("AR");
    expect(logistInitials("aziz")).toBe("AZ");
    expect(logistInitials("")).toBe("");
  });

  it("?logist=<id> bo'lsa — o'sha, yo'q yoki noma'lum — birinchisi", () => {
    const list = [logist("1", "Aziz"), logist("2", "Dilnoza")];
    expect(resolveSelectedLogist(list, "2")?.id).toBe("2");
    expect(resolveSelectedLogist(list, "99")?.id).toBe("1");
    expect(resolveSelectedLogist(list, null)?.id).toBe("1");
    expect(resolveSelectedLogist([], "1")).toBeNull();
  });
});
