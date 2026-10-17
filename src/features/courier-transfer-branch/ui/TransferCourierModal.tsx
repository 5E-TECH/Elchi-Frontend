// dizayn-v2: superadmin-users-courier-transfer-dialog, admin-users-transfer-courier-dialog
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { ArrowRightLeft, CircleCheck, CircleX, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getDispatchDestinations, type Branch } from "../../../entities/branch";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  buttonClasses,
  Dialog,
  Skeleton,
  TextInput,
  TONE_SOFT,
} from "../../../shared/ui/primitives";
import { useCourierTransferCheck } from "../api/useCourierTransferCheck";
import { useTransferCourier } from "../api/useTransferCourier";
import type { CourierTransferCheck } from "../model/types";

interface TransferCourierModalProps {
  open: boolean;
  onClose: () => void;
  courierId: string;
  courierName?: string;
}

interface TransferTarget {
  id: string;
  name: string;
  /** Filial turi yorlig'i (badge): «HQ», «Viloyat», «Aralash». */
  typeLabel: string;
  disabled: boolean;
}

/**
 * Manzil ro'yxati (GET /branches/dispatch-destinations) faqat faol REGIONAL
 * va HYBRID filiallarni beradi; bu yerda ham qayta tekshiriladi — kuryer
 * PICKUP filialga hech qachon o'tkazilmaydi.
 */
const isDestinationBranch = (branch: Branch) =>
  branch.status === "active" && (branch.type === "REGIONAL" || branch.type === "HYBRID");

/**
 * Tanlov: HQ (tekshiruvdagi `hq_branch`) + manzil filiallar, kuryerning
 * hozirgi filialisiz. Menejeri yo'q filial ko'rinadi, lekin tanlanmaydi —
 * kuryer pulini u yerda qabul qiladigan odam yo'q (server ham rad etadi).
 */
const buildTransferTargets = (
  check: CourierTransferCheck,
  destinations: Branch[],
  t: TFunction,
): TransferTarget[] => {
  const currentBranchId = check.currentBranch?.id ?? "";
  const targets: TransferTarget[] = [];

  if (check.hqBranch && check.hqBranch.id !== currentBranchId) {
    targets.push({ id: check.hqBranch.id, name: check.hqBranch.name, typeLabel: "HQ", disabled: false });
  }

  destinations
    .filter((branch) => isDestinationBranch(branch) && branch.id !== currentBranchId)
    .forEach((branch) => {
      if (targets.some((target) => target.id === branch.id)) return;
      targets.push({
        id: branch.id,
        name: branch.name,
        typeLabel: t(`branchTypes.${String(branch.type).toLowerCase()}`),
        disabled: branch.has_manager === false,
      });
    });

  return targets;
};

/** Ismdan bosh harflar (avatar): «Sherzod Alimov» → «SA». */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

type AlertTone = "success" | "warning" | "danger";
const ALERT_ICON: Record<AlertTone, LucideIcon> = { success: CircleCheck, warning: TriangleAlert, danger: CircleX };

/** `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka, qalin sarlavha, 13 px matn. */
const TransferAlert = ({ tone, title, children }: { tone: AlertTone; title: ReactNode; children?: ReactNode }) => {
  const Icon = ALERT_ICON[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone])}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        <div className="font-bold">{title}</div>
        {children ? <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div> : null}
      </div>
    </div>
  );
};

/** Kuryer kartasidagi qator: telefonda «nom … qiymat», desktopda ustun (maket `HM` / `SM`). */
const SummaryItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-0.5 max-md:flex-row max-md:items-baseline max-md:justify-between max-md:gap-3">
    <dt className="text-[13px] text-text-muted">{label}</dt>
    <dd className="m-0 font-semibold text-text wrap-break-word max-md:text-right">{value}</dd>
  </div>
);

/**
 * KURYERNI BOSHQA FILIALGA O'TKAZISH — dizayn v2 oynasi (telefonda pastki varaqa).
 *
 * Maket `superadmin-users-courier-transfer-dialog`: kuryer kartasi (bosh harflar, ism, «Kuryer», ghost
 * «Qayta tekshirish») + hozirgi filial, qo'lidagi pul va buyurtmalar; tekshiruv natijasi (`.el-alert`
 * success / warning — sabablar AYNAN server matni); «Yangi filial *» — qidiruv + radio ro'yxat (filial turi
 * badge'i; menejersiz filial o'chiq va «Menejer yo'q — …» izohi); asosiy tugma «{filial}ga o'tkazish».
 *
 * Xulq (o'zgarmagan): `useCourierTransferCheck` — faqat muvaffaqiyatli tekshiruvga tayaniladi; manzillar
 * ro'yxati faqat ochilganda; PATCH xatosi (409/503) — server matni bildirishnomada, oyna ochiq qoladi va
 * tekshiruv yangilanadi (`useTransferCourier.onSettled`).
 */
const TransferCourierModal = ({ open, onClose, courierId, courierName }: TransferCourierModalProps) => {
  const { t, i18n } = useTranslation(["branches", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [targetBranchId, setTargetBranchId] = useState("");
  const [query, setQuery] = useState("");
  const listLabelId = useId();
  const check = useCourierTransferCheck(courierId, open);
  const destinations = useQuery({
    queryKey: queryKeys.courierTransfer.destinations,
    queryFn: () => getDispatchDestinations(),
    enabled: open,
    meta: { silentError: true },
  });
  const transfer = useTransferCourier();

  // Faqat muvaffaqiyatli tekshiruvga tayaniladi: qayta so'rov yiqilsa eski
  // "o'tkazish mumkin" natijasi ishlatilmaydi. Tekshiruv yangilanayotganda
  // esa yuborish tugmasi o'chiq (`check.isFetching`).
  const checkData = check.isSuccess ? check.data : undefined;
  const destinationBranches = destinations.data?.data;
  const targets = useMemo(
    () => (checkData ? buildTransferTargets(checkData, destinationBranches ?? [], t) : []),
    [checkData, destinationBranches, t],
  );
  const visibleTargets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? targets.filter((target) => target.name.toLocaleLowerCase().includes(needle)) : targets;
  }, [query, targets]);
  const selectedTarget = targets.find((target) => target.id === targetBranchId && !target.disabled);
  const canTransfer = checkData?.canTransfer === true;
  const listDisabled = !canTransfer || transfer.isPending;
  const submitDisabled = !canTransfer || !selectedTarget || check.isFetching || transfer.isPending;

  const handleClose = () => {
    setTargetBranchId("");
    setQuery("");
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled || !selectedTarget) return;

    // 409/503 da server matni (sabablar bilan) bildirishnomada AYNAN chiqadi,
    // oyna ochiq qoladi va tekshiruv yangilanadi (useTransferCourier.onSettled).
    try {
      await transfer.mutateAsync({ courierId, branchId: selectedTarget.id });
    } catch (error) {
      notify.error(t("error", { ns: "common" }), {
        description: getBackendErrorMessage(error) ?? t("serverRequestError", { ns: "common" }),
      });
      return;
    }
    notify.success(t("success", { ns: "common" }), {
      description: t("courierTransfer.success", {
        name: courierName || `#${courierId}`,
        branch: selectedTarget.name,
      }),
    });
    handleClose();
  };

  const money = (amount: number) => formatMoneyLocalized(amount, { language });

  const formatOrdersInHand = (data: CourierTransferCheck) => {
    const count = t("courierTransfer.ordersCount", { value: formatNumberLocalized(data.ordersInHand, { language }) });
    const sampleIds = data.ordersSample.map((order) => `#${order.id}`);
    if (data.ordersInHand <= 0 || sampleIds.length === 0) return count;

    const more = data.ordersInHand > sampleIds.length ? ", …" : "";
    return `${count} (${sampleIds.join(", ")}${more})`;
  };

  const renderPayHint = (data: CourierTransferCheck) => {
    if (data.balance <= 0 || !data.currentBranch) return null;

    // HQ kuryerining pulini superadmin/admin Asosiy kassaga qabul qiladi.
    if (data.currentBranch.type === "HQ") {
      return (
        <Link
          to={`/payments/cash-detail/${courierId}?type=courier`}
          state={{
            type: "courier",
            entity: { id: courierId, name: courierName, role: "courier", amount: data.balance },
          }}
          onClick={handleClose}
          className={buttonClasses({ variant: "link", size: "sm", className: "self-start" })}
        >
          {t("courierTransfer.payHint")}
        </Link>
      );
    }

    // Filial kuryerining pulini faqat o'sha filial menejeri oladi — superadmin EMAS.
    return <p className="m-0 font-semibold">{t("courierTransfer.branchPayHint", { branch: data.currentBranch.name })}</p>;
  };

  const renderCheckStatus = () => {
    if (check.isPending) {
      return <Skeleton shape="block" height={48} className="rounded-xl" />;
    }

    if (!checkData) {
      return (
        <TransferAlert tone="danger" title={getApiErrorMessage(check.error, t("courierTransfer.checkFailed"))} />
      );
    }

    if (checkData.reasons.length > 0 || !checkData.canTransfer) {
      return (
        <TransferAlert tone="warning" title={t("courierTransfer.blocked")}>
          <div className="flex flex-col gap-2">
            {checkData.reasons.length > 0 ? (
              <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
                {checkData.reasons.map((reason, index) => (
                  <li key={`${index}:${reason}`}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="m-0">{t("courierTransfer.checkFailed")}</p>
            )}
            {renderPayHint(checkData)}
          </div>
        </TransferAlert>
      );
    }

    return <TransferAlert tone="success" title={t("courierTransfer.ok")} />;
  };

  const currentBranchLabel = checkData
    ? checkData.currentBranch
      ? checkData.currentBranch.name || `#${checkData.currentBranch.id}`
      : t("courierTransfer.noBranch")
    : "—";

  const renderTargets = () => {
    if (check.isPending || (destinations.isPending && canTransfer)) {
      return (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} shape="block" height={48} className="rounded-xl" />
          ))}
        </div>
      );
    }

    return (
      <>
        {destinations.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-danger-fg">
            <span>{getApiErrorMessage(destinations.error, t("courierTransfer.checkFailed"))}</span>
            <Button variant="link" size="sm" onClick={() => void destinations.refetch()}>
              {t("retry", { ns: "common" })}
            </Button>
          </div>
        ) : null}
        <div role="radiogroup" aria-labelledby={listLabelId} className="flex flex-col gap-2">
          {visibleTargets.map((target) => {
            const disabled = target.disabled || listDisabled;
            const checked = target.id === targetBranchId && !target.disabled;
            const hintId = `${listLabelId}-${target.id}-hint`;
            return (
              <label
                key={target.id}
                className={cx(
                  "flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-150 motion-reduce:transition-none",
                  checked ? "border-action bg-action-soft" : "border-border bg-surface",
                  target.disabled ? "bg-sunken" : null,
                  disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-sunken",
                )}
              >
                <input
                  type="radio"
                  name="courier-transfer-target"
                  value={target.id}
                  checked={checked}
                  disabled={disabled}
                  aria-describedby={target.disabled ? hintId : undefined}
                  onChange={() => setTargetBranchId(target.id)}
                  className="size-[18px] shrink-0 accent-action disabled:opacity-45"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cx("font-semibold", target.disabled ? "text-text-muted" : "text-text")}>
                    {target.name}
                  </span>
                  {target.disabled ? (
                    <span id={hintId} className="inline-flex items-start gap-1.5 text-[13px] text-warning-fg">
                      <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                      {t("courierTransfer.noManagerHint")}
                    </span>
                  ) : null}
                </span>
                <Badge className="shrink-0">{target.typeLabel}</Badge>
              </label>
            );
          })}
          {visibleTargets.length === 0 && checkData ? (
            <p className="m-0 rounded-xl border border-dashed border-border px-4 py-3 text-center text-[13px] text-text-muted">
              {t("courierTransfer.noTargets")}
            </p>
          ) : null}
        </div>
      </>
    );
  };

  const displayName = courierName || `#${courierId}`;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("courierTransfer.title")}
      description={t("courierTransfer.description")}
      icon={ArrowRightLeft}
      size="lg"
      busy={transfer.isPending}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={transfer.isPending}>
            {t("cancel", { ns: "common" })}
          </Button>
          {/* `min-w-0`: telefonda (varaqa, tugmalar teng `flex-1`) uzun filial nomi «Bekor qilish»ni ekrandan
              surib chiqarmasin — matn qisqartiriladi (`truncate`), to'liq nom tugma nomida qoladi. */}
          <Button
            type="submit"
            leftIcon={ArrowRightLeft}
            className="min-w-0"
            disabled={submitDisabled && !transfer.isPending}
            loading={transfer.isPending}
            loadingText={t("courierTransfer.transferring")}
          >
            {selectedTarget
              ? t("courierTransfer.submitTo", { branch: selectedTarget.name })
              : t("courierTransfer.action")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section aria-label={displayName} className="flex flex-col gap-4 rounded-xl bg-sunken p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
            >
              {initialsOf(courierName ?? "")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-text">{courierName ?? displayName}</span>
              <span className="text-[13px] text-text-muted">{t("courierTransfer.courierRole")}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={RefreshCw}
              loading={check.isFetching && !check.isPending}
              onClick={() => void check.refetch()}
            >
              {t("courierTransfer.retry")}
            </Button>
          </div>
          <dl className="m-0 grid grid-cols-3 gap-x-4 gap-y-3 text-sm max-md:grid-cols-1 max-md:gap-2 max-md:border-t max-md:border-border max-md:pt-3">
            <SummaryItem label={t("courierTransfer.currentBranch")} value={currentBranchLabel} />
            <SummaryItem label={t("courierTransfer.balance")} value={checkData ? money(checkData.balance) : "—"} />
            <SummaryItem
              label={t("courierTransfer.ordersInHand")}
              value={checkData ? formatOrdersInHand(checkData) : "—"}
            />
          </dl>
        </section>

        {renderCheckStatus()}

        <div className="flex flex-col gap-2">
          <span id={listLabelId} className="text-[13px] font-semibold text-text">
            {t("courierTransfer.targetBranch")} <span className="text-danger-fg" aria-hidden="true">*</span>
          </span>
          <TextInput
            mode="search"
            value={query}
            onValueChange={setQuery}
            placeholder={t("courierTransfer.searchPlaceholder")}
            aria-label={t("courierTransfer.searchLabel")}
            disabled={!checkData}
          />
          {renderTargets()}
        </div>
      </div>
    </Dialog>
  );
};

export default TransferCourierModal;
