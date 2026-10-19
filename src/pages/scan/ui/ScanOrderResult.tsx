// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail
import { lazy, Suspense, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Banknote,
  Calendar,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  ExternalLink,
  FileText,
  Info,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Store,
  Tag,
  TriangleAlert,
  Truck,
  Usb,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canViewDispatchPage } from "../../../app/lib/access";
import { OrderStatusBadge } from "../../../entities/order";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { formatPhone, toTelHref } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Pressable,
  SkeletonLines,
  buttonClasses,
} from "../../../shared/ui/primitives";
import { buildTrackingContext, type OrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import { getBackendErrorMessage, scanAssignOrder } from "../lib/scanResource";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { DISPATCH_ROUTE, orderDetailRoute } from "../model/routes";
import {
  buildScanOrderView,
  getManagerScanActions,
  hasAnyManagerAction,
  type ManagerScanActions,
  type ScanOrderView,
  type ScanRoleKind,
} from "../model/scanOrderView";
import { useOrderDetailAccessRules } from "../model/useOrderDetailAccessRules";
import { useScanRedirect } from "../model/useScanRedirect";
import { useIsBelowLg, useIsBelowMd } from "../model/useViewport";
import { ScanActionCard } from "./ScanActionCard";
import { ScanAlert } from "./ScanAlert";
import { ScanAgainLink, ScanResultHeader } from "./ScanResultHeader";
import { ScanStickyBar } from "./ScanStickyBar";

/** Og'ir qismlar alohida chunk'da: kuryer telefoni tarix va sotish/bekor oynalarini yuklamaydi (spec G3 §8). */
const ScanTrackingCard = lazy(() => import("./ScanTrackingCard"));
const ManagerOrderDialogs = lazy(() => import("./ManagerOrderDialogs"));

type ScanOrderResultProps = {
  order: OrderDetail;
  /** Skanerlangan (normallashtirilgan) token — «Kuryerga biriktirish» uni `/dispatch` ga beradi. */
  token: string;
  roleKind: ScanRoleKind;
  /** Sarlavha ostidagi xabar (USB skaner bilan yaroqsiz QR o'qildi). */
  topNotice?: ReactNode;
  /** Menejer amali bajarildi — skan so'rovi qayta olinadi. */
  onChanged: () => void;
  /** Sotish / bekor oynasi ochiq — sahifaning USB skaneri to'xtaydi (oynadagi amal uzilmasin). */
  onDialogOpenChange: (open: boolean) => void;
};

type ResultMessage = { tone: "success" | "error"; text: string };

const LIST_ITEM = "flex min-h-14 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0";
const STAT_ICON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

const ResultAlert = ({ result }: { result: ResultMessage }) => (
  <ScanAlert
    tone={result.tone === "success" ? "success" : "danger"}
    icon={result.tone === "success" ? CircleCheck : TriangleAlert}
    title={result.text}
    role={result.tone === "success" ? "status" : "alert"}
  />
);

/**
 * «O'zimga olish» (P1b) — faqat kuryer: `POST orders/scan-assign { qr_token }`. Muvaffaqiyat → ovoz,
 * xabar, 1,5 s dan keyin `/scan`. Xato → ovoz va backend matni SO'ZMA-SO'Z (u aniq sababni aytadi:
 * «boshqa kuryerga biriktirilgan», «HQ da qabul qilinmagan» — maket `courier-scan-other-courier`).
 */
const useCourierAssign = (token: string) => {
  const { t } = useTranslation("scan");
  const scheduleRedirect = useScanRedirect(1500);
  const [result, setResult] = useState<ResultMessage | null>(null);
  const mutation = useMutation({
    mutationFn: () => scanAssignOrder(token),
    onSuccess: () => {
      void playScanFeedback("success");
      setResult({ tone: "success", text: t("courier.assignSuccess") });
      scheduleRedirect();
    },
    onError: (error) => {
      void playScanFeedback("error");
      setResult({ tone: "error", text: getBackendErrorMessage(error) ?? t("courier.assignError") });
    },
  });
  return { mutation, result };
};

/* ─── Kartalar ──────────────────────────────────────────────────────────── */

const MetaItem = ({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      {label}
    </dt>
    <dd className="m-0 min-w-0 font-semibold wrap-break-word text-text">{children}</dd>
  </div>
);

const SummaryCard = ({ view, staff }: { view: ScanOrderView; staff: boolean }) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsBelowMd();
  const titleId = useId();
  const date = view.createdAt ? formatDateTimeLocalized(view.createdAt, { language }) : null;
  const deliveryLabel = view.delivery ? t(view.delivery === "home" ? "order.deliveryHome" : "order.deliveryCenter") : null;
  // Maket: telefonda ma'lumot qatori yashirin, yetkazish turi badge bo'lib holat yonida (kuryer, menejer);
  // xodimlar maketida (`superadmin-scan-result`) «To'langan» telefonda ham ko'rinadi.
  const showMeta = !isPhone || staff;

  return (
    <Card padding="md" aria-labelledby={titleId} bodyClassName="flex flex-col gap-3">
      <h2 id={titleId} className="sr-only">
        {t("order.summary")}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="sr-only">{t("statusLabel")}</span>
        <OrderStatusBadge status={view.status} />
        {!showMeta && deliveryLabel ? (
          <>
            <span className="sr-only">{t("order.deliveryLabel")}</span>
            <Badge>{deliveryLabel}</Badge>
          </>
        ) : null}
        {date ? (
          <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-text-muted">
            <Calendar size={16} aria-hidden="true" />
            <span className="sr-only">{t("dateLabel")}</span>
            {date}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text-muted">{t("total")}</span>
        <span className="text-[28px] leading-9 font-bold tracking-[-.01em] text-text">
          {formatMoneyLocalized(view.total, { language, withCurrency: false })}
          <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
            {CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          </span>
        </span>
      </div>
      {showMeta ? (
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-4 gap-y-3 border-t border-border pt-3">
          <MetaItem icon={Store} label={t("order.sender")}>
            {view.marketName ?? "—"}
          </MetaItem>
          <MetaItem icon={Truck} label={t("order.delivery")}>
            {deliveryLabel ?? "—"}
          </MetaItem>
          <MetaItem icon={Package} label={t("order.products")}>
            {t("quantity", { count: view.items.length, value: formatNumberLocalized(view.items.length, { language }) })}
          </MetaItem>
          {staff ? (
            <>
              <MetaItem icon={Banknote} label={t("order.paid")}>
                {formatMoneyLocalized(view.paid, { language })}
              </MetaItem>
              <MetaItem icon={Calendar} label={t("order.created")}>
                {date ?? "—"}
              </MetaItem>
            </>
          ) : null}
        </dl>
      ) : null}
    </Card>
  );
};

const CustomerCard = ({ view }: { view: ScanOrderView }) => {
  const { t } = useTranslation("scan");
  const isPhone = useIsBelowMd();
  const name = view.customerName || "—";
  const phone = formatPhone(view.customerPhone);
  const telHref = toTelHref(view.customerPhone);
  const callLabel = t("order.call", { name, phone });

  return (
    <Card
      padding="none"
      title={isPhone ? undefined : t("order.customerTitle")}
      aria-label={isPhone ? t("order.customerTitle") : undefined}
    >
      <ul className="m-0 flex list-none flex-col p-0">
        <li className={LIST_ITEM}>
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
          >
            {view.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold wrap-break-word text-text">
              <span className="sr-only">{t("order.customerLabel")}</span>
              {name}
            </div>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{phone}</div>
          </div>
          {telHref ? (
            <a
              href={telHref}
              aria-label={callLabel}
              title={callLabel}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-action-soft text-action-fg transition-[background-color,color] duration-150 hover:bg-action hover:text-on-solid motion-reduce:transition-none"
            >
              <Phone size={20} aria-hidden="true" />
            </a>
          ) : null}
        </li>
        <li className={cx(LIST_ITEM, "items-start")}>
          <span className={STAT_ICON}>
            <MapPin size={20} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold wrap-break-word text-text">
              <span className="sr-only">{t("order.addressLabel")}</span>
              {view.place ?? "—"}
            </span>
            {view.address ? (
              <span className="text-[13px] wrap-break-word text-text-muted">{view.address}</span>
            ) : null}
          </div>
        </li>
        {view.comment ? (
          <li className={cx(LIST_ITEM, "items-start")}>
            <span className={STAT_ICON}>
              <MessageSquare size={20} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("order.comment")}</span>
              <p className="text-[13px] wrap-break-word text-text">{view.comment}</p>
            </div>
          </li>
        ) : null}
      </ul>
    </Card>
  );
};

const ProductsCard = ({ view }: { view: ScanOrderView }) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsBelowMd();

  return (
    <Card
      padding="none"
      title={t("order.products")}
      actions={
        isPhone && view.marketName ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-text-muted">
            <Store size={16} aria-hidden="true" />
            <span className="sr-only">{t("order.senderMarket")}</span>
            {view.marketName}
          </span>
        ) : undefined
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {view.items.length === 0 ? (
          <li className={cx(LIST_ITEM, "text-[13px] text-text-muted")}>{t("order.noProducts")}</li>
        ) : (
          view.items.map((item) => (
            <li key={item.key} className={cx(LIST_ITEM, "min-h-0 py-2.5")}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
                <Tag size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 font-semibold wrap-break-word text-text">{item.name}</span>
              <span className="whitespace-nowrap font-semibold text-text">
                {t("quantity", { count: item.quantity, value: formatNumberLocalized(item.quantity, { language }) })}
              </span>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
};

const TrackingFallback = () => {
  const { t } = useTranslation("scan");
  return (
    <Card title={t("history.title")} description={t("history.subtitle")}>
      <SkeletonLines />
    </Card>
  );
};

/* ─── Menejer ───────────────────────────────────────────────────────────── */

const CourierHeldAlert = ({ name }: { name: string | null }) => {
  const { t } = useTranslation("scan");
  return (
    <ScanAlert
      tone="info"
      icon={Truck}
      role="status"
      title={name ? t("manager.courierHeld", { name }) : t("manager.courierHeldNoName")}
    >
      {t("manager.courierHeldText")}
    </ScanAlert>
  );
};

type ManagerPanelProps = {
  view: ScanOrderView;
  actions: ManagerScanActions;
  onSell: () => void;
  onCancel: () => void;
  onDispatch: () => void;
};

const ManagerAside = ({ view, actions, onSell, onCancel, onDispatch }: ManagerPanelProps) => {
  const { t } = useTranslation("scan");
  const hints = [
    ...(actions.hasSellPermission ? [{ icon: Info, text: t("manager.rulesHint") }] : []),
    { icon: Usb, text: t("usbHint") },
  ];

  return (
    <ScanActionCard
      title={t("manager.title")}
      headerAction={
        <Link to={orderDetailRoute(view.id)} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <ExternalLink size={16} aria-hidden="true" className="shrink-0" />
          {t("manager.detail")}
        </Link>
      }
      text={actions.canSell ? t("manager.text") : null}
      hints={hints}
    >
      {actions.courierHeld ? <CourierHeldAlert name={view.courierName} /> : null}
      {actions.canSell ? (
        <Button size="lg" fullWidth leftIcon={Check} aria-haspopup="dialog" onClick={onSell}>
          {t("manager.sell")}
        </Button>
      ) : null}
      {actions.canDispatch ? (
        <Button variant="secondary" size="lg" fullWidth leftIcon={Truck} onClick={onDispatch}>
          {t("manager.dispatch")}
        </Button>
      ) : null}
      {actions.canCancel ? (
        <Button variant="danger-soft" size="lg" fullWidth leftIcon={X} aria-haspopup="dialog" onClick={onCancel}>
          {t("manager.cancel")}
        </Button>
      ) : null}
      {!actions.hasSellPermission && !actions.courierHeld ? (
        <p className="text-xs text-text-muted">{t("manager.noPermission")}</p>
      ) : null}
    </ScanActionCard>
  );
};

/** < 1024: «Boshqa amallar» kartasi (maket `manager-scan-result` planshet/telefon). */
const ManagerMoreCard = ({
  view,
  actions,
  dispatchInList,
  onDispatch,
}: {
  view: ScanOrderView;
  actions: ManagerScanActions;
  /** «Kuryerga biriktirish» shu ro'yxatda (pastki panelda sotish/bekor bo'lsa). */
  dispatchInList: boolean;
  onDispatch: () => void;
}) => {
  const { t } = useTranslation("scan");
  const rowClass = cx(
    LIST_ITEM,
    "w-full text-left text-text transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
  );
  const rowBody = (icon: LucideIcon, title: string, sub: string) => {
    const Icon = icon;
    return (
      <>
        <span className={STAT_ICON}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-text">{title}</span>
          <span className="text-[13px] text-text-muted">{sub}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-subtle" />
      </>
    );
  };

  return (
    <Card padding="none" title={t("manager.moreTitle")}>
      <ul className="m-0 flex list-none flex-col p-0">
        {dispatchInList ? (
          <li className="border-b border-border">
            <Pressable className={cx(rowClass, "border-b-0")} onClick={onDispatch}>
              {rowBody(Truck, t("manager.dispatch"), t("manager.dispatchSub"))}
            </Pressable>
          </li>
        ) : null}
        <li>
          <Link to={orderDetailRoute(view.id)} className={cx(rowClass, "border-b-0")}>
            {rowBody(FileText, t("manager.detailTitle"), t("manager.detailSub"))}
          </Link>
        </li>
      </ul>
      {!actions.hasSellPermission && !actions.courierHeld ? (
        <p className="border-t border-border px-4 py-3 text-xs text-text-muted">{t("manager.noPermission")}</p>
      ) : null}
    </Card>
  );
};

/* ─── Sahifa ────────────────────────────────────────────────────────────── */

/**
 * Buyurtma natijasi — bitta tuzilma hamma rol uchun (spec G3 §2.2): sarlavha, «Holat va summa», «Mijoz va
 * manzil» + «Mahsulotlar» (≥ 1024 ikki ustun), o'ngda (≥ 1024) amallar kartasi, < 1024 da pastki panel.
 * Rol farqi (§2.3): kuryer — «O'zimga olish»; superadmin/admin/registrator — «Holat tarixi» va «Buyurtma
 * sahifasi»; menejer — sotish / kuryerga biriktirish / bekor (tafsilotdagi qoidalar bilan); market — faqat
 * ma'lumot. Amal tugmasi DOM'da bir marta (yon karta YOKI pastki panel — `useIsBelowLg`).
 */
export const ScanOrderResult = ({
  order,
  token,
  roleKind,
  topNotice,
  onChanged,
  onDialogOpenChange,
}: ScanOrderResultProps) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const isBelowLg = useIsBelowLg();
  const isPhone = useIsBelowMd();
  const view = useMemo(() => buildScanOrderView(order), [order]);

  // Menejer amallari — buyurtma tafsilotidagi AYNI qoida (`getOrderDetailAccess`; modul faqat menejerga yuklanadi).
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const canViewDispatch = useSelector(canViewDispatchPage);
  const accessRules = useOrderDetailAccessRules(roleKind === "manager");
  const managerActions = useMemo(() => {
    if (!accessRules) return null;
    const canSellCancel = accessRules.getUserCanSellCancel(user);
    const access = accessRules.getOrderDetailAccess({
      role,
      branchType: accessRules.getOrderPageBranchType(user),
      canSellCancel,
      order,
    });
    return getManagerScanActions({ access, canSellCancel, courierHeld: view.courierHeld, canViewDispatch });
  }, [accessRules, canViewDispatch, order, role, user, view.courierHeld]);

  // `pending` — menejer qoidalari hali yuklanmoqda (bir lahza): amallar chizilmaydi.
  const layout: "courier" | "manager" | "detail" | "readonly" | "pending" =
    roleKind === "courier"
      ? "courier"
      : roleKind === "manager"
        ? managerActions === null
          ? "pending"
          : hasAnyManagerAction(managerActions)
            ? "manager"
            : "detail"
        : roleKind === "staff"
          ? "detail"
          : "readonly";
  const showTracking = roleKind === "staff";
  const trackingContext = useMemo(() => (showTracking ? buildTrackingContext(order) : undefined), [order, showTracking]);

  const { mutation: assignMutation, result: assignResult } = useCourierAssign(token);

  const [dialog, setDialog] = useState<"sell" | "cancel" | null>(null);
  useEffect(() => {
    onDialogOpenChange(dialog !== null);
    return () => onDialogOpenChange(false);
  }, [dialog, onDialogOpenChange]);

  const goDispatch = () => navigate(DISPATCH_ROUTE, { state: { scanToken: token } });

  const copyNumber = () => {
    void copyToClipboard(view.id).then((copied) => {
      if (copied) notify.success(t("order.numberCopied"));
      else notify.error(t("order.numberCopyFailed", { id: view.id }));
    });
  };

  const deliveryLabel = view.delivery
    ? t(view.delivery === "home" ? "order.deliveryHome" : "order.deliveryCenter")
    : null;
  const stickySummary = {
    title: t("order.summaryLine", { id: view.id, name: view.customerName || "—" }),
    sub: [formatMoneyLocalized(view.total, { language }), deliveryLabel].filter(Boolean).join(" · "),
  };

  const orderPageLink = (size: "md" | "lg", compact = false) => (
    <Link to={orderDetailRoute(view.id)} className={buttonClasses({ variant: "secondary", size, compact })}>
      {compact ? null : <ExternalLink size={18} aria-hidden="true" className="shrink-0" />}
      <span className="min-w-0 truncate">{t("order.orderPage")}</span>
    </Link>
  );

  const header = (
    <ScanResultHeader
      icon={CircleCheck}
      title={t("order.title", { id: view.id })}
      phoneTitle={t("order.phoneTitle", { id: view.id })}
      phoneSub={t("order.phoneSub")}
      sub={t("order.sub")}
      alertText={t("order.alertText")}
      titleAction={<IconButton size="sm" icon={Copy} label={t("order.copyNumber")} onClick={copyNumber} />}
      phoneDetailHref={layout === "readonly" ? null : orderDetailRoute(view.id)}
      phoneDetailLabel={t("order.openDetail")}
      actions={
        layout === "detail" ? (
          <>
            {orderPageLink("md")}
            <ScanAgainLink variant="primary" />
          </>
        ) : undefined
      }
    />
  );

  /* Kuryer: «O'zimga olish» — yon kartada (≥ 1024) yoki pastki panelda. */
  const assignButton = (block: boolean) => (
    <Button
      size="lg"
      fullWidth={block}
      leftIcon={Check}
      loading={assignMutation.isPending}
      loadingText={t("courier.assigning")}
      disabled={assignResult?.tone === "success"}
      onClick={() => assignMutation.mutate()}
    >
      {t("courier.assign")}
    </Button>
  );

  let aside: ReactNode = null;
  let mainExtras: ReactNode = null;
  let sticky: ReactNode = null;

  if (layout === "courier") {
    if (isBelowLg) {
      sticky = (
        <ScanStickyBar summary={stickySummary} notice={assignResult ? <ResultAlert result={assignResult} /> : null}>
          {assignButton(false)}
        </ScanStickyBar>
      );
    } else {
      aside = (
        <ScanActionCard title={t("courier.title")} text={t("courier.text")}>
          {assignResult ? <ResultAlert result={assignResult} /> : null}
          {assignButton(true)}
        </ScanActionCard>
      );
    }
  }

  if (layout === "manager" && managerActions) {
    const panel = {
      view,
      actions: managerActions,
      onSell: () => setDialog("sell"),
      onCancel: () => setDialog("cancel"),
      onDispatch: goDispatch,
    };
    if (isBelowLg) {
      const hasSellOrCancel = managerActions.canSell || managerActions.canCancel;
      mainExtras = (
        <>
          {managerActions.courierHeld ? <CourierHeldAlert name={view.courierName} /> : null}
          <ManagerMoreCard
            view={view}
            actions={managerActions}
            dispatchInList={managerActions.canDispatch && hasSellOrCancel}
            onDispatch={goDispatch}
          />
        </>
      );
      if (hasSellOrCancel) {
        sticky = (
          <ScanStickyBar summary={stickySummary}>
            {managerActions.canCancel ? (
              <Button variant="danger-soft" size="lg" leftIcon={X} aria-haspopup="dialog" onClick={panel.onCancel}>
                {t("manager.cancel")}
              </Button>
            ) : null}
            {managerActions.canSell ? (
              <Button size="lg" leftIcon={Check} aria-haspopup="dialog" onClick={panel.onSell}>
                {t("manager.sell")}
              </Button>
            ) : null}
          </ScanStickyBar>
        );
      } else if (managerActions.canDispatch) {
        sticky = (
          <ScanStickyBar summary={stickySummary}>
            <Button variant="secondary" size="lg" leftIcon={Truck} onClick={goDispatch}>
              {t("manager.dispatch")}
            </Button>
          </ScanStickyBar>
        );
      }
    } else {
      aside = <ManagerAside {...panel} />;
    }
  }

  if (layout === "detail") {
    const tracking = showTracking ? (
      <Suspense fallback={<TrackingFallback />}>
        <ScanTrackingCard orderId={view.id} context={trackingContext} />
      </Suspense>
    ) : null;
    if (isBelowLg) mainExtras = tracking;
    else aside = tracking;
    if (isPhone) {
      sticky = (
        <ScanStickyBar>
          {orderPageLink("lg", true)}
          <ScanAgainLink variant="primary" size="lg" compact />
        </ScanStickyBar>
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}
      {topNotice}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <SummaryCard view={view} staff={roleKind === "staff"} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
            <CustomerCard view={view} />
            <ProductsCard view={view} />
          </div>
          {mainExtras}
        </div>
        {aside ? (
          <aside
            aria-label={layout === "detail" ? t("history.title") : t("manager.title")}
            className="min-w-0 flex-[1_1_360px]"
          >
            {aside}
          </aside>
        ) : null}
      </div>
      {sticky}
      {layout === "manager" && managerActions && (managerActions.canSell || managerActions.canCancel) ? (
        <Suspense fallback={null}>
          <ManagerOrderDialogs
            order={order}
            dialog={dialog}
            onClose={() => setDialog(null)}
            onDone={onChanged}
          />
        </Suspense>
      ) : null}
    </div>
  );
};
