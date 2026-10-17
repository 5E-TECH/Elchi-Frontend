// dizayn-v2: superadmin-branches-list-tree
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Branch } from "../../../entities/branch";
import {
  branchAreaText,
  branchStatusLabel,
  branchStatusTone,
  branchTypeLabel,
  knownText,
} from "../../../features/branch/lib/branchDisplay";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, IconButton } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { buildBranchTree, flattenBranchTree, type BranchTreeNode, type BranchTreeRow } from "../model/branchTree";
import { BranchRowMenu } from "./BranchRowMenu";

interface BranchTreeProps {
  data: readonly Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onOpen: (branch: Branch) => void;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi. */
  busy?: boolean;
}

/* ─── Klasslar (CODE-MAP 2.6: `.el-table`, `.el-list-item`) ──────────────────── */

const TH =
  "h-10 whitespace-nowrap border-b border-border bg-sunken px-4 text-left text-xs font-semibold uppercase " +
  "tracking-[.04em] text-text-muted";
const TD = "h-14 border-b border-border px-4 py-2 align-middle text-text";
const SUB = "whitespace-nowrap text-[13px] text-text-muted";
/** Daraxt chizig'i (`--border-strong`, 1 px). */
const GUIDE = "pointer-events-none absolute bg-border-strong";

/** Desktop: bir daraja — 28 px; chevron 32 px (markazi 16), katak chekkasi 16 px. */
const DESKTOP = { step: 28, origin: 32, elbow: 12, leafElbow: 40 } as const;
/** Telefon: bir daraja — 20 px, chevron o'ngda; chiziqlar matn chap tomonida. */
const PHONE = { step: 20, origin: 22, elbow: 10 } as const;

/**
 * Chap chiziqlar (bezak, `aria-hidden`): ajdodlar ustunlari, shu qatorning burchagi (─) va ochiq tugundan
 * pastga tushuvchi chiziq. Katak (`td` / qator) `relative` bo'lishi kerak.
 */
const TreeGuides = ({
  row,
  step,
  origin,
  elbow,
  stubTop,
}: {
  row: BranchTreeRow;
  step: number;
  origin: number;
  elbow: number;
  stubTop: string;
}) => {
  const lines: ReactNode[] = [];
  const last = row.guides.length - 1;
  row.guides.forEach((continues, column) => {
    const left = origin + column * step;
    if (column < last) {
      if (continues) lines.push(<span key={`v${column}`} className={cx(GUIDE, "top-0 -bottom-px w-px")} style={{ left }} />);
      return;
    }
    // O'z bog'lanishi: tepadan o'rtagacha (keyingi aka-uka bo'lsa — pastgacha) va gorizontal burchak.
    lines.push(
      <span
        key={`v${column}`}
        className={cx(GUIDE, "top-0 w-px", continues ? "-bottom-px" : "h-1/2")}
        style={{ left }}
      />,
      <span key={`h${column}`} className={cx(GUIDE, "top-1/2 h-px")} style={{ left, width: elbow }} />,
    );
  });
  if (row.expanded) {
    lines.push(
      <span
        key="stub"
        className={cx(GUIDE, "-bottom-px w-px")}
        style={{ left: origin + row.depth * step, top: stubTop }}
      />,
    );
  }
  return <>{lines}</>;
};

/**
 * FILIALLAR DARAXTI (maket `superadmin-branches-list-tree`) — jadval-daraxt (desktop/planshet) va telefonda
 * ro'yxat. Ildiz (HQ) sukut bo'yicha ochiq; viloyat → shahar/tuman guruhlari va ichki filiallar chevron bilan
 * ochiladi/yopiladi (tugma `aria-expanded`, Enter/Bo'sh joy). Qurish va guruhlash — `model/branchTree.ts`.
 *
 * Ustunlar: Filial («TSH-HQ · 0-daraja · 15 ta ichki filial») · Turi · Hudud va manzil (< 1024 da yashirin) ·
 * Xodimlar · Holat · amallar menyusi («Batafsil», «Tahrirlash», «O'chirish»). Guruh qatori — «Andijon viloyati ·
 * Viloyat · 3 ta filial». Telefon: «Faol · HQ · 24 ta xodim», menyu va chevron (44 px).
 */
const BranchTree = ({ data, onEdit, onDelete, onOpen, busy = false }: BranchTreeProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const roots = useMemo(() => buildBranchTree(data), [data]);
  // Ildiz sukut bo'yicha ochiq, qolganlari yopiq; `toggled` — foydalanuvchi o'zgartirganlari.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());
  const isExpanded = useCallback(
    (node: BranchTreeNode, depth: number) => (depth === 0 ? !toggled.has(node.id) : toggled.has(node.id)),
    [toggled],
  );
  const rows = useMemo(() => flattenBranchTree(roots, isExpanded), [isExpanded, roots]);
  const toggle = useCallback((id: string) => {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const count = (value: number) => formatNumberLocalized(value, { language });
  const branchHref = (node: BranchTreeNode) => `/branches/${encodeURIComponent(node.id)}`;
  const groupLabel = (node: BranchTreeNode) =>
    node.groupType === "district" ? t("tree.districtGroup") : t("tree.regionGroup");
  const groupSub = (row: BranchTreeRow) =>
    `${groupLabel(row.node)} · ${t("v2.tree.groupCount", { count: row.descendants, value: count(row.descendants) })}`;
  const branchSub = (row: BranchTreeRow) =>
    [
      knownText(row.node.code),
      t("tree.level", { level: row.node.level ?? 0 }),
      row.descendants > 0
        ? t("v2.tree.childCount", { count: row.descendants, value: count(row.descendants) })
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

  const toggleButton = (row: BranchTreeRow, size: "sm" | "lg") => (
    <IconButton
      size={size}
      icon={row.expanded ? ChevronDown : ChevronRight}
      label={t(row.expanded ? "v2.tree.collapse" : "v2.tree.expand", { name: row.node.name })}
      aria-expanded={row.expanded}
      onClick={() => toggle(row.node.id)}
    />
  );
  const statusBadge = (node: BranchTreeNode) => (
    <Badge tone={branchStatusTone(node.status)} dot>
      {branchStatusLabel(node.status, t)}
    </Badge>
  );
  const menu = (node: BranchTreeNode) => (
    <BranchRowMenu
      name={node.name}
      onOpen={() => onOpen(node)}
      onEdit={() => onEdit(node)}
      onDelete={() => onDelete(node)}
    />
  );

  // ─── Telefon: ro'yxat (`.el-list`) ───────────────────────────────────────────
  if (isPhone) {
    return (
      <ul aria-label={t("v2.tree.label")} aria-busy={busy || undefined} className={cx("flex flex-col", busy && "opacity-60")}>
        {rows.map((row) => {
          const { node } = row;
          return (
            <li
              key={node.id}
              className="relative flex min-h-14 items-center gap-2 border-b border-border py-3 pr-2 last:border-b-0"
              style={{ paddingLeft: 16 + row.depth * PHONE.step }}
            >
              <TreeGuides row={row} {...PHONE} stubTop="calc(100% - 12px)" />
              {node.isVirtualGroup ? (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-text">
                    <MapPin aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-text-subtle" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{node.name}</span>
                  </span>
                  <span className="text-[13px] text-text-muted">{groupSub(row)}</span>
                </div>
              ) : (
                <>
                  <Link to={branchHref(node)} className="flex min-w-0 flex-1 flex-col gap-1 text-text">
                    <span className="font-semibold [overflow-wrap:anywhere]">{node.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {statusBadge(node)}
                      <span className="text-[13px] text-text-muted">
                        {branchTypeLabel(node.type, t)} ·{" "}
                        {t("v2.list.employeesLong", {
                          count: node.employees_count,
                          value: count(node.employees_count),
                        })}
                      </span>
                    </span>
                  </Link>
                  {menu(node)}
                </>
              )}
              {row.hasChildren ? toggleButton(row, "lg") : null}
            </li>
          );
        })}
      </ul>
    );
  }

  // ─── Desktop / planshet: jadval-daraxt ───────────────────────────────────────
  return (
    <div className={cx("w-full overflow-x-auto", busy && "opacity-60")} aria-busy={busy || undefined}>
      <table aria-label={t("v2.tree.label")} className="w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              {t("v2.columns.branch")}
            </th>
            <th scope="col" className={TH}>
              {t("v2.columns.type")}
            </th>
            <th scope="col" className={cx(TH, "max-lg:hidden")}>
              {t("v2.columns.areaAddress")}
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              {t("v2.columns.employees")}
            </th>
            <th scope="col" className={TH}>
              {t("v2.columns.status")}
            </th>
            <th scope="col" className={cx(TH, "w-16")}>
              <span className="sr-only">{t("v2.columns.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { node } = row;
            const indent = row.depth * DESKTOP.step;
            const elbow = row.hasChildren ? DESKTOP.elbow : DESKTOP.leafElbow;
            const nameCell = (
              <td className={cx(TD, "relative")}>
                <TreeGuides
                  row={row}
                  step={DESKTOP.step}
                  origin={DESKTOP.origin}
                  elbow={elbow}
                  stubTop="calc(50% + 16px)"
                />
                <div className="relative flex min-w-0 items-center gap-2" style={{ paddingLeft: indent }}>
                  {row.hasChildren ? toggleButton(row, "sm") : <span aria-hidden="true" className="size-8 shrink-0" />}
                  <div className="min-w-0">
                    {node.isVirtualGroup ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-text">
                        <MapPin aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-text-subtle" />
                        {node.name}
                      </div>
                    ) : (
                      <Link
                        to={branchHref(node)}
                        className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
                      >
                        {node.name}
                      </Link>
                    )}
                    <div className={SUB}>{node.isVirtualGroup ? groupSub(row) : branchSub(row)}</div>
                  </div>
                </div>
              </td>
            );

            if (node.isVirtualGroup) {
              return (
                <tr key={node.id} className="hover:bg-row-hover">
                  {nameCell}
                  <td className={TD} colSpan={5} />
                </tr>
              );
            }

            const area = branchAreaText(node);
            const address = knownText(node.address);
            return (
              <tr key={node.id} className="hover:bg-row-hover">
                {nameCell}
                <td className={TD}>
                  <Badge>{branchTypeLabel(node.type, t)}</Badge>
                </td>
                <td className={cx(TD, "max-lg:hidden")}>
                  <div className="whitespace-nowrap">{area || "—"}</div>
                  {address ? <div className={SUB}>{address}</div> : null}
                </td>
                <td className={cx(TD, "whitespace-nowrap text-right", node.employees_count === 0 && "text-text-subtle")}>
                  {t("v2.list.employees", { count: node.employees_count, value: count(node.employees_count) })}
                </td>
                <td className={TD}>{statusBadge(node)}</td>
                <td className={cx(TD, "text-right")}>{menu(node)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default memo(BranchTree);
