// dizayn-v2: registrator-dispatch-list, registrator-dispatch-empty, manager-dispatch-scan, registrator-dispatch-courier-select-dialog, manager-dispatch-courier-dialog
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Camera, ListChecks, QrCode, RefreshCw, ScanLine, Truck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import ScannerCameraModal from "../../shared/components/ScannerCameraModal";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { useScannerGate } from "../../shared/lib/useScannerGate";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { fetchScanDetail, getScanResourceType, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../scan/lib/scanShared";
import { useOrders } from "../../entities/order/api/orderApi";
import { useUser } from "../../entities/user/api/userApi";
import type { RootState } from "../../app/config/store";
import { canViewUsers } from "../../app/lib/access";
import { readBranchName } from "../../widgets/header/model/userIdentity";
import { notify } from "../../shared/lib/notify";
import { SelectionRegion } from "../../shared/ui/SelectionRegion";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { Badge, Button, Card, EmptyState, PageHeader } from "../../shared/ui/primitives";
import {
  extractCouriers,
  getBranchStem,
  getDispatchErrorMessage,
  getDispatchStats,
  normalizeDispatchOrder,
  type DispatchCourier,
  type DispatchOrder,
} from "./model/dispatchModel";
import { CourierPickerDialog } from "./ui/CourierPickerDialog";
import { DispatchAlert } from "./ui/DispatchAlert";
import { DispatchOrdersTable } from "./ui/DispatchOrdersTable";
import { DispatchStats } from "./ui/DispatchStats";

/** Skan xabari: takror — ogohlantirish, qolganlari — xato (maket «Sahifa holatlari»). */
type ScanNotice = { tone: "warning" | "danger"; text: string };

/** `/scan/:token` → «Kuryerga biriktirish» (spec §3.4): `navigate("/dispatch", { state: { scanToken } })`. */
const readHandoffToken = (state: unknown): string | null => {
  const token = (state as { scanToken?: unknown } | null)?.scanToken;
  return typeof token === "string" && token.trim() ? token : null;
};

/**
 * «KURYERGA BIRIKTIRISH» — `/dispatch` (superadmin, admin, filialda jo'natish bor registrator, REGIONAL/HYBRID
 * menejer). Buyurtma QR kodlari USB skaner yoki kamera bilan ro'yxatga qo'shiladi (qo'shilgani darhol tanlanadi),
 * so'ng tanlanganlar bitta kuryerga biriktiriladi (`POST orders/assign-to-courier`).
 *
 * Maketlar: `registrator-dispatch-list`, `registrator-dispatch-empty`, `manager-dispatch-scan` (barcha rollar uchun
 * bitta tartib), kuryer oynasi `*-dispatch-courier-select-dialog` / `manager-dispatch-courier-dialog`. Kamera oynasi
 * (`ScannerCameraModal`) — kamera ishi, o'zgarmagan.
 *
 * Saqlangan xatti-harakat: skan darvozasi (150 / 2600 ms), takror va noto'g'ri turdagi QR, parallel tekshiruvlar
 * soni va «sekin» izohi (1,2 s), filialda bitta kuryer bo'lsa — oynasiz to'g'ridan-to'g'ri biriktirish,
 * biriktirilganlar ro'yxatdan olinadi (tanlanmaganlari qoladi), so'rov tanasi o'zgarmagan.
 */
const DispatchPage = () => {
  const { t } = useTranslation(["dispatch", "orders"]);
  const location = useLocation();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { assignCourier } = useOrders();
  const { useGetCouriers } = useUser();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const showUsersLink = useSelector(canViewUsers);
  const isBranchScopedRole = role === "manager" || role === "registrator";
  const branchName = isBranchScopedRole ? getBranchStem(readBranchName(user)) : null;

  // Menejer/registrator uchun region_id YUBORILMAYDI: GET /couriers so'rovchining
  // filialiga o'zi cheklaydi (filial kuryerlari bo'yicha, sahifalashdan oldin).
  // Avvalgi viloyat filtri HQ registratorida ro'yxatni butunlay bo'sh
  // qoldirardi — HQ ning viloyati yo'q (region_id NULL).
  const courierParams = useMemo(
    () => (isBranchScopedRole ? { page: 1, limit: 100, status: "active" } : { page: 1, limit: 100 }),
    [isBranchScopedRole],
  );
  const {
    data: couriersResponse,
    isLoading: isCouriersLoading,
    isError: isCouriersError,
    refetch: refetchCouriers,
  } = useGetCouriers(courierParams, true);

  const couriers = useMemo(() => extractCouriers(couriersResponse), [couriersResponse]);

  const [pendingOrders, setPendingOrders] = useState<DispatchOrder[]>([]);
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null);
  const [activeLookupCount, setActiveLookupCount] = useState(0);
  const [isLookupSlow, setIsLookupSlow] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCourierDialogOpen, setIsCourierDialogOpen] = useState(false);
  const [courierDialogKey, setCourierDialogKey] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const isLookingUpOrder = activeLookupCount > 0;

  const isCameraScannerOpenRef = useRef(false);
  const pendingTokensRef = useRef<Set<string>>(new Set());
  const lookupTokensRef = useRef<Set<string>>(new Set());
  const handoffDoneRef = useRef(false);
  const { canAcceptScan, blockScans, resetScannerGate } = useScannerGate({
    cooldownMs: 150,
    duplicateCooldownMs: 2600,
  });

  useEffect(() => {
    isCameraScannerOpenRef.current = isCameraScannerOpen;
  }, [isCameraScannerOpen]);

  useEffect(() => {
    pendingTokensRef.current = new Set(pendingOrders.map((order) => order.token.trim().toLowerCase()));
  }, [pendingOrders]);

  useEffect(() => {
    setSelectedOrderIds((prev) => {
      const availableIds = new Set(pendingOrders.map((order) => order.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (availableIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [pendingOrders]);

  useEffect(() => {
    if (!isLookingUpOrder) {
      setIsLookupSlow(false);
      return;
    }
    const timeout = window.setTimeout(() => setIsLookupSlow(true), 1200);
    return () => window.clearTimeout(timeout);
  }, [isLookingUpOrder]);

  const handleRemoveOrder = useCallback((orderId: string) => {
    setPendingOrders((prev) => prev.filter((order) => order.id !== orderId));
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const handleToggleOrder = useCallback((orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(
    (checked: boolean) => setSelectedOrderIds(checked ? new Set(pendingOrders.map((order) => order.id)) : new Set()),
    [pendingOrders],
  );

  const selectedOrders = useMemo(
    () => pendingOrders.filter((order) => selectedOrderIds.has(order.id)),
    [pendingOrders, selectedOrderIds],
  );
  const stats = useMemo(() => getDispatchStats(pendingOrders, selectedOrderIds), [pendingOrders, selectedOrderIds]);

  const handleScanValue = useCallback(
    async (rawValue: string) => {
      if (!canAcceptScan(rawValue)) return true;

      const normalizedToken = extractScannerToken(rawValue, window.location.origin) ?? rawValue.trim();
      if (!normalizedToken) return false;

      const tokenKey = normalizedToken.toLowerCase();

      if (getScanResourceType(normalizedToken) !== "order") {
        setScanNotice({ tone: "danger", text: t("scanErrors.wrongType") });
        void playScanFeedback("error");
        return true;
      }

      if (pendingTokensRef.current.has(tokenKey) || lookupTokensRef.current.has(tokenKey)) {
        setScanNotice({ tone: "warning", text: t("scanErrors.duplicate") });
        blockScans(250);
        return true;
      }

      lookupTokensRef.current.add(tokenKey);
      setActiveLookupCount((count) => count + 1);
      setScanNotice(null);

      try {
        const detail = await fetchScanDetail(normalizedToken);
        if (detail.type !== "order") throw new Error(t("scanErrors.wrongType"));

        const nextOrder = normalizeDispatchOrder(detail.data, normalizedToken);
        if (!nextOrder) throw new Error(t("scanErrors.lookup"));

        setPendingOrders((prev) =>
          prev.some((order) => order.id === nextOrder.id || order.token.toLowerCase() === tokenKey)
            ? prev
            : [...prev, nextOrder],
        );
        setSelectedOrderIds((selectedIds) => new Set(selectedIds).add(nextOrder.id));
        void playScanFeedback("success");
        if (isCameraScannerOpenRef.current) setIsCameraScannerOpen(false);
        blockScans(250);
        return true;
      } catch (error) {
        setScanNotice({ tone: "danger", text: getBackendErrorMessage(error) ?? t("scanErrors.lookup") });
        void playScanFeedback("error");
        blockScans(600);
        return true;
      } finally {
        lookupTokensRef.current.delete(tokenKey);
        setActiveLookupCount((count) => Math.max(0, count - 1));
      }
    },
    [blockScans, canAcceptScan, t],
  );

  useKeyboardScanner({
    enabled: true,
    captureEditableTargets: true,
    onScan: (value) => {
      void handleScanValue(value);
      return true;
    },
  });

  // `/scan/:token` dan «Kuryerga biriktirish»: buyurtma bir marta qo'shiladi, so'ng router state tozalanadi —
  // sahifani yangilash yoki «Orqaga» uni qayta qo'shmaydi.
  useEffect(() => {
    const token = readHandoffToken(location.state);
    if (!token || handoffDoneRef.current) return;
    handoffDoneRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
    void handleScanValue(token);
  }, [handleScanValue, location.pathname, location.state, navigate]);

  const openCameraScanner = () => {
    setScanNotice(null);
    setIsCameraScannerOpen(true);
  };

  const handleComplete = async (courier: DispatchCourier) => {
    if (!courier.id || selectedOrders.length === 0 || assignCourier.isPending) return;
    const assignedOrderIds = new Set(selectedOrders.map((order) => order.id));
    const assignedCount = selectedOrders.length;

    try {
      await assignCourier.mutateAsync({
        courier_id: courier.id,
        order_ids: Array.from(assignedOrderIds),
      });

      notify.success(t("assign.successTitle"), {
        description: t("assign.success", { count: assignedCount, courier: courier.name }),
        duration: 3000,
      });

      setPendingOrders((prev) => prev.filter((order) => !assignedOrderIds.has(order.id)));
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        assignedOrderIds.forEach((id) => next.delete(id));
        return next;
      });
      setIsCourierDialogOpen(false);
      setScanNotice(null);
      setIsCameraScannerOpen(false);
      lookupTokensRef.current.clear();
      resetScannerGate();
    } catch (error) {
      notify.error(t("assign.errorTitle"), { description: getDispatchErrorMessage(error, t("scanErrors.lookup")) });
    }
  };

  const handleAssignCourier = () => {
    // Filialda bitta faol kuryer — tanlash oynasi ochilmaydi, buyurtmalar darhol unga biriktiriladi.
    if (couriers.length === 1) {
      void handleComplete(couriers[0]);
      return;
    }
    setCourierDialogKey((key) => key + 1);
    setIsCourierDialogOpen(true);
  };

  const noCouriers = !isCouriersLoading && !isCouriersError && couriers.length === 0;
  const assignDisabled =
    selectedOrders.length === 0 || isLookingUpOrder || isCouriersLoading || isCouriersError || couriers.length === 0;
  const assignLabel = t("page.assign", { count: selectedOrders.length });
  const hasOrders = pendingOrders.length > 0;
  const allSelected = hasOrders && selectedOrders.length === pendingOrders.length;
  const visibleNotice = scanNotice && !isCameraScannerOpen ? scanNotice : null;

  // Telefonda «Kuryerga biriktirish» pastki panelda (bitta element; jsdom/desktopda — sarlavhada).
  const assignButton = (
    <Button
      size={isPhone ? "lg" : "md"}
      compact={isPhone}
      leftIcon={Truck}
      disabled={assignDisabled}
      loading={assignCourier.isPending}
      loadingText={t("page.assigning")}
      aria-haspopup={couriers.length > 1 ? "dialog" : undefined}
      aria-label={isPhone && !assignCourier.isPending ? assignLabel : undefined}
      onClick={handleAssignCourier}
      className={isPhone ? "min-w-0 flex-1" : undefined}
    >
      {isPhone ? t("page.assignShort", { count: selectedOrders.length }) : assignLabel}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {isCouriersError ? (
        <DispatchAlert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={() => void refetchCouriers()}>
              {t("couriers.retry")}
            </Button>
          }
        >
          {t("couriers.loadError")}
        </DispatchAlert>
      ) : null}

      <PageHeader
        title={t("page.title")}
        description={hasOrders ? t("page.subtitle", { count: pendingOrders.length }) : t("page.subtitleEmpty")}
        actions={isPhone ? undefined : assignButton}
      />

      <DispatchStats stats={stats} />

      <Card
        title={t("scanCard.title")}
        description={t("scanCard.description")}
        padding="none"
        className="overflow-hidden"
        actions={
          isPhone ? undefined : (
            <>
              <Badge tone="success" dot role="status">
                {t("scanCard.usbReady")}
              </Badge>
              <Button variant="secondary" size="sm" leftIcon={Camera} aria-haspopup="dialog" onClick={openCameraScanner}>
                {t("scanCard.camera")}
              </Button>
            </>
          )
        }
      >
        {visibleNotice || isLookingUpOrder ? (
          <div className="flex flex-col gap-3 px-5 py-4 max-md:px-4">
            {isLookingUpOrder ? (
              <DispatchAlert tone="info" busy title={t("lookup.checking", { count: activeLookupCount })}>
                {isLookupSlow ? t("lookup.slow") : null}
              </DispatchAlert>
            ) : null}
            {visibleNotice ? <DispatchAlert tone={visibleNotice.tone}>{visibleNotice.text}</DispatchAlert> : null}
          </div>
        ) : null}

        <div className={visibleNotice || isLookingUpOrder ? undefined : "-mt-px"}>
          <SelectionRegion
            label={t("selection.label")}
            idle={selectedOrders.length === 0}
            title={
              <>
                {t("selection.title", { count: selectedOrders.length })}
                {hasOrders ? (
                  <span className="font-medium text-text-muted">
                    {" "}
                    {t("selection.ofTotal", { count: pendingOrders.length, total: pendingOrders.length })}
                  </span>
                ) : null}
              </>
            }
            hint={t("selection.hint")}
            action={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={ListChecks}
                  disabled={!hasOrders || allSelected}
                  onClick={() => handleToggleAll(true)}
                >
                  {t("selection.selectAll")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selectedOrders.length === 0}
                  onClick={() => handleToggleAll(false)}
                >
                  {t("selection.clear")}
                </Button>
              </>
            }
          />
        </div>

        {hasOrders ? (
          <DispatchOrdersTable
            rows={pendingOrders}
            selectedIds={selectedOrderIds}
            onToggle={handleToggleOrder}
            onToggleAll={handleToggleAll}
            onRemove={handleRemoveOrder}
          />
        ) : (
          <EmptyState
            icon={QrCode}
            title={t("empty.title")}
            description={t("empty.description")}
            className="min-h-[260px] justify-center border-t border-border"
          />
        )}
      </Card>

      {noCouriers ? (
        <DispatchAlert tone="warning" title={t("couriers.emptyTitle")}>
          {branchName || showUsersLink ? (
            <>
              {branchName ? t("couriers.emptyBranch", { branch: branchName }) : null}
              {branchName && showUsersLink ? " " : null}
              {showUsersLink ? (
                <Trans
                  t={t}
                  ns="dispatch"
                  i18nKey="couriers.emptyUsers"
                  components={{
                    usersLink: <Link to="/all-users" className="font-semibold text-action-fg underline-offset-2 hover:underline" />,
                  }}
                />
              ) : null}
            </>
          ) : null}
        </DispatchAlert>
      ) : null}

      {/* Telefon (< 768): «Kamera» + «Biriktirish — N ta» pastki menyu ustidagi panelda (spec §3.3, Q7). */}
      {isPhone ? (
        <>
          <div aria-hidden="true" className="h-[72px] shrink-0" />
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 flex gap-2 border-t border-border bg-surface px-4 py-3">
            <Button
              variant="secondary"
              size="lg"
              compact
              leftIcon={ScanLine}
              aria-haspopup="dialog"
              aria-label={t("scanCard.cameraPhone", { count: pendingOrders.length })}
              onClick={openCameraScanner}
              className="shrink-0"
            >
              {t("scanCard.camera")}
              <Badge size="sm" className="ml-0.5">
                {t("scanCard.cameraCount", { count: pendingOrders.length })}
              </Badge>
            </Button>
            {assignButton}
          </div>
        </>
      ) : null}

      <ScannerCameraModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onDecode={(value) => void handleScanValue(value)}
        title={t("camera.title")}
        subtitle={t("camera.subtitle")}
        waitingText={t("camera.waiting")}
        closeLabel={t("camera.close")}
        torchOnLabel={t("camera.torchOn")}
        torchOffLabel={t("camera.torchOff")}
        invalidQrMessage={t("scanErrors.invalidQr")}
        loading={isLookingUpOrder}
        loadingText={t("camera.loading")}
        error={scanNotice?.text ?? ""}
      />

      <CourierPickerDialog
        key={courierDialogKey}
        open={isCourierDialogOpen}
        couriers={couriers}
        count={selectedOrders.length}
        branchName={branchName}
        pending={assignCourier.isPending}
        onClose={() => setIsCourierDialogOpen(false)}
        onAssign={(courier) => void handleComplete(courier)}
      />
    </div>
  );
};

export default memo(DispatchPage);
