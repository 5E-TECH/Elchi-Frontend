import { Button, Empty, Spin } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, ChevronRight, GitBranch, Leaf, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BranchStatusBadge, type Branch } from "../../../entities/branch";
import { DeleteBranchButton } from "../../../features/branch-delete";

type BranchTreeNode = Branch & {
  children: BranchTreeNode[];
  isPreview?: boolean;
};

interface BranchTreeProps {
  data: Branch[];
  loading?: boolean;
  onEdit: (branch: Branch) => void;
}

const typeToneMap: Record<string, string> = {
  HQ: "border-amber-400/45 bg-amber-400/14 text-amber-100",
  CITY: "border-sky-400/40 bg-sky-400/13 text-sky-100",
  REGIONAL: "border-violet-400/42 bg-violet-400/14 text-violet-100",
  DISTRICT: "border-emerald-400/38 bg-emerald-400/13 text-emerald-100",
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
  if (!looseRoots.length) return roots;

  hqRoot.children.push(...looseRoots);
  sortNodes(hqRoot.children);

  return [hqRoot];
};

const createPreviewBranch = (
  root: BranchTreeNode,
  id: string,
  name: string,
  type: BranchTreeNode["type"],
  code: string,
  level: number,
  parentId: string,
): BranchTreeNode => ({
  ...root,
  id,
  name,
  type,
  code,
  level,
  parent_id: parentId,
  parent: { id: parentId, name: root.name },
  address: root.address,
  employees_count: 0,
  isPreview: true,
  children: [],
});

const withPreviewBranches = (roots: BranchTreeNode[]) => {
  if (roots.length !== 1) return roots;

  const root = roots[0];
  if ((root.type !== "HQ" && root.level !== 0) || root.children.length > 0) return roots;

  const samarqand = createPreviewBranch(root, "preview-sam", "Samarqand", "REGIONAL", "SAM", 1, root.id);
  const chilonzor = createPreviewBranch(root, "preview-tsh-chl", "Toshkent Chilonzor", "CITY", "TSH-CHL", 1, root.id);
  const kattaqorgon = createPreviewBranch(
    root,
    "preview-sam-ktq",
    "Kattaqo'rg'on",
    "DISTRICT",
    "SAM-KTQ",
    2,
    samarqand.id,
  );

  samarqand.children.push(kattaqorgon);

  return [{ ...root, children: [samarqand, chilonzor] }];
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
  const toneClass = typeToneMap[node.type ?? ""] ?? "border-white/15 bg-white/8 text-white/80";
  const disabled = Boolean(node.isPreview);
  const cardClass = node.isPreview
    ? "border-dashed border-teal-300/28 bg-[#343057]/82 opacity-85"
    : node.type === "HQ"
      ? "border-amber-300/45 bg-[#3d3b67] ring-4 ring-amber-300/10 hover:border-amber-300/70"
      : "border-white/14 bg-[#363960] hover:border-main/60";

  return (
    <div className={`relative mx-auto flex h-[170px] w-full max-w-[17rem] flex-col rounded-[28px] border p-4 text-left shadow-[0_16px_28px_rgba(8,10,28,0.2)] transition-colors ${cardClass}`}>
      {node.type !== "HQ" ? (
        <span className="pointer-events-none absolute -left-4 top-8 hidden h-9 w-9 rotate-[-28deg] items-center justify-center rounded-full border border-teal-300/22 bg-teal-400/12 text-teal-100 md:flex">
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
          className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-teal-300/25 bg-[#2e365e] text-teal-100 shadow-[0_10px_20px_rgba(8,10,28,0.24)] transition-colors hover:border-teal-200/40 hover:bg-[#33406f]"
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
          if (!disabled) navigate(`/branches/${node.id}`);
        }}
        className="flex min-h-0 flex-1 flex-col text-left disabled:cursor-default"
        disabled={disabled}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-main/15 text-main">
            {node.type === "HQ" ? <Building2 size={18} /> : <GitBranch size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[1.05rem] font-extrabold text-white">{node.name}</h3>
              {node.isPreview ? (
                <span className="shrink-0 rounded-full bg-emerald-400/12 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                  Preview
                </span>
              ) : (
                <BranchStatusBadge status={node.status} />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {node.code ? (
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-bold text-white/75">
                  {node.code}
                </span>
              ) : null}
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>
                {typeLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-white/65">
                {t("tree.level", { level })}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 items-start gap-2 text-xs leading-5 text-white/55">
          <MapPin size={13} className="mt-1 shrink-0" />
          <span className="line-clamp-2 min-h-[2.5rem]">
            {address} · {regionName}, {districtName}
          </span>
        </div>
      </button>

      {!node.isPreview ? (
        <div className="mt-4 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            icon={<ArrowRight size={15} />}
            className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-white/10 !bg-white/8 !p-0 !text-white hover:!border-main hover:!text-main"
            onClick={() => navigate(`/branches/${node.id}`)}
            aria-label={tCommon("open")}
            title={tCommon("open")}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-white/10 !bg-white/8 !p-0 !text-white hover:!border-main hover:!text-main"
            onClick={() => onEdit(node)}
            aria-label={t("actions.edit")}
            title={t("actions.edit")}
          />
          <DeleteBranchButton id={node.id} className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-rose-500/30 !bg-rose-500/12 !p-0 !text-rose-300 hover:!border-rose-400/60 hover:!bg-rose-500/18" />
        </div>
      ) : null}
    </div>
  );
};

const BranchTreeItem = ({
  node,
  onEdit,
  expandedIds,
  onToggle,
}: {
  node: BranchTreeNode;
  onEdit: (branch: Branch) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li className="relative flex flex-col items-center">
      <BranchTreeNodeCard
        node={node}
        onEdit={onEdit}
        isExpanded={isExpanded}
        onToggleChildren={hasChildren ? () => onToggle(node.id) : undefined}
      />

      {hasChildren && isExpanded && (
        <div className="relative mt-10 flex justify-center">
          <span className="absolute -top-10 left-1/2 h-10 w-[7px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-200/80 via-teal-400/55 to-main/40 shadow-[0_0_16px_rgba(45,212,191,0.26)]" />
          <div className="relative flex max-w-full flex-wrap items-start justify-center gap-8">
            {node.children.length > 1 && (
              <span className="absolute -top-5 left-[12%] right-[12%] h-[7px] rounded-full bg-gradient-to-r from-transparent via-teal-300/45 to-transparent shadow-[0_0_16px_rgba(45,212,191,0.18)]" />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="relative flex w-full justify-center pt-6 sm:w-auto">
                <span className="absolute left-1/2 top-[-1px] h-6 w-[6px] -translate-x-1/2 rounded-full bg-teal-300/44" />
                <BranchTreeItem
                  node={child}
                  onEdit={onEdit}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
};

const BranchTree = ({ data, loading, onEdit }: BranchTreeProps) => {
  const { t } = useTranslation("branches");
  const roots = useMemo(() => withPreviewBranches(buildBranchTree(data)), [data]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set(roots.map((node) => node.id)));
  }, [roots]);

  if (loading) {
    return <Spin />;
  }

  if (!roots.length) {
    return <Empty description={t("list.notFound")} />;
  }

  const toggleNode = (id: string) => {
    setExpandedIds((current) => {
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.13),transparent_28%),radial-gradient(circle_at_bottom,rgba(124,58,237,0.12),transparent_40%),linear-gradient(180deg,#2f3155_0%,#292544_100%)] px-4 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-teal-100/18 to-transparent" />
      <div className="pointer-events-none absolute bottom-5 left-1/2 h-8 w-[32rem] max-w-[70%] -translate-x-1/2 rounded-[100%] bg-black/8 blur-sm" />
      <div className="relative z-10 flex w-full justify-center">
        <ul className="flex w-full flex-col items-center gap-12 px-2 sm:px-4">
          {roots.map((node) => (
            <BranchTreeItem
              key={node.id}
              node={node}
              onEdit={onEdit}
              expandedIds={expandedIds}
              onToggle={toggleNode}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default memo(BranchTree);
