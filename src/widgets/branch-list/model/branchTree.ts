import type { Branch } from "../../../entities/branch";

/**
 * FILIALLAR DARAXTI — sof mantiq (UI'siz, test bilan). Ilgari `ui/BranchTree.tsx` ichida edi; dizayn v2 da
 * ko'rinish jadval-daraxtga (`superadmin-branches-list-tree`) o'tdi, qurish va guruhlash qoidalari o'zgarmadi:
 *
 *  1. `parent_id` bo'yicha daraxt; ota filiali ro'yxatda yo'q filial — ildiz.
 *  2. Tartib: daraja (`level`) → HQ birinchi → nom.
 *  3. HQ (yoki 0-daraja) topilsa — yagona ildiz: qolgan ildizlar uning bolalariga qo'shiladi va HQ ning
 *     bevosita bolalari VILOYAT → SHAHAR/TUMAN virtual guruhlariga bo'linadi (viloyati yo'q filial —
 *     guruhsiz; tumani viloyat bilan bir xil yoki yo'q — to'g'ridan viloyat ostida).
 *  4. HQ topilmasa (masalan qidiruv natijasida) — barcha ildizlar o'z holicha.
 */

export type BranchTreeGroupType = "region" | "district";

export type BranchTreeNode = Branch & {
  children: BranchTreeNode[];
  isVirtualGroup?: boolean;
  groupType?: BranchTreeGroupType;
};

const getAreaId = (branch: Branch, key: "region" | "district") => {
  const area = branch[key];
  const id = area?.id ? String(area.id) : "";
  const name = area?.name?.trim() || "—";

  return id || name;
};

const getAreaName = (branch: Branch, key: "region" | "district") => branch[key]?.name?.trim() || "—";

const createVirtualGroupNode = ({
  id,
  name,
  level,
  parentId,
  groupType,
}: {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  groupType: BranchTreeGroupType;
}): BranchTreeNode => ({
  id,
  name,
  parent_id: parentId,
  type: groupType === "region" ? "REGIONAL" : "PICKUP",
  level,
  code: "",
  region: { id, name },
  district: { id, name },
  address: name,
  status: "active",
  employees_count: 0,
  created_at: "",
  children: [],
  isVirtualGroup: true,
  groupType,
});

const groupRootBranchesByArea = (root: BranchTreeNode) => {
  const regionGroups = new Map<string, BranchTreeNode>();
  const ungrouped: BranchTreeNode[] = [];

  root.children.forEach((branch) => {
    const regionKey = getAreaId(branch, "region");
    if (!regionKey || regionKey === "—") {
      ungrouped.push(branch);
      return;
    }

    let regionGroup = regionGroups.get(regionKey);
    if (!regionGroup) {
      regionGroup = createVirtualGroupNode({
        id: `region-${regionKey}`,
        name: getAreaName(branch, "region"),
        level: (root.level ?? 0) + 1,
        parentId: root.id,
        groupType: "region",
      });
      regionGroups.set(regionKey, regionGroup);
    }

    const districtKey = getAreaId(branch, "district");
    const shouldNestDistrict = districtKey && districtKey !== "—" && districtKey !== regionKey;

    if (!shouldNestDistrict) {
      regionGroup.children.push(branch);
      return;
    }

    const districtId = `${regionGroup.id}-district-${districtKey}`;
    let districtGroup = regionGroup.children.find((child) => child.id === districtId);
    if (!districtGroup) {
      districtGroup = createVirtualGroupNode({
        id: districtId,
        name: getAreaName(branch, "district"),
        level: (root.level ?? 0) + 2,
        parentId: regionGroup.id,
        groupType: "district",
      });
      regionGroup.children.push(districtGroup);
    }

    districtGroup.children.push(branch);
  });

  root.children = [...Array.from(regionGroups.values()), ...ungrouped];
};

const sortNodes = (nodes: BranchTreeNode[]) => {
  nodes.sort((left, right) => {
    const leftLevel = left.level ?? 0;
    const rightLevel = right.level ?? 0;

    if (leftLevel !== rightLevel) return leftLevel - rightLevel;
    if (left.type === "HQ" && right.type !== "HQ") return -1;
    if (right.type === "HQ" && left.type !== "HQ") return 1;
    return left.name.localeCompare(right.name);
  });

  nodes.forEach((node) => sortNodes(node.children));
};

/** Tekis ro'yxatdan daraxt (yuqoridagi qoidalar). */
export const buildBranchTree = (branches: readonly Branch[]): BranchTreeNode[] => {
  const nodeMap = new Map<string, BranchTreeNode>();

  branches.forEach((branch) => {
    nodeMap.set(branch.id, { ...branch, children: [] });
  });

  const roots: BranchTreeNode[] = [];

  nodeMap.forEach((node) => {
    const parentId = node.parent_id;
    const parentNode = parentId && parentId !== node.id ? nodeMap.get(parentId) : undefined;

    if (parentNode) {
      parentNode.children.push(node);
      return;
    }

    roots.push(node);
  });

  sortNodes(roots);

  const hqRoot = roots.find((node) => node.type === "HQ" || node.level === 0);
  if (!hqRoot) return roots;

  const looseRoots = roots.filter((node) => node.id !== hqRoot.id);
  if (looseRoots.length) {
    hqRoot.children.push(...looseRoots);
  }

  groupRootBranchesByArea(hqRoot);
  sortNodes(hqRoot.children);

  return [hqRoot];
};

/** Haqiqiy filial avlodlari soni (virtual guruhlar sanalmaydi): «15 ta ichki filial», «3 ta filial». */
export const countBranchDescendants = (node: BranchTreeNode): number =>
  node.children.reduce((sum, child) => sum + (child.isVirtualGroup ? 0 : 1) + countBranchDescendants(child), 0);

export type BranchTreeRow = {
  node: BranchTreeNode;
  /** 0 — ildiz. */
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Haqiqiy avlodlar soni. */
  descendants: number;
  /** Shu tugun aka-ukalari orasida oxirgisimi (chiziq shu qatorda tugaydi). */
  isLast: boolean;
  /**
   * Chap chiziqlar: `guides[j]` — `j`-ustundagi (ajdod) chiziq shu qatordan pastga davom etadimi
   * (ajdodning keyingi aka-ukasi bor). Uzunligi `depth`; oxirgi element — shu qatorning o'z bog'lanishi.
   */
  guides: boolean[];
};

/**
 * Ko'rinadigan qatorlar (ochilgan tugunlar bolalari bilan) — jadval-daraxt va telefon ro'yxati uchun.
 * `isExpanded(node, depth)` — tugun ochiqmi (sahifa holati).
 */
export const flattenBranchTree = (
  roots: readonly BranchTreeNode[],
  isExpanded: (node: BranchTreeNode, depth: number) => boolean,
): BranchTreeRow[] => {
  const rows: BranchTreeRow[] = [];

  const walk = (nodes: readonly BranchTreeNode[], depth: number, ancestors: boolean[]) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && isExpanded(node, depth);
      const guides = depth === 0 ? [] : [...ancestors, !isLast];

      rows.push({ node, depth, hasChildren, expanded, descendants: countBranchDescendants(node), isLast, guides });

      if (expanded) {
        walk(node.children, depth + 1, depth === 0 ? [] : [...ancestors, !isLast]);
      }
    });
  };

  walk(roots, 0, []);
  return rows;
};
