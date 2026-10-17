import { describe, expect, it } from "vitest";
import type { Branch } from "../../../entities/branch";
import { buildBranchTree, countBranchDescendants, flattenBranchTree } from "./branchTree";

const branch = (overrides: Partial<Branch> & Pick<Branch, "id" | "name">): Branch => ({
  type: "REGIONAL",
  level: 1,
  code: "",
  region: { id: "", name: "—" },
  district: { id: "", name: "—" },
  address: "—",
  status: "active",
  employees_count: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  parent_id: "",
  ...overrides,
});

// Maket `superadmin-branches-list-tree` tuzilmasi: HQ → Andijon viloyati → Andijon sh. → Andijon filiali → 2 PICKUP.
const HQ = branch({ id: "1", name: "Toshkent HQ", type: "HQ", level: 0, code: "TSH-HQ" });
const ANDIJON = branch({
  id: "2",
  name: "Andijon filiali",
  parent_id: "1",
  code: "AND-01",
  region: { id: "30", name: "Andijon viloyati" },
  district: { id: "301", name: "Andijon sh." },
});
const ASAKA = branch({
  id: "3",
  name: "Asaka qabul punkti",
  type: "PICKUP",
  level: 2,
  parent_id: "2",
  region: { id: "30", name: "Andijon viloyati" },
  district: { id: "302", name: "Asaka tumani" },
});
const XONOBOD = branch({ id: "4", name: "Xonobod qabul punkti", type: "PICKUP", level: 2, parent_id: "2", status: "inactive" });
const BUXORO = branch({
  id: "5",
  name: "Buxoro filiali",
  parent_id: "1",
  region: { id: "20", name: "Buxoro viloyati" },
  district: { id: "20", name: "Buxoro viloyati" },
});
const NO_REGION = branch({ id: "6", name: "Hududsiz filial", parent_id: "1" });

describe("buildBranchTree — guruhlash (eski BranchTree mantiqi)", () => {
  it("HQ yagona ildiz; bevosita bolalar viloyat → shahar/tuman guruhlarida, viloyatsizi guruhsiz (nom bo'yicha)", () => {
    const [root, ...rest] = buildBranchTree([ASAKA, NO_REGION, BUXORO, ANDIJON, HQ, XONOBOD]);
    expect(rest).toEqual([]);
    expect(root.id).toBe("1");
    expect(root.children.map((child) => [child.name, child.isVirtualGroup ?? false, child.groupType])).toEqual([
      ["Andijon viloyati", true, "region"],
      ["Buxoro viloyati", true, "region"],
      ["Hududsiz filial", false, undefined],
    ]);

    const [andijonRegion, buxoroRegion] = root.children;
    // Tuman viloyatdan farq qilsa — ichki guruh; bir xil bo'lsa — to'g'ridan viloyat ostida.
    expect(andijonRegion.children.map((child) => [child.name, child.groupType])).toEqual([["Andijon sh.", "district"]]);
    expect(buxoroRegion.children.map((child) => child.name)).toEqual(["Buxoro filiali"]);
    // Ichki filiallar (2-daraja) ota filiali ostida, nom bo'yicha.
    expect(andijonRegion.children[0].children[0].children.map((child) => child.name)).toEqual([
      "Asaka qabul punkti",
      "Xonobod qabul punkti",
    ]);
  });

  it("ota filiali ro'yxatda yo'q filial HQ ostiga qo'shiladi", () => {
    const orphan = branch({ id: "9", name: "Yetim filial", parent_id: "404", region: { id: "40", name: "Xorazm viloyati" } });
    const [root] = buildBranchTree([HQ, orphan]);
    expect(root.children[0].name).toBe("Xorazm viloyati");
    expect(root.children[0].children[0].id).toBe("9");
  });

  it("HQ yo'q bo'lsa (qidiruv natijasi) — barcha ildizlar qoladi, guruhlanmaydi", () => {
    const roots = buildBranchTree([ASAKA, BUXORO]);
    expect(roots.map((node) => node.name)).toEqual(["Buxoro filiali", "Asaka qabul punkti"]);
    expect(roots.every((node) => !node.isVirtualGroup)).toBe(true);
  });

  it("countBranchDescendants faqat haqiqiy filiallarni sanaydi («15 ta ichki filial», «3 ta filial»)", () => {
    const [root] = buildBranchTree([HQ, ANDIJON, ASAKA, XONOBOD, BUXORO, NO_REGION]);
    expect(countBranchDescendants(root)).toBe(5);
    expect(countBranchDescendants(root.children[0])).toBe(3);
    expect(countBranchDescendants(root.children[0].children[0].children[0])).toBe(2);
  });
});

describe("flattenBranchTree — ko'rinadigan qatorlar va chiziqlar", () => {
  const tree = buildBranchTree([HQ, ANDIJON, ASAKA, XONOBOD, BUXORO]);

  it("faqat ochilgan tugunlar bolalari chiqadi", () => {
    const rootOnly = flattenBranchTree(tree, (_node, depth) => depth === 0);
    expect(rootOnly.map((row) => [row.node.name, row.depth, row.expanded])).toEqual([
      ["Toshkent HQ", 0, true],
      ["Andijon viloyati", 1, false],
      ["Buxoro viloyati", 1, false],
    ]);
    expect(rootOnly[0].descendants).toBe(4);
  });

  it("hammasi ochiq: chuqurlik, oxirgi aka-uka va ajdod chiziqlari", () => {
    const rows = flattenBranchTree(tree, () => true);
    expect(rows.map((row) => [row.node.name, row.depth, row.isLast, row.guides])).toEqual([
      ["Toshkent HQ", 0, true, []],
      ["Andijon viloyati", 1, false, [true]],
      ["Andijon sh.", 2, true, [true, false]],
      ["Andijon filiali", 3, true, [true, false, false]],
      ["Asaka qabul punkti", 4, false, [true, false, false, true]],
      ["Xonobod qabul punkti", 4, true, [true, false, false, false]],
      ["Buxoro viloyati", 1, true, [false]],
      ["Buxoro filiali", 2, true, [false, false]],
    ]);
    expect(rows.find((row) => row.node.name === "Xonobod qabul punkti")?.hasChildren).toBe(false);
  });
});
