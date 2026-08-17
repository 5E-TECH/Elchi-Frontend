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

const ROOT_CHILDREN_PAGE_SIZE = 5;

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
  if (!looseRoots.length) return roots;

  hqRoot.children.push(...looseRoots);
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
  const typeLabel = node.type ? t(`branchTypes.${node.type}`) : t("branchTypes.unknown");
  const level = node.level ?? 0;
  const regionName = node.region?.name ?? "—";
  const districtName = node.district?.name ?? "—";
  const address = node.address || "—";
  const toneClass =
    typeToneMap[node.type ?? ""] ??
    "border-border-soft bg-main-soft text-text-muted dark:text-white/80";
  const cardClass = node.type === "HQ"
    ? "border-amber-300/45 bg-surface-elevated ring-4 ring-amber-300/10 hover:border-amber-300/70 dark:bg-surface-elevated-dark"
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
        onClick={() => navigate(`/branches/${node.id}`)}
        className="flex min-h-0 flex-1 flex-col text-left"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main/15 text-main dark:text-white">
            {node.type === "HQ" ? <Building2 size={18} /> : <GitBranch size={18} />}
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

  return (
    <li className={`relative flex flex-col items-center ${isRoot ? "w-full" : depth === 1 ? "w-[15.5rem] shrink-0" : "w-full"}`}>
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
                  ? "relative grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,15.5rem),1fr))] items-start justify-items-center gap-x-5 gap-y-8 px-1 pt-1 sm:px-2"
                  : "relative flex w-full flex-col items-center gap-8"
              }
            >
              {node.children.length > 1 && isRootChildrenPanel ? (
                <span className="absolute left-6 right-6 top-0 h-[5px] rounded-full bg-gradient-to-r from-transparent via-teal-300/45 to-transparent shadow-[0_0_16px_rgba(45,212,191,0.18)]" />
              ) : null}
              {visibleChildren.map((child) => (
                <div
                  key={child.id}
                  className={
                    isRootChildrenPanel
                      ? "relative flex w-full min-w-0 max-w-[15.5rem] justify-center pt-6"
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
              ))}
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
  const defaultExpandedIds = useMemo(() => new Set(roots.map((node) => node.id)), [roots]);
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);
  const visibleExpandedIds = expandedIds ?? defaultExpandedIds;

  if (loading) {
    return <Spin />;
  }

  if (!roots.length) {
    return <Empty description={t("list.notFound")} />;
  }

  const toggleNode = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current ?? defaultExpandedIds);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border-soft bg-primary px-2.5 py-5 shadow-sm dark:bg-primarydark sm:px-5 sm:py-8">
      <div className="pointer-events-none absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-main/20 to-transparent dark:via-teal-100/18" />
      <div className="relative z-10 flex w-full justify-center">
        <ul className="flex min-w-0 w-full flex-col items-center gap-8 px-0 sm:gap-10 sm:px-2 lg:px-4">
          {roots.map((node) => (
            <BranchTreeItem
              key={node.id}
              node={node}
              onEdit={onEdit}
              expandedIds={visibleExpandedIds}
              onToggle={toggleNode}
              isRoot
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default memo(BranchTree);
