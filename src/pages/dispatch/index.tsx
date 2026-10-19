// dizayn-v2: registrator-dispatch-list, registrator-dispatch-empty, manager-dispatch-scan, registrator-dispatch-courier-select-dialog, manager-dispatch-courier-dialog
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ListChecks, QrCode, RefreshCw, Truck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatchBasket, useDispatchBasketScope } from "../../features/dispatch-basket";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { useScannerGate } from "../../shared/lib/useScannerGate";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { fetchScanDetail, getScanResourceType, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { useScanTarget, type ScanTargetListItem } from "../../shared/lib/scanner/scanTargets";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
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
} from "./model/dispatchModel";
import { CourierPickerDialog } from "./ui/CourierPickerDialog";
import { DispatchAlert } from "./ui/DispatchAlert";
import { DispatchOrdersTable } from "./ui/DispatchOrdersTable";
import { DispatchStats } from "./ui/DispatchStats";

/** Skan xabari: takror — ogohlantirish, qolganlari — xato (maket «Sahifa holatlari»). */
type ScanNotice = { tone: "warning" | "danger"; text: string };

/** Kamera ro'yxatidagi rad etilgan kod (maket `manager-dispatch-camera-dialog`: «Paket P-0418 · Rad etildi»). */
type RejectedScan = { key: string; title: string; reason: string; at: number };

/** Kamera ro'yxatida rad etilganlardan nechtasi turadi (eng yangilari). */
const REJECTED_LIMIT = 10;

/**
 * «KURYERGA BIRIKTIRISH» — `/dispatch` (superadmin, admin, filialda jo'natish bor registrator, REGIONAL/HYBRID
 * menejer). Buyurtma QR kodlari USB skaner yoki kamera bilan ro'yxatga qo'shiladi (qo'shilgani darhol tanlanadi),
 * so'ng tanlanganlar bitta kuryerga biriktiriladi (`POST orders/assign-to-courier`).
 *
 * Maketlar: `registrator-dispatch-list`, `registrator-dispatch-empty`, `manager-dispatch-scan` (barcha rollar uchun
 * bitta tartib), kuryer oynasi `*-dispatch-courier-select-dialog` / `manager-dispatch-courier-dialog`.
 *
 * SAVAT QURILMADA (ega qarori D2; Trello v1eLN2tV 2-bosqich): ro'yxat — `features/dispatch-basket` (foydalanuvchi +
 * filial kaliti, 12 soatdan eskisi tashlanadi). Sahifa yangilansa yoki boshqa joyga o'tib qaytilsa ham buyurtmalar
 * va tanlov saqlanadi; `/scan/:token` dagi «Kuryerga biriktirish» ham shu savatga qo'shadi.
 *
 * KAMERA (maketlar `manager-dispatch-camera-dialog`, `registrator-dispatch-camera-scanner-dialog`): sahifada kamera
 * tugmasi yo'q (ega qarori — oqim ichidagi «Kamera» / «Kamera bilan skanerlash» o'rniga markaziy «Skaner» /
 * «Skanerlash» shu sahifaning maqsadini ochadi). Kamera skani USB bilan AYNAN bitta handler (`handleScanValue`);
 * kamera har skandan keyin yopilmaydi («Biriktirish · <filial> · savatda N ta», ro'yxatda «Bekor qilish» —
 * savatdan olish, server amali hali yo'q). «Tugatish» kamerani yopadi, kuryer sahifadagi tugma bilan tanlanadi.
 *
 * Saqlangan xatti-harakat: skan darvozasi (150 / 2600 ms), takror va noto'g'ri turdagi QR, parallel tekshiruvlar
 * soni va «sekin» izohi (1,2 s), filialda bitta kuryer bo'lsa — oynasiz to'g'ridan-to'g'ri biriktirish,
 * biriktirilganlar ro'yxatdan olinadi (tanlanmaganlari qoladi), so'rov tanasi o'zgarmagan.
 */
const DispatchPage = () => {
  const { t, i18n } = useTranslation(["dispatch", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const { assignCourier } = useOrders();
  const { useGetCouriers } = useUser();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const showUsersLink = useSelector(canViewUsers);
  const isBranchScopedRole = role === "manager" || role === "registrator";
  const branchFullName = isBranchScopedRole ? readBranchName(user) : null;
  const branchName = getBranchStem(branchFullName);

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

  const basket = useDispatchBasket(useDispatchBasketScope());
  const { items: basketItems, orders: pendingOrders, selectedIds: selectedOrderIds } = basket;
  const { add: addToBasket, remove: removeFromBasket, setSelected: setBasketSelected, has: isInBasket } = basket;
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null);
  const [rejectedScans, setRejectedScans] = useState<RejectedScan[]>([]);
  const [activeLookupCount, setActiveLookupCount] = useState(0);
  const [isLookupSlow, setIsLookupSlow] = useState(false);
  const [isCourierDialogOpen, setIsCourierDialogOpen] = useState(false);
  const [courierDialogKey, setCourierDialogKey] = useState(0);
  const isLookingUpOrder = activeLookupCount > 0;

  const lookupTokensRef = useRef<Set<string>>(new Set());
  const { canAcceptScan, blockScans, resetScannerGate } = useScannerGate({
    cooldownMs: 150,
    duplicateCooldownMs: 2600,
  });

  useEffect(() => {
    if (!isLookingUpOrder) {
      setIsLookupSlow(false);
      return;
    }
    const timeout = window.setTimeout(() => setIsLookupSlow(true), 1200);
    return () => window.clearTimeout(timeout);
  }, [isLookingUpOrder]);

  const handleRemoveOrder = useCallback((orderId: string) => removeFromBasket([orderId]), [removeFromBasket]);

  const handleToggleOrder = useCallback(
    (orderId: string, checked: boolean) => setBasketSelected([orderId], checked),
    [setBasketSelected],
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => setBasketSelected(pendingOrders.map((order) => order.id), checked),
    [pendingOrders, setBasketSelected],
  );

  /** Rad etilgan kod — kamera ro'yxatida (faqat shu sessiya, savatga kirmaydi). */
  const rejectScan = useCallback((token: string, title: string, reason: string) => {
    const key = `rejected:${token.toLowerCase()}`;
    setRejectedScans((prev) =>
      [...prev.filter((item) => item.key !== key), { key, title, reason, at: Date.now() }].slice(-REJECTED_LIMIT),
    );
  }, []);

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

      const resourceType = getScanResourceType(normalizedToken);
      if (resourceType !== "order") {
        setScanNotice({ tone: "danger", text: t("scanErrors.wrongType") });
        rejectScan(
          normalizedToken,
          t(resourceType === "post" ? "camera.rejectedPost" : "camera.rejectedPackage", { code: normalizedToken }),
          t("camera.rejectedWrongType"),
        );
        void playScanFeedback("error", t("camera.wrongType"));
        return true;
      }

      if (isInBasket(tokenKey) || lookupTokensRef.current.has(tokenKey)) {
        setScanNotice({ tone: "warning", text: t("scanErrors.duplicate") });
        void playScanFeedback("duplicate", t("scanErrors.duplicate"));
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

        // Savatda bor (boshqa token bilan skanerlangan) — qayta qo'shilmaydi, faqat tanlanadi.
        if (addToBasket(nextOrder) === "duplicate") {
          setScanNotice({ tone: "warning", text: t("scanErrors.duplicate") });
          void playScanFeedback("duplicate", t("scanErrors.duplicate"));
        } else {
          void playScanFeedback("success", t("camera.added", { id: nextOrder.id }));
        }
        blockScans(250);
        return true;
      } catch (error) {
        const message = getBackendErrorMessage(error) ?? t("scanErrors.lookup");
        setScanNotice({ tone: "danger", text: message });
        rejectScan(normalizedToken, normalizedToken, message);
        void playScanFeedback("error", message);
        blockScans(600);
        return true;
      } finally {
        lookupTokensRef.current.delete(tokenKey);
        setActiveLookupCount((count) => Math.max(0, count - 1));
      }
    },
    [addToBasket, blockScans, canAcceptScan, isInBasket, rejectScan, t],
  );

  useKeyboardScanner({
    enabled: true,
    captureEditableTargets: true,
    onScan: (value) => {
      void handleScanValue(value);
      return true;
    },
  });

  // ─── Kamera maqsadi (markaziy «Skaner» / «Skanerlash») ─────────────────────
  const cameraCount = formatNumberLocalized(pendingOrders.length, { language });
  const cameraList = useMemo<ScanTargetListItem[]>(() => {
    const rows = [
      ...basketItems.map((item) => ({
        at: item.addedAt,
        item: {
          key: `order:${item.order.id}`,
          title: [`№${item.order.id}`, item.order.name].filter(Boolean).join(" · "),
          subtitle: [item.order.district, formatMoneyLocalized(item.order.amount, { language })].filter(Boolean).join(" · "),
          tone: item.selected ? "success" : "neutral",
          // Server amali hali yo'q — «Bekor qilish» buyurtmani savatdan oladi.
          onUndo: () => removeFromBasket([item.order.id]),
        } satisfies ScanTargetListItem,
      })),
      ...rejectedScans.map((rejected) => ({
        at: rejected.at,
        item: {
          key: rejected.key,
          title: rejected.title,
          subtitle: t("camera.rejected", { reason: rejected.reason }),
          tone: "danger",
        } satisfies ScanTargetListItem,
      })),
    ];
    // Yangisi birinchi (maket «Oxirgi skanerlar»).
    return rows.sort((a, b) => b.at - a.at).map((row) => row.item);
  }, [basketItems, language, rejectedScans, removeFromBasket, t]);

  useScanTarget({
    id: "dispatch",
    title: t("camera.title"),
    context: branchFullName
      ? t("camera.context", { branch: branchFullName, value: cameraCount })
      : t("camera.contextNoBranch", { value: cameraCount }),
    hint: t("camera.hint"),
    icon: Truck,
    note: { title: t("camera.noteTitle"), text: t("camera.noteText") },
    progress: {
      done: pendingOrders.length,
      label: t("camera.meter", { value: formatNumberLocalized(selectedOrderIds.size, { language }) }),
    },
    list: cameraList,
    listTitle: t("camera.listTitle"),
    onScan: (rawValue) => {
      void handleScanValue(rawValue);
    },
    finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
  });

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

      removeFromBasket(assignedOrderIds);
      setIsCourierDialogOpen(false);
      setScanNotice(null);
      setRejectedScans([]);
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
  const visibleNotice = scanNotice;

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
            <Badge tone="success" dot role="status">
              {t("scanCard.usbReady")}
            </Badge>
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

      {/* Telefon (< 768): «Biriktirish — N ta» pastki menyu ustidagi panelda (spec §3.3, Q7). Kamera — markaziy
          «Skaner» tugmasi (sahifada ikkinchi skaner tugmasi yo'q, ega qarori 2026-10-19). */}
      {isPhone ? (
        <>
          <div aria-hidden="true" className="h-[72px] shrink-0" />
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 flex gap-2 border-t border-border bg-surface px-4 py-3">
            {assignButton}
          </div>
        </>
      ) : null}

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
