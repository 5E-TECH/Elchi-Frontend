// dizayn-v2: superadmin-mails-detail-send-dialog, admin-mails-send-branch-dialog, registrator-mails-detail-send-dialog
import { memo, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Building2, Globe, Info, Phone, Send, TriangleAlert, Truck, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import {
  useDispatchPostToBranch,
  useDispatchPostToCourier,
  type CourierDestination,
} from "../../../../entities/mails";
import type { Branch } from "../../../../entities/branch";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import { Badge, Button, Dialog, EmptyState, ErrorState, SegmentedControl } from "../../../../shared/ui/primitives";
import { DetailAlert } from "../../../new_orders/components/detail/DetailAlert";

/** Jo'natish manzili turi: filial (menejer qabul qiladi) yoki HQ kuryeri (to'g'ridan-to'g'ri, qaytarilmaydi). */
export type SendKind = "branch" | "courier";

/**
 * POCHTANI JO'NATISH — «Manzilni tanlang» oynasi (`Dialog`, telefonda pastki varaqa).
 *
 * Maketlar (filial yo'li): `superadmin-mails-detail-send-dialog`, `admin-mails-send-branch-dialog`,
 * `registrator-mails-detail-send-dialog`. Kuryer yo'li, tablar va tasdiq bosqichi — maket yo'q (ega qarori
 * 2026-11-15), eng yaqini: `superadmin-mails-detail-send-dialog` + `registrator-dispatch-courier-select-dialog`.
 *
 * Ikki tur bitta oynada, adashmaslik uchun (ega: «filial bilan kuryerni almashtirib yuborishmasin»):
 *  - tablar (`SegmentedControl lg`): «Filialga · n» (`Building2`) va «HQ kuryeriga · n» (`Truck`); tur almashsa
 *    ikkala tanlov tozalanadi, hech narsa oldindan tanlanmaydi; tur rangi yo'q (badge'lar neytral — §8, ega Q3);
 *  - filial kartasi: neytral `Building2`, nom, telefon, «Filial menejeri qabul qiladi»; menejeri yo'q filial o'chiq
 *    va izohli (registratorda «adminga murojaat qiling»). Asosiy tugma «Filialga jo'natish — n ta» (`Send`),
 *    bitta qadam: `POST branches/posts/:id/dispatch` (`useDispatchPostToBranch`) — qaytariladi
 *    (`branches/posts/:id/reassign`);
 *  - kuryer paneli: tepada ogohlantirish (buyurtmalar filialga bormaydi), kartada neytral `Truck`, nom, telefon,
 *    «HQ kuryeri»; tashqi yetkazuvchiga bog'langan bo'lsa «Tashqi: «X»» (`Globe`), akkaunt to'xtatilgan bo'lsa
 *    karta o'chiq + «To'xtatilgan»; `serves_all_regions` — «Barcha viloyatlar». Asosiy tugma «Kuryerga berish — n ta»
 *    (`Truck`) TASDIQ BOSQICHINI ochadi (shu oynada): kuryer, telefon, tashqi yetkazuvchi, viloyat, son va
 *    «Filial menejeri qabul qilmaydi» ogohlantirishi; «Orqaga» — so'rovsiz qaytadi, «Ha, kuryerga berish» —
 *    `POST branches/posts/:id/dispatch-to-courier` (`useDispatchPostToCourier`; qaytarib bo'lmaydi).
 *
 * Ro'yxatlar ota sahifada «Pochtani jo'natish» bosilganda olinadi (ikkalasi parallel); biri yiqilsa — o'z tabida
 * `ErrorState` + «Qayta urinish» (`onRetry`), bo'sh bo'lsa — `EmptyState` (kuryer: rolga qarab qayerda biriktiriladi).
 * So'rov ketayotganda oyna yopilmaydi.
 */
interface SendPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  selectedIds: Set<string>;
  onSuccess: (sentIds?: string[]) => void;
  /** Viloyat nomi — ro'yxat sarlavhasi («Qashqadaryo viloyatidagi faol filiallar»). */
  regionName?: string | null;
  /** Viloyatdagi faol filiallar; `null` — olinmadi (`branchesError`). */
  branches: Branch[] | null;
  /** Filiallar so'rovi xatosi (axios xatosi — `ErrorState` turini va backend matnini shundan oladi). */
  branchesError?: unknown;
  /** Pochta viloyatiga xizmat qiladigan HQ kuryerlari; `null` — olinmadi (`couriersError`). */
  couriers: CourierDestination[] | null;
  couriersError?: unknown;
  /** Tashqi yetkazuvchi ma'lumoti olinmadi — ro'yxat ustida izoh. */
  carrierLookupFailed: boolean;
  onRetry: (kind: SendKind) => void;
  /** Qaysi ro'yxat qayta so'ralmoqda («Qayta urinish» tugmasida spinner). */
  retrying?: SendKind | null;
}

/** Nomi allaqachon tur so'zi bilan tugasa («Toshkent sh.», «… viloyati») — «viloyatidagi» qo'shilmaydi. */
const REGION_WITH_KIND = /(viloyati|sh\.|shahri|shahar|respublikasi)$/i;

/** `.el-stat-icon` — neytral ikonka qutisi (maket `registrator-dispatch-courier-select-dialog`). */
const TYPE_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";
/** `.el-choice-card` (maket `*-mails-detail-send-dialog`). */
const CARD =
  "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-[background-color,border-color] duration-150 motion-reduce:transition-none";
const CARD_ENABLED =
  "cursor-pointer border-border-strong bg-surface hover:bg-row-hover has-[:checked]:border-action has-[:checked]:bg-action-soft";
const CARD_DISABLED = "cursor-not-allowed border-border bg-sunken";
/** Radio ikonka qutisining o'rtasida (36 px quti, 18 px radio). */
const RADIO = "mt-[9px] size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed";
const LEGEND = "mb-2 p-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted";
const HINT_WARN = "mt-0.5 inline-flex items-start gap-1.5 text-[13px] text-warning-fg";

const TypeIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span aria-hidden="true" className={TYPE_ICON}>
    <Icon size={18} strokeWidth={2} />
  </span>
);

const PhoneLine = ({ value }: { value: string }) => (
  <span className="inline-flex items-center gap-1.5 text-[13px] text-text-muted">
    <Phone aria-hidden="true" size={14} className="shrink-0" />
    {formatPhone(value) || value || "—"}
  </span>
);

const SendPostModal = memo(
  ({
    isOpen,
    onClose,
    postId,
    selectedIds,
    onSuccess,
    regionName,
    branches,
    branchesError,
    couriers,
    couriersError,
    carrierLookupFailed,
    onRetry,
    retrying = null,
  }: SendPostModalProps) => {
    const { t, i18n } = useTranslation("mails");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const { apiRequest } = useAppNotification();
    const role = useSelector((state: RootState) => state.role.role);
    const dispatchPostToBranch = useDispatchPostToBranch();
    const dispatchPostToCourier = useDispatchPostToCourier();
    const branchGroup = useId();
    const courierGroup = useId();

    const branchList = branches ?? [];
    const courierList = couriers ?? [];
    const hasBranchError = branches === null && branchesError != null;
    const hasCourierError = couriers === null && couriersError != null;
    const open = isOpen && (branchList.length > 0 || courierList.length > 0 || hasBranchError || hasCourierError);
    const initialKind: SendKind = branchList.length > 0 ? "branch" : "courier";

    const [kind, setKind] = useState<SendKind>(initialKind);
    const [branchId, setBranchId] = useState("");
    const [courierId, setCourierId] = useState("");
    const [step, setStep] = useState<"select" | "confirm">("select");
    // Har ochilishda boshidan: tur — filial bor bo'lsa filial, aks holda kuryer; tanlov va bosqich tozalanadi
    // (holat chizish paytida yangilanadi — `ConfirmDialog` dagi `wasOpen` kabi).
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
      setWasOpen(open);
      if (open) {
        setKind(initialKind);
        setBranchId("");
        setCourierId("");
        setStep("select");
      }
    }

    const orderIds = Array.from(selectedIds);
    const orderCount = orderIds.length;
    const value = formatNumberLocalized(orderCount, { language });
    const isPending = dispatchPostToBranch.isPending || dispatchPostToCourier.isPending;

    const reset = () => {
      setBranchId("");
      setCourierId("");
      setStep("select");
      dispatchPostToBranch.reset();
      dispatchPostToCourier.reset();
    };

    const close = () => {
      if (isPending) return;
      reset();
      onClose();
    };

    const changeKind = (next: SendKind) => {
      if (isPending || next === kind) return;
      setKind(next);
      setBranchId("");
      setCourierId("");
      setStep("select");
    };

    const region = regionName?.trim() || branchList[0]?.region?.name?.trim() || "";
    const branchLegend = !region
      ? t("detailPage.sendDialog.legendNoRegion")
      : REGION_WITH_KIND.test(region)
        ? t("detailPage.sendDialog.legendPlain", { region })
        : t("detailPage.sendDialog.legend", { region });
    const courierLegend = region
      ? t("detailPage.sendDialog.courierLegend", { region })
      : t("detailPage.sendDialog.courierLegendNoRegion");
    const isRegistrator = role === "registrator";
    const noManagerHint = t(
      isRegistrator ? "detailPage.sendDialog.noManagerRegistrator" : "detailPage.sendDialog.noManager",
    );

    const selectedCourier = courierList.find((item) => item.courier_user_id === courierId) ?? null;
    const courierName = (courier: CourierDestination) => courier.name || courier.courier_user_id;

    const submitBranch = () => {
      if (!branchId || isPending) return;

      const branch = branchList.find((item) => item.id === branchId);
      if (!branch?.has_manager) {
        notify.error(t("branchManagerRequiredTitle"), { description: t("branchManagerRequiredDescription") });
        return;
      }

      void apiRequest({
        request: () =>
          dispatchPostToBranch.mutateAsync({
            postId,
            payload: { destinationBranchId: branchId, orderIds },
          }),
        successMessage: t("sendBranchSuccess", { name: branch.name ?? "" }),
        errorMessage: t("sendError"),
        onSuccess: () => {
          reset();
          onSuccess(orderIds);
          onClose();
        },
      });
    };

    const submitCourier = () => {
      if (!selectedCourier || selectedCourier.carrier_active === false || isPending) return;
      const name = courierName(selectedCourier);
      void apiRequest({
        request: () =>
          dispatchPostToCourier.mutateAsync({
            postId,
            payload: { courierId: selectedCourier.courier_user_id, orderIds },
          }),
        // Backend bekor qilingan / yopilganlarni jim o'tkazib yuboradi — xabarda haqiqatda berilgan son.
        successMessage: (data) => {
          const moved = data?.data?.moved_orders_count ?? orderCount;
          return t("sendCourierSuccess", { value: formatNumberLocalized(moved, { language }), count: moved, name });
        },
        errorMessage: t("sendError"),
        onSuccess: (data) => {
          const moved = data?.data?.moved_order_ids;
          reset();
          onSuccess(Array.isArray(moved) && moved.length > 0 ? moved.map(String) : orderIds);
          onClose();
        },
      });
    };

    const tabLabel = (target: SendKind) => {
      if (target === "branch") {
        return hasBranchError
          ? t("detailPage.sendDialog.tabBranchShort")
          : t("detailPage.sendDialog.tabBranch", { count: branchList.length });
      }
      return hasCourierError
        ? t("detailPage.sendDialog.tabCourierShort")
        : t("detailPage.sendDialog.tabCourier", { count: courierList.length });
    };

    const errorPanel = (target: SendKind, error: unknown) => (
      <ErrorState
        size="chart"
        error={error}
        title={t(target === "branch" ? "branchesLoadError" : "couriersLoadError")}
        onRetry={() => onRetry(target)}
        retrying={retrying === target}
        className="min-h-0"
      />
    );

    const branchPanel: ReactNode = hasBranchError ? (
      errorPanel("branch", branchesError)
    ) : branchList.length === 0 ? (
      <EmptyState size="chart" icon={Building2} title={t("detailPage.sendDialog.noBranches")} className="min-h-0" />
    ) : (
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={LEGEND}>{branchLegend}</legend>
        {branchList.map((branch) => {
          const disabled = !branch.has_manager;
          return (
            <label key={branch.id} className={cx(CARD, disabled ? CARD_DISABLED : CARD_ENABLED)}>
              <input
                type="radio"
                name={branchGroup}
                value={branch.id}
                checked={branchId === branch.id}
                disabled={disabled || isPending}
                onChange={() => setBranchId(branch.id)}
                className={RADIO}
              />
              <TypeIcon icon={Building2} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cx("font-semibold", disabled ? "text-text-muted" : "text-text")}>{branch.name}</span>
                <PhoneLine value={branch.phone_number ?? ""} />
                {disabled ? (
                  <span className={HINT_WARN}>
                    <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                    {noManagerHint}
                  </span>
                ) : (
                  <span className="text-[13px] text-text-muted">{t("detailPage.sendDialog.branchHint")}</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
    );

    const courierBadges = (courier: CourierDestination) => (
      <span className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge>{t("detailPage.sendDialog.typeCourier")}</Badge>
        {courier.carrier_name ? (
          <Badge variant="outline" icon={Globe}>
            {t("detailPage.sendDialog.carrierBadge", { name: courier.carrier_name })}
          </Badge>
        ) : null}
        {courier.carrier_active === false ? (
          <Badge tone="danger">{t("detailPage.sendDialog.carrierStoppedBadge")}</Badge>
        ) : null}
        {courier.region_match === "all_regions" ? <Badge>{t("detailPage.sendDialog.allRegions")}</Badge> : null}
      </span>
    );

    const courierPanel: ReactNode = (
      <div className="flex min-w-0 flex-col gap-3">
        <DetailAlert tone="warning" icon={TriangleAlert} role="note">
          {t("detailPage.sendDialog.courierAlert")}
        </DetailAlert>
        {hasCourierError ? (
          errorPanel("courier", couriersError)
        ) : courierList.length === 0 ? (
          <EmptyState
            size="chart"
            icon={Truck}
            title={t("detailPage.sendDialog.noCouriers")}
            description={t(
              isRegistrator ? "detailPage.sendDialog.noCouriersHintRegistrator" : "detailPage.sendDialog.noCouriersHint",
            )}
            className="min-h-0"
          />
        ) : (
          <>
            {carrierLookupFailed ? (
              <p className="m-0 inline-flex items-start gap-1.5 text-[13px] text-text-muted">
                <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
                {t("detailPage.sendDialog.carrierLookupFailed")}
              </p>
            ) : null}
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className={LEGEND}>{courierLegend}</legend>
              {courierList.map((courier) => {
                const disabled = courier.carrier_active === false;
                return (
                  <label key={courier.courier_user_id} className={cx(CARD, disabled ? CARD_DISABLED : CARD_ENABLED)}>
                    <input
                      type="radio"
                      name={courierGroup}
                      value={courier.courier_user_id}
                      checked={courierId === courier.courier_user_id}
                      disabled={disabled || isPending}
                      onChange={() => setCourierId(courier.courier_user_id)}
                      className={RADIO}
                    />
                    <TypeIcon icon={Truck} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cx("font-semibold", disabled ? "text-text-muted" : "text-text")}>
                        {courierName(courier)}
                      </span>
                      <PhoneLine value={courier.phone} />
                      {courierBadges(courier)}
                      {disabled ? (
                        <span className={HINT_WARN}>
                          <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                          {t("detailPage.sendDialog.carrierStopped")}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </>
        )}
      </div>
    );

    const confirming = kind === "courier" && step === "confirm" && selectedCourier !== null;
    // Tasdiq bosqichi ochilganda fokus «Orqaga»da (`ConfirmDialog` dagi kabi — qaytarib bo'lmaydigan amal xavfsiz
    // tugmadan boshlanadi): aks holda fokus o'sha joydagi asosiy tugmada qolib, Enter takrori darhol berib yuborardi.
    const backRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
      if (confirming) backRef.current?.focus();
    }, [confirming]);
    // «Kuryerga berish» ikki marta bosilsa, ikkinchi bosish shu joyga chiqqan «Ha, kuryerga berish»ga tushadi —
    // tasdiq faqat alohida bosish bilan (`detail > 1` — ikki / uch karra bosishning davomi).
    const confirmClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail > 1) return;
      submitCourier();
    };

    const confirmBody = selectedCourier ? (
      <div className="flex min-w-0 flex-col gap-4">
        <section
          aria-label={t("courier")}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4 max-md:p-3.5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <TypeIcon icon={Truck} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-text wrap-break-word">{courierName(selectedCourier)}</span>
              <PhoneLine value={selectedCourier.phone} />
              {courierBadges(selectedCourier)}
            </div>
          </div>
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-sm">
            <dt className="text-text-muted">{t("detailRegion")}</dt>
            <dd className="m-0 text-right font-semibold text-text wrap-break-word">{region || "—"}</dd>
            <dt className="text-text-muted">{t("ordersLabel")}</dt>
            <dd className="m-0 text-right font-semibold text-text">{t("detailPage.statOrders", { value })}</dd>
          </dl>
        </section>
        <DetailAlert tone="warning" icon={TriangleAlert} role="note">
          {selectedCourier.carrier_name
            ? t("detailPage.sendDialog.confirmCarrierText", {
                value,
                count: orderCount,
                carrier: selectedCourier.carrier_name,
                name: courierName(selectedCourier),
              })
            : t("detailPage.sendDialog.confirmText", { value, count: orderCount, name: courierName(selectedCourier) })}
        </DetailAlert>
      </div>
    ) : null;

    const footer = confirming ? (
      <>
        <Button ref={backRef} variant="secondary" disabled={isPending} onClick={() => setStep("select")}>
          {t("back", { ns: "common" })}
        </Button>
        <Button leftIcon={Truck} loading={isPending} loadingText={t("sending")} onClick={confirmClick}>
          {t("detailPage.sendDialog.confirmOk")}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" disabled={isPending} onClick={close}>
          {t("cancel", { ns: "common" })}
        </Button>
        {kind === "branch" ? (
          <Button
            leftIcon={Send}
            disabled={!branchId}
            loading={isPending}
            loadingText={t("sending")}
            onClick={submitBranch}
          >
            {t("detailPage.sendDialog.submitBranch", { value, count: orderCount })}
          </Button>
        ) : (
          <Button
            leftIcon={Truck}
            disabled={!selectedCourier || selectedCourier.carrier_active === false}
            onClick={() => setStep("confirm")}
          >
            {t("detailPage.sendDialog.submitCourier", { value, count: orderCount })}
          </Button>
        )}
      </>
    );

    return (
      <Dialog
        open={open}
        onClose={close}
        busy={isPending}
        size="md"
        icon={confirming ? Truck : Send}
        title={t(confirming ? "detailPage.sendDialog.confirmTitle" : "detailPage.sendDialog.title")}
        description={t(
          kind === "branch" ? "detailPage.sendDialog.descriptionBranch" : "detailPage.sendDialog.descriptionCourier",
          { value, count: orderCount },
        )}
        footer={footer}
      >
        {confirming ? (
          confirmBody
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <SegmentedControl<SendKind>
              ariaLabel={t("detailPage.sendDialog.tabsLabel")}
              size="lg"
              fullWidth
              value={kind}
              onValueChange={changeKind}
              options={[
                { value: "branch", icon: Building2, label: tabLabel("branch"), disabled: isPending },
                { value: "courier", icon: Truck, label: tabLabel("courier"), disabled: isPending },
              ]}
            />
            {kind === "branch" ? branchPanel : courierPanel}
          </div>
        )}
      </Dialog>
    );
  },
);

SendPostModal.displayName = "SendPostModal";

export default SendPostModal;
