// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail, manager-warehouse-detail, superadmin-warehouse-stock-in-dialog, admin-warehouse-stock-in-dialog
import { memo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Building2, Calendar, CirclePause, CirclePlay, Download, PackagePlus, User, Warehouse as WarehouseIcon } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { canManageWarehouses } from "../../../app/lib/access";
import {
  exportWarehouseStock,
  useSetWarehousePaused,
  useWarehouse,
  WarehouseStatusBadge,
  type Warehouse,
  type WarehouseStockRow,
} from "../../../entities/warehouse";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { getExportErrorMessage } from "../../../shared/lib/exportFile";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  getPanelId,
  getTabId,
  PageHeader,
  SkeletonLines,
  Tabs,
  useConfirm,
} from "../../../shared/ui/primitives";
import { WAREHOUSES_PATH } from "../model/paths";
import { useWarehouseText } from "../model/useWarehouseText";
import { NoteAlert } from "../ui/NoteAlert";
import { InventoryDialog } from "./ui/InventoryDialog";
import { MovementsPanel } from "./ui/MovementsPanel";
import { RecentMovementsCard } from "./ui/RecentMovementsCard";
import { StockInDialog } from "./ui/StockInDialog";
import { StockPanel, type StockFilters } from "./ui/StockPanel";
import { ThresholdDialog } from "./ui/ThresholdDialog";
import { WarehouseActionsMenu } from "./ui/WarehouseActionsMenu";
import { WarehouseKpis } from "./ui/WarehouseKpis";

type DetailTab = "stock" | "movements";
const TAB_PREFIX = "warehouse-detail";

/** Sarlavha ostidagi qator elementi (maket `.el-sub`: ikonka `.el-subtle` + matn). */
const MetaItem = ({ icon: Icon, children }: { icon: typeof Building2; children: string }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap max-md:whitespace-normal">
    <Icon size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
    {children}
  </span>
);

/**
 * OMBOR TAFSILOTI — `/warehouses/:id` (yXC91RRx; guard `canViewWarehouses`).
 *
 * Superadmin, admin (maket `superadmin-warehouse-detail` = admin): «← Omborlar», nom + holat, «filial · Mas'ul: … ·
 * Ochilgan: …»; amallar «Excelga yuklash» (telefonda yashirin), «Mahsulot qo'shish» (kirim oynasi), ⋯
 * (Inventarizatsiya, To'xtatish / Qayta yoqish — tasdiq bilan); KPI; «Qoldiq | Harakatlar» tablari; «Oxirgi
 * harakatlar».
 * Filial menejeri (maket `manager-warehouse-detail`): faqat ko'rish — «Qoldiqni admin boshqaradi» izohi, amallarsiz,
 * «Mas'ul: … (siz)». Maketdagi «Ombordan ketadigan buyurtmalar» kartasi chizilmagan — buyurtma ↔ ombor bog'lanishi
 * (band/chiqim) backendda hali yo'q (keyingi order-service PR'i).
 */
const WarehouseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const text = useWarehouseText();
  const { t } = text;
  const canManage = useSelector(canManageWarehouses);
  const currentUserId = useSelector((state: RootState) => state.user.user?.id ?? state.role.id ?? null);
  const confirm = useConfirm();
  const togglePause = useSetWarehousePaused();
  const query = useWarehouse(id);
  const warehouse = query.data ?? undefined;

  const tab: DetailTab = searchParams.get("tab") === "movements" ? "movements" : "stock";
  const setTab = (next: DetailTab) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next === "stock") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  const tabsCardRef = useRef<HTMLDivElement>(null);

  const [stockInOpen, setStockInOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [thresholdRow, setThresholdRow] = useState<WarehouseStockRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const stockFilters = useRef<StockFilters>({ search: "", marketId: "", level: "" });

  const notFound = query.isError && getErrorStatus(query.error) === 404;

  if (!id || notFound || (query.isSuccess && !warehouse)) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        {canManage ? <PageHeader back={WAREHOUSES_PATH} backLabel={t("list.title")} title={t("detail.notFoundTitle")} /> : null}
        <EmptyState
          framed
          size="page"
          icon={WarehouseIcon}
          title={t("detail.notFoundTitle")}
          description={t("detail.notFoundDescription")}
        />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        {canManage ? <PageHeader back={WAREHOUSES_PATH} backLabel={t("list.title")} title={t("list.title")} /> : null}
        <ErrorState error={query.error} title={t("detail.loadFailed")} onRetry={() => void query.refetch()} size="page" />
      </div>
    );
  }

  const paused = warehouse?.status === "PAUSED";
  const isOwnManager = Boolean(warehouse?.manager && currentUserId && String(warehouse.manager.id) === String(currentUserId));

  const runExport = async (target: Warehouse) => {
    if (exporting) return;
    setExporting(true);
    try {
      const filters = stockFilters.current;
      await exportWarehouseStock(
        target.id,
        {
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.marketId ? { market_id: filters.marketId } : {}),
          ...(filters.level ? { level: filters.level } : {}),
        },
        t("detail.exportFileName", { id: target.id }),
      );
    } catch (error) {
      notify.error(t("detail.exportFailed"), { description: (await getExportErrorMessage(error)) ?? text.writeError(error) });
    } finally {
      setExporting(false);
    }
  };

  const askTogglePause = async (target: Warehouse) => {
    const pausing = target.status !== "PAUSED";
    const ok = await confirm({
      title: t(pausing ? "pause.title" : "resume.title"),
      description: t(pausing ? "pause.text" : "resume.text"),
      details: target.name,
      confirmLabel: t(pausing ? "pause.confirm" : "resume.confirm"),
      confirmIcon: pausing ? CirclePause : CirclePlay,
      icon: pausing ? CirclePause : CirclePlay,
      onConfirm: () => togglePause.mutateAsync({ id: target.id, paused: pausing }),
    });
    if (ok) notify.success(t(pausing ? "pause.success" : "resume.success"), { description: target.name });
  };

  const managerName = warehouse?.manager?.name ?? null;
  const description = warehouse ? (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
      <MetaItem icon={Building2}>
        {canManage
          ? (warehouse.branch?.name ?? "")
          : [warehouse.branch?.name, warehouse.region?.name].filter(Boolean).join(" · ")}
      </MetaItem>
      {managerName ? (
        <MetaItem icon={User}>
          {isOwnManager && !canManage
            ? t("detail.managerYou", { name: managerName })
            : t("detail.managerOf", { name: managerName })}
        </MetaItem>
      ) : null}
      {warehouse.createdAt ? <MetaItem icon={Calendar}>{t("detail.openedAt", { date: text.date(warehouse.createdAt) })}</MetaItem> : null}
    </span>
  ) : undefined;

  const actions =
    canManage && warehouse ? (
      <>
        <Button
          variant="secondary"
          leftIcon={Download}
          loading={exporting}
          loadingText={t("detail.exporting")}
          onClick={() => void runExport(warehouse)}
          className="max-md:hidden"
        >
          {t("detail.export")}
        </Button>
        <Button leftIcon={PackagePlus} aria-haspopup="dialog" onClick={() => setStockInOpen(true)}>
          {t("stockIn.open")}
        </Button>
        <WarehouseActionsMenu
          paused={paused}
          onInventory={() => setInventoryOpen(true)}
          onTogglePause={() => void askTogglePause(warehouse)}
        />
      </>
    ) : undefined;

  const showAllMovements = () => {
    setTab("movements");
    window.requestAnimationFrame(() => tabsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      {canManage ? (
        <PageHeader
          back={WAREHOUSES_PATH}
          backLabel={t("list.title")}
          title={warehouse?.name ?? t("list.title")}
          meta={warehouse ? <WarehouseStatusBadge status={warehouse.status} /> : undefined}
          description={description}
          actions={actions}
        />
      ) : (
        <PageHeader
          title={warehouse?.name ?? t("manager.title")}
          meta={warehouse ? <WarehouseStatusBadge status={warehouse.status} /> : undefined}
          description={description}
        />
      )}

      {!canManage ? <NoteAlert title={t("manager.noteTitle")}>{t("manager.noteText")}</NoteAlert> : null}

      <WarehouseKpis warehouse={warehouse} managerView={!canManage} />

      {!id || !warehouse ? (
        <Card padding="none">
          <SkeletonLines lines={6} className="p-5" />
        </Card>
      ) : (
        <>
          <Card padding="none" aria-label={t("detail.tabsLabel")} ref={tabsCardRef}>
            <Tabs
              items={[
                { value: "stock", label: t("detail.tabs.stock"), count: warehouse.summary.positions },
                {
                  value: "movements",
                  label: t("detail.tabs.movements"),
                  ...(warehouse.movementsCount !== null ? { count: warehouse.movementsCount } : {}),
                },
              ]}
              value={tab}
              onValueChange={setTab}
              ariaLabel={t("detail.tabsLabel")}
              idPrefix={TAB_PREFIX}
              controlsPanel
              className="px-3"
            />
            <div role="tabpanel" id={getPanelId(TAB_PREFIX, tab)} aria-labelledby={getTabId(TAB_PREFIX, tab)} className="min-w-0">
              {tab === "stock" ? (
                <StockPanel
                  warehouseId={warehouse.id}
                  canManage={canManage}
                  onHandTotal={warehouse.summary.onHand}
                  onEditThreshold={setThresholdRow}
                  onAddStock={() => setStockInOpen(true)}
                  onFiltersChange={(filters) => {
                    stockFilters.current = filters;
                  }}
                />
              ) : (
                <MovementsPanel warehouseId={warehouse.id} />
              )}
            </div>
          </Card>
          {tab === "stock" ? <RecentMovementsCard warehouseId={warehouse.id} onShowAll={showAllMovements} /> : null}
        </>
      )}

      {canManage ? (
        <>
          <StockInDialog open={stockInOpen} warehouse={warehouse ?? null} onClose={() => setStockInOpen(false)} />
          <InventoryDialog open={inventoryOpen} warehouse={warehouse ?? null} onClose={() => setInventoryOpen(false)} />
          {warehouse ? (
            <ThresholdDialog
              warehouseId={warehouse.id}
              defaultThreshold={warehouse.lowStockDefault}
              row={thresholdRow}
              onClose={() => setThresholdRow(null)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default memo(WarehouseDetailPage);
