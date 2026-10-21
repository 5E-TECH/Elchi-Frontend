// dizayn-v2: superadmin-regions-districts, admin-regions-districts, superadmin-regions-sato-management, admin-regions-sato-management
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LoaderCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, IconButton, Pressable } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import MoveDistrictDialog, { type MoveDistrictTarget } from "./MoveDistrictDialog";

export interface BoardDistrict {
  id: string;
  name: string;
}

export interface BoardRegion {
  id: string;
  name: string;
  districts: BoardDistrict[];
}

export interface DistrictBoardProps {
  /** Ko'rsatiladigan (qidiruvdan o'tgan) viloyatlar. */
  regions: BoardRegion[];
  /** O'tkazish oynasi uchun barcha viloyatlar. */
  allRegions: readonly { id: string; name: string }[];
  onMove: (districtId: string, fromRegionId: string, toRegionId: string) => void;
  /** Saqlanayotgan tuman («Saqlanmoqda...»). */
  movingId?: string | null;
  /** Qidiruv faol — telefonda hamma bo'limlar ochiq. */
  expandAll?: boolean;
  /** Desktopda sudrash ko'rsatmasi «→ Ko'chirish» (sato sahifasi). */
  moveHint?: boolean;
  /** Tuman qatori amallari (tahrirlash, o'chirish) — tumanlar sahifasi. */
  renderActions?: (district: BoardDistrict, region: BoardRegion) => ReactNode;
  /** Shu tuman qatori o'rnida tahrir maydoni. */
  editingId?: string | null;
  renderEditor?: (district: BoardDistrict, region: BoardRegion) => ReactNode;
}

const ROW =
  "flex min-h-10 min-w-0 items-center gap-2 border-t border-border px-4 py-1 text-[13px] font-medium text-text first:border-t-0 max-md:min-h-12";

/**
 * VILOYATLAR VA TUMANLAR DOSKASI (`/regions/districts`, `/regions/sato-management`).
 * Planshet/desktop — viloyat kartalari to'ri, tumanni sudrab boshqa viloyatga tashlash (PATCH
 * `district/:id {assigned_region}` — chaqiruvchida). Telefon — akkordeon, har tumanda «⇆» → viloyat
 * tanlash oynasi (sudrash teginishda ishlamaydi). DOM'da bitta ko'rinish (`matchMedia`).
 */
const DistrictBoard = ({
  regions,
  allRegions,
  onMove,
  movingId,
  expandAll = false,
  moveHint = false,
  renderActions,
  editingId,
  renderEditor,
}: DistrictBoardProps) => {
  const { t, i18n } = useTranslation("region");
  const isPhone = useIsPhone();
  const [dragging, setDragging] = useState<{ districtId: string; fromRegionId: string } | null>(
    null,
  );
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(regions[0] ? [regions[0].id] : []),
  );
  const [moveTarget, setMoveTarget] = useState<MoveDistrictTarget | null>(null);
  const count = (value: number) =>
    t("v2.common.countTa", { count: formatNumberLocalized(value, { language: i18n.language }) });

  const moveDialog = (
    <MoveDistrictDialog
      target={moveTarget}
      regions={allRegions}
      onClose={() => setMoveTarget(null)}
      onMove={(target, toRegionId) => {
        setMoveTarget(null);
        onMove(target.districtId, target.fromRegionId, toRegionId);
      }}
    />
  );

  const emptyList = (
    <li className="px-4 py-3">
      <span className="flex items-center justify-center rounded-lg border border-dashed border-border-strong px-3 py-3 text-xs text-text-muted">
        {t("v2.board.noDistricts")}
      </span>
    </li>
  );

  if (isPhone) {
    return (
      <>
        <div
          aria-label={t("v2.board.aria")}
          role="group"
          className="overflow-hidden rounded-[14px] border border-border bg-surface"
        >
          {regions.map((region) => {
            const open = expandAll || openIds.has(region.id);
            const listId = `region-board-${region.id}`;
            return (
              <section
                key={region.id}
                aria-label={region.name}
                className="border-t border-border first:border-t-0"
              >
                <h3 className="m-0">
                  <Pressable
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() =>
                      setOpenIds((current) => {
                        const next = new Set(current);
                        if (next.has(region.id)) next.delete(region.id);
                        else next.add(region.id);
                        return next;
                      })
                    }
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-text"
                  >
                    <span className="min-w-0 flex-1 truncate">{region.name}</span>
                    <Badge size="sm">{count(region.districts.length)}</Badge>
                    {open ? (
                      <ChevronUp
                        size={18}
                        aria-hidden="true"
                        className="shrink-0 text-text-muted"
                      />
                    ) : (
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="shrink-0 text-text-muted"
                      />
                    )}
                  </Pressable>
                </h3>
                {open ? (
                  <ul
                    id={listId}
                    aria-label={t("v2.board.listAria", { region: region.name })}
                    className="m-0 list-none border-t border-border p-0"
                  >
                    {region.districts.length === 0
                      ? emptyList
                      : region.districts.map((district) => (
                          <li
                            key={district.id}
                            data-testid={`district-${district.id}`}
                            className={cx(ROW, "pr-2")}
                          >
                            {editingId === district.id && renderEditor ? (
                              renderEditor(district, region)
                            ) : (
                              <>
                                <GripVertical
                                  size={16}
                                  aria-hidden="true"
                                  className="shrink-0 text-text-subtle"
                                />
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                  {district.name}
                                </span>
                                {movingId === district.id ? (
                                  <LoaderCircle
                                    size={16}
                                    aria-hidden="true"
                                    className="shrink-0 animate-spin text-text-muted"
                                  />
                                ) : null}
                                <IconButton
                                  size="sm"
                                  variant="ghost"
                                  icon={ArrowLeftRight}
                                  label={t("v2.board.moveAria", { name: district.name })}
                                  onClick={() =>
                                    setMoveTarget({
                                      districtId: district.id,
                                      districtName: district.name,
                                      fromRegionId: region.id,
                                      fromRegionName: region.name,
                                    })
                                  }
                                />
                                {renderActions?.(district, region)}
                              </>
                            )}
                          </li>
                        ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
        {moveDialog}
      </>
    );
  }

  return (
    <>
      <div
        role="group"
        aria-label={t("v2.board.aria")}
        className="grid grid-cols-4 items-start gap-4 max-xl:grid-cols-3 max-lg:grid-cols-2"
      >
        {regions.map((region) => {
          const isTarget =
            dropTargetId === region.id && dragging != null && dragging.fromRegionId !== region.id;
          return (
            <section
              key={region.id}
              aria-label={region.name}
              data-testid={`region-${region.id}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTargetId(region.id);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDropTargetId((current) => (current === region.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropTargetId(null);
                const districtId = event.dataTransfer.getData("districtId");
                const fromRegionId = event.dataTransfer.getData("fromRegionId");
                setDragging(null);
                if (districtId && fromRegionId && fromRegionId !== region.id)
                  onMove(districtId, fromRegionId, region.id);
              }}
              className={cx(
                "flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-surface transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
                isTarget ? "border-action ring-1 ring-action" : "border-border",
              )}
            >
              <div
                className={cx(
                  "flex min-h-12 items-center justify-between gap-2 border-b border-border px-4 py-2.5",
                  isTarget && "bg-action-soft",
                )}
              >
                <h3 className="m-0 min-w-0 truncate text-sm font-semibold text-text">
                  {region.name}
                </h3>
                <Badge size="sm">{count(region.districts.length)}</Badge>
              </div>
              <ul
                aria-label={t("v2.board.listAria", { region: region.name })}
                className="m-0 max-h-[440px] list-none overflow-y-auto p-0"
              >
                {region.districts.length === 0
                  ? emptyList
                  : region.districts.map((district) => {
                      const isEditing = editingId === district.id && renderEditor != null;
                      const isDragging = dragging?.districtId === district.id;
                      const isMoving = movingId === district.id;
                      return (
                        <li
                          key={district.id}
                          data-testid={`district-${district.id}`}
                          draggable={!isEditing && !isMoving}
                          aria-label={
                            isDragging ? t("v2.board.dragging", { name: district.name }) : undefined
                          }
                          onDragStart={(event) => {
                            event.dataTransfer.setData("districtId", district.id);
                            event.dataTransfer.setData("fromRegionId", region.id);
                            setDragging({ districtId: district.id, fromRegionId: region.id });
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropTargetId(null);
                          }}
                          className={cx(
                            ROW,
                            "group pr-2",
                            !isEditing && "cursor-grab active:cursor-grabbing",
                            isDragging && "opacity-50",
                            isMoving && "bg-action-soft",
                          )}
                        >
                          {isEditing ? (
                            renderEditor?.(district, region)
                          ) : (
                            <>
                              <GripVertical
                                size={16}
                                aria-hidden="true"
                                className="shrink-0 text-text-subtle"
                              />
                              <span className="min-w-0 flex-1 truncate">{district.name}</span>
                              {isMoving ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-muted">
                                  <LoaderCircle
                                    size={16}
                                    aria-hidden="true"
                                    className="animate-spin"
                                  />
                                  {t("v2.board.saving")}
                                </span>
                              ) : moveHint ? (
                                <span
                                  aria-hidden="true"
                                  className="hidden shrink-0 items-center gap-1 text-xs text-text-muted group-hover:inline-flex"
                                >
                                  <ArrowRight size={16} />
                                  {t("v2.board.moveHint")}
                                </span>
                              ) : null}
                              {renderActions?.(district, region)}
                            </>
                          )}
                        </li>
                      );
                    })}
              </ul>
            </section>
          );
        })}
      </div>
      {moveDialog}
    </>
  );
};

export default DistrictBoard;
