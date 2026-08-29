import { Button, Empty, Spin } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, ChevronLeft, ChevronRight, GitBranch, Leaf, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BranchStatusBadge, type Branch } from "../../../entities/branch";
import { DeleteBranchButton } from "../../../features/branch-delete";

type BranchTreeNode = Branch & {
  children: BranchTreeNode[];
  isVirtualGroup?: boolean;
  groupType?: "region" | "district";
};

interface BranchTreeProps {
  data: Branch[];
  loading?: boolean;
  onEdit: (branch: Branch) => void;
}

const typeToneMap: Record<string, string> = {
  HQ: "border-amber-400/45 bg-amber-400/12 text-amber-700 dark:text-amber-100",
  CITY: "border-sky-400/40 bg-sky-400/12 text-sky-700 dark:text-sky-100",
  REGIONAL: "border-violet-400/42 bg-violet-400/12 text-violet-700 dark:text-violet-100",
  DISTRICT: "border-emerald-400/38 bg-emerald-400/12 text-emerald-700 dark:text-emerald-100",
};

const ROOT_CHILDREN_PAGE_SIZE = 1000;

const getAreaId = (branch: Branch, key: "region" | "district") => {
  const area = branch[key];
  const id = area?.id ? String(area.id) : "";
  const name = area?.name?.trim() || "—";

  return id || name;
};

const getAreaName = (branch: Branch, key: "region" | "district") =>
  branch[key]?.name?.trim() || "—";

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
  groupType: "region" | "district";
}): BranchTreeNode => ({
  id,
  name,
  parent_id: parentId,
  type: groupType === "region" ? "REGIONAL" : "PICKUP",
  level,
  code: groupType === "region" ? "Viloyat" : "Shahar/Tuman",
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
  const directChildren = root.children;
  const regionGroups = new Map<string, BranchTreeNode>();
  const ungrouped: BranchTreeNode[] = [];

  directChildren.forEach((branch) => {
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

const buildBranchTree = (branches: Branch[]) => {
  const nodeMap = new Map<string, BranchTreeNode>();

  branches.forEach((branch) => {
    nodeMap.set(branch.id, { ...branch, children: [] });
  });

  const roots: BranchTreeNode[] = [];

  nodeMap.forEach((node) => {
    const parentId = node.parent_id;
    const parentNode = parentId ? nodeMap.get(parentId) : undefined;

    if (parentNode) {
      parentNode.children.push(node);
      return;
    }

    roots.push(node);
  });

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

const BranchTreeNodeCard = ({
  node,
  onEdit,
  isExpanded,
  onToggleChildren,
}: {
  node: BranchTreeNode;
  onEdit: (branch: Branch) => void;
  isExpanded: boolean;
  onToggleChildren?: () => void;
}) => {
  const { t } = useTranslation("branches");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const typeLabel = node.isVirtualGroup
    ? node.groupType === "region"
      ? t("tree.regionGroup")
      : t("tree.districtGroup")
    : node.type ? t(`branchTypes.${node.type}`) : t("branchTypes.unknown");
  const level = node.level ?? 0;
  const regionName = node.region?.name ?? "—";
  const districtName = node.district?.name ?? "—";
  const address = node.address || "—";
  const toneClass =
    typeToneMap[node.type ?? ""] ??
    "border-border-soft bg-main-soft text-text-muted dark:text-white/80";
  const cardClass = node.type === "HQ"
    ? "border-amber-300/45 bg-surface-elevated ring-4 ring-amber-300/10 hover:border-amber-300/70 dark:bg-surface-elevated-dark"
    : node.isVirtualGroup
      ? "border-teal-300/40 bg-teal-300/10 ring-2 ring-teal-300/10 hover:border-teal-300/65 dark:border-teal-200/18 dark:bg-teal-200/8"
      : "border-border-soft bg-surface-elevated hover:border-main/60 dark:border-white/10 dark:bg-surface-elevated-dark";

  return (
    <div
      data-branch-tree-card={node.id}
      className={`relative mx-auto flex min-h-[136px] w-full min-w-0 max-w-[15.5rem] flex-col rounded-2xl border p-3 text-left shadow-[0_12px_26px_rgba(39,44,82,0.10)] transition-colors dark:shadow-[0_14px_28px_rgba(8,10,28,0.20)] sm:p-3.5 ${cardClass}`}
    >
      {node.type !== "HQ" ? (
        <span className="pointer-events-none absolute -left-4 top-7 hidden h-8 w-8 rotate-[-28deg] items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/10 text-teal-600 dark:text-teal-100 md:flex">
          <Leaf size={15} />
        </span>
      ) : null}
      {onToggleChildren ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleChildren();
          }}
          aria-label={isExpanded ? t("tree.collapse") : t("tree.expand")}
          title={isExpanded ? t("tree.collapse") : t("tree.expand")}
          className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-teal-400/25 bg-surface-elevated text-teal-600 shadow-[0_10px_20px_rgba(39,44,82,0.16)] transition-colors hover:border-teal-400/45 hover:bg-main-soft dark:bg-primarydark dark:text-teal-100 dark:shadow-[0_10px_20px_rgba(8,10,28,0.24)] dark:hover:bg-primarydark/80"
        >
          <ChevronRight
            size={16}
            className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (!node.isVirtualGroup) navigate(`/branches/${node.id}`);
          else onToggleChildren?.();
        }}
        className="flex min-h-0 flex-1 flex-col text-left"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main/15 text-main dark:text-white">
{node.type === "HQ" || node.isVirtualGroup ? <Building2 size={18} /> : <GitBranch size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
              <h3 className="truncate text-[0.98rem] font-extrabold text-maindark dark:text-white">{node.name}</h3>
              <BranchStatusBadge status={node.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {node.code ? (
                <span className="rounded-full border border-border-soft bg-main-soft px-2 py-0.5 text-[11px] font-bold text-text-muted dark:border-white/10 dark:bg-white/8 dark:text-white/75">
                  {node.code}
                </span>
              ) : null}
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>
                {typeLabel}
              </span>
              <span className="rounded-full border border-border-soft bg-main-soft px-2 py-0.5 text-[11px] font-semibold text-text-muted dark:border-white/10 dark:bg-white/8 dark:text-white/65">
                {t("tree.level", { level })}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex min-h-0 flex-1 items-start gap-2 text-xs leading-5 text-text-muted dark:text-white/55">
          <MapPin size={13} className="mt-1 shrink-0" />
          <span className="line-clamp-2 min-h-[2.25rem]">
            {address} · {regionName}, {districtName}
          </span>
        </div>
      </button>

      {onToggleChildren ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleChildren();
          }}
          className={`mt-3 flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-extrabold transition-all sm:px-3 ${
            isExpanded
              ? "border-teal-400/45 bg-teal-400/12 text-teal-700 shadow-[0_8px_20px_rgba(20,184,166,0.14)] dark:text-teal-100"
              : "border-main/45 bg-main/15 text-main shadow-[0_8px_22px_rgba(109,72,217,0.16)] hover:border-main hover:bg-main/20 dark:text-white"
          }`}
          aria-label={isExpanded ? t("tree.collapse") : t("tree.expand")}
          title={isExpanded ? t("tree.collapse") : t("tree.expand")}
        >
          <span className="min-w-0 truncate">{t("tree.childCount", { count: node.children.length })}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            {isExpanded ? t("tree.hideChildren") : t("tree.showChildren")}
            <ChevronRight
              size={15}
              className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            />
          </span>
        </button>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        {!node.isVirtualGroup ? (
          <>
            <Button
              size="small"
              icon={<ArrowRight size={15} />}
              className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-border-soft !bg-main-soft !p-0 !text-maindark hover:!border-main hover:!text-main dark:!border-white/10 dark:!bg-white/8 dark:!text-white"
              onClick={() => navigate(`/branches/${node.id}`)}
              aria-label={tCommon("open")}
              title={tCommon("open")}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-border-soft !bg-main-soft !p-0 !text-maindark hover:!border-main hover:!text-main dark:!border-white/10 dark:!bg-white/8 dark:!text-white"
              onClick={() => onEdit(node)}
              aria-label={t("actions.edit")}
              title={t("actions.edit")}
            />
            <DeleteBranchButton id={node.id} className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-rose-300/60 !bg-rose-50 !p-0 !text-rose-600 hover:!border-rose-400/70 hover:!bg-rose-100 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18" />
          </>
        ) : null}
      </div>
    </div>
  );
};

const BranchAreaGroupButton = ({
  node,
  expandedIds,
  onToggle,
}: {
  node: BranchTreeNode;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) => {
  const { t } = useTranslation("branches");
  const isExpanded = expandedIds.has(node.id);
  const childCount = node.children.length;

  return (
    <button
      type="button"
      onClick={() => onToggle(node.id)}
      className={`flex min-h-[4.25rem] w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        isExpanded
          ? "border-teal-300/55 bg-teal-300/14 text-teal-800 shadow-[0_10px_22px_rgba(20,184,166,0.12)] dark:text-teal-100"
          : "border-border-soft bg-main-soft/80 text-maindark hover:border-main/55 hover:bg-main/12 dark:border-white/10 dark:bg-white/7 dark:text-white"
      }`}
      aria-expanded={isExpanded}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-main/15 text-main dark:text-white">
          <Building2 size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold">{node.name}</span>
          <span className="mt-1 block truncate text-xs font-semibold text-text-muted dark:text-white/55">
            {node.groupType === "region" ? t("tree.regionGroup") : t("tree.districtGroup")} · {t("tree.childCount", { count: childCount })}
          </span>
        </span>
      </span>
      <ChevronRight size={18} className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
    </button>
  );
};

const BranchAreaGroupPanel = ({
  node,
  onEdit,
  expandedIds,
  onToggle,
  depth,
}: {
  node: BranchTreeNode;
  onEdit: (branch: Branch) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
}) => {
  if (!expandedIds.has(node.id)) return null;

  return (
    <div className="mt-5 w-full rounded-2xl border border-border-soft bg-surface-elevated/65 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex w-full flex-wrap items-start justify-center gap-5">
        {node.children.map((child) => (
          <div key={child.id} className="w-[15.5rem] min-w-0 shrink-0">
            <BranchTreeItem
              node={child}
              onEdit={onEdit}
              expandedIds={expandedIds}
              onToggle={onToggle}
              depth={depth + 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
const BranchTreeItem = ({
  node,
  onEdit,
  expandedIds,
  onToggle,
  isRoot = false,
  depth = 0,
}: {
  node: BranchTreeNode;
  onEdit: (branch: Branch) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  isRoot?: boolean;
  depth?: number;
}) => {
  const { t } = useTranslation("branches");
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isRootChildrenPanel = isRoot && hasChildren && isExpanded;
  const [rootChildrenPage, setRootChildrenPage] = useState(0);
  const rootChildrenPageCount = isRootChildrenPanel
    ? Math.max(1, Math.ceil(node.children.length / ROOT_CHILDREN_PAGE_SIZE))
    : 1;
  const safeRootChildrenPage = Math.min(rootChildrenPage, rootChildrenPageCount - 1);
  const visibleChildren = isRootChildrenPanel
    ? node.children.slice(
        safeRootChildrenPage * ROOT_CHILDREN_PAGE_SIZE,
        safeRootChildrenPage * ROOT_CHILDREN_PAGE_SIZE + ROOT_CHILDREN_PAGE_SIZE,
      )
    : node.children;

  const widthClass = isRoot ? "w-full" : depth <= 2 ? "w-full" : "w-[15.5rem] shrink-0";

  return (
    <li className={`relative flex flex-col items-center ${widthClass}`}>
      <div
        className={
          isRoot
            ? "relative z-10 flex w-full justify-center rounded-2xl border border-amber-300/25 bg-amber-300/8 px-4 py-4 dark:border-amber-200/15 dark:bg-amber-200/5"
            : "relative z-10"
        }
      >
        <BranchTreeNodeCard
          node={node}
          onEdit={onEdit}
          isExpanded={isExpanded}
          onToggleChildren={hasChildren ? () => onToggle(node.id) : undefined}
        />
      </div>

      {hasChildren && isExpanded && (
        <div className={`relative flex w-full justify-center ${isRoot ? "mt-8" : "mt-10"}`}>
          <span className={`absolute left-1/2 w-[7px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-200/80 via-teal-400/55 to-main/40 shadow-[0_0_16px_rgba(45,212,191,0.26)] ${isRoot ? "-top-8 h-8" : "-top-10 h-10"}`} />
          <div
            className={
              isRootChildrenPanel
                ? "relative w-full overflow-hidden rounded-2xl border border-border-soft bg-surface-elevated/70 px-3 py-6 dark:border-white/10 dark:bg-white/5 sm:px-4"
                : "relative flex w-full justify-center"
            }
          >
            {isRootChildrenPanel && rootChildrenPageCount > 1 ? (
              <div className="mb-4 flex items-center justify-end gap-2">
                <span className="rounded-full border border-border-soft bg-main-soft px-3 py-1 text-xs font-bold text-text-muted dark:border-white/10 dark:bg-white/8 dark:text-white/70">
                  {safeRootChildrenPage + 1} / {rootChildrenPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setRootChildrenPage((page) => Math.max(page - 1, 0))}
                  disabled={safeRootChildrenPage === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft bg-main-soft text-maindark transition-colors hover:border-main hover:text-main disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/8 dark:text-white"
                  aria-label={t("tree.previousPage")}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setRootChildrenPage((page) => Math.min(page + 1, rootChildrenPageCount - 1))}
                  disabled={safeRootChildrenPage >= rootChildrenPageCount - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft bg-main-soft text-maindark transition-colors hover:border-main hover:text-main disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/8 dark:text-white"
                  aria-label={t("tree.nextPage")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
            <div
              data-testid={isRootChildrenPanel ? "branch-tree-root-grid" : undefined}
              className={
                isRootChildrenPanel
                  ? "relative grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-3 px-1 pt-1 sm:px-2"
                  : "relative flex w-full flex-col items-center gap-8"
              }
            >
              {node.children.length > 1 && isRootChildrenPanel ? (
                <span className="absolute left-6 right-6 top-0 h-[5px] rounded-full bg-gradient-to-r from-transparent via-teal-300/45 to-transparent shadow-[0_0_16px_rgba(45,212,191,0.18)]" />
              ) : null}
              {visibleChildren.map((child) => {
                if (isRootChildrenPanel && child.isVirtualGroup) {
                  return (
                    <BranchAreaGroupButton
                      key={child.id}
                      node={child}
                      expandedIds={expandedIds}
                      onToggle={onToggle}
                    />
                  );
                }

                return (
                  <div
                    key={child.id}
                    className={
                      isRootChildrenPanel
                        ? "relative flex w-full min-w-0 justify-center pt-6"
                        : "relative flex w-full justify-center pt-6"
                    }
                  >
                    <span className="absolute left-1/2 top-[-1px] h-6 w-[6px] -translate-x-1/2 rounded-full bg-teal-300/44" />
                    <BranchTreeItem
                      node={child}
                      onEdit={onEdit}
                      expandedIds={expandedIds}
                      onToggle={onToggle}
                      depth={depth + 1}
                    />
                  </div>
                );
              })}
              {isRootChildrenPanel ? (
                <div className="col-span-full w-full">
                  {visibleChildren
                    .filter((child) => child.isVirtualGroup)
                    .map((child) => (
                      <BranchAreaGroupPanel
                        key={`${child.id}-panel`}
                        node={child}
                        onEdit={onEdit}
                        expandedIds={expandedIds}
                        onToggle={onToggle}
                        depth={depth + 1}
                      />
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </li>
  );
};

const BranchTree = ({ data, loading, onEdit }: BranchTreeProps) => {
  const { t } = useTranslation("branches");
  const roots = useMemo(() => buildBranchTree(data), [data]);
  const primaryRoot = roots[0];
  const rootGroupIds = useMemo(
    () => new Set((primaryRoot?.children ?? []).filter((child) => child.isVirtualGroup).map((child) => child.id)),
    [primaryRoot],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (loading) {
    return <Spin />;
  }

  if (!primaryRoot) {
    return <Empty description={t("list.notFound")} />;
  }

  const toggleNode = (id: string) => {
    setExpandedIds((current) => {
      if (rootGroupIds.has(id)) {
        return current.has(id) ? new Set() : new Set([id]);
      }

      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border-soft bg-primary px-3 py-5 shadow-sm dark:bg-primarydark sm:px-5 sm:py-6">
      <div className="pointer-events-none absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-main/20 to-transparent dark:via-teal-100/18" />

      <div className="relative z-10 flex justify-center">
        <BranchTreeNodeCard
          node={primaryRoot}
          onEdit={onEdit}
          isExpanded={false}
        />
      </div>

      {primaryRoot.children.length ? (
        <div className="relative z-10 mt-7">
          <span className="mx-auto mb-4 block h-8 w-[7px] rounded-full bg-gradient-to-b from-teal-200/80 via-teal-400/55 to-main/40 shadow-[0_0_16px_rgba(45,212,191,0.26)]" />

          <div className="rounded-2xl border border-border-soft bg-surface-elevated/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div
              data-testid="branch-tree-root-grid"
              className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-3"
            >
              {primaryRoot.children.map((child) => {
                if (child.isVirtualGroup) {
                  return (
                    <BranchAreaGroupButton
                      key={child.id}
                      node={child}
                      expandedIds={expandedIds}
                      onToggle={toggleNode}
                    />
                  );
                }

                return (
                  <div key={child.id} className="flex min-w-0 justify-center">
                    <BranchTreeItem
                      node={child}
                      onEdit={onEdit}
                      expandedIds={expandedIds}
                      onToggle={toggleNode}
                      depth={1}
                    />
                  </div>
                );
              })}
            </div>

            {primaryRoot.children.map((child) =>
              child.isVirtualGroup ? (
                <BranchAreaGroupPanel
                  key={`${child.id}-panel`}
                  node={child}
                  onEdit={onEdit}
                  expandedIds={expandedIds}
                  onToggle={toggleNode}
                  depth={1}
                />
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default memo(BranchTree);
