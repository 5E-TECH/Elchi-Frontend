import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button } from "antd";
import type { TFunction } from "i18next";
import { ArrowRightLeft, Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getDispatchDestinations, type Branch } from "../../../entities/branch";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
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
  label: string;
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
    targets.push({
      id: check.hqBranch.id,
      name: check.hqBranch.name,
      label: `${check.hqBranch.name} · HQ`,
      disabled: false,
    });
  }

  destinations
    .filter((branch) => isDestinationBranch(branch) && branch.id !== currentBranchId)
    .forEach((branch) => {
      if (targets.some((target) => target.id === branch.id)) return;

      const hasNoManager = branch.has_manager === false;
      const typeLabel = t(`branchTypes.${String(branch.type).toLowerCase()}`);
      targets.push({
        id: branch.id,
        name: branch.name,
        label: `${branch.name} · ${typeLabel}${hasNoManager ? ` (${t("courierTransfer.noManager")})` : ""}`,
        disabled: hasNoManager,
      });
    });

  return targets;
};

const SummaryItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
      {label}
    </dt>
    <dd className="mt-1 break-words text-sm font-semibold text-maindark dark:text-white">
      {value}
    </dd>
  </div>
);

const TransferCourierModal = ({
  open,
  onClose,
  courierId,
  courierName,
}: TransferCourierModalProps) => {
  const { t } = useTranslation("branches");
  const { apiRequest } = useAppNotification();
  const [targetBranchId, setTargetBranchId] = useState("");
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
  const selectedTarget = targets.find((target) => target.id === targetBranchId && !target.disabled);
  const canTransfer = checkData?.canTransfer === true;
  const submitDisabled = !canTransfer || !selectedTarget || check.isFetching || transfer.isPending;

  const handleClose = () => {
    setTargetBranchId("");
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled || !selectedTarget) return;

    // 409/503 da server matni (sabablar bilan) bildirishnomada AYNAN chiqadi,
    // oyna ochiq qoladi va tekshiruv yangilanadi (useTransferCourier.onSettled).
    void apiRequest({
      request: () => transfer.mutateAsync({ courierId, branchId: selectedTarget.id }),
      successMessage: t("courierTransfer.success", {
        name: courierName || `#${courierId}`,
        branch: selectedTarget.name,
      }),
      onSuccess: handleClose,
    });
  };

  const formatSom = (amount: number) =>
    `${amount.toLocaleString("uz-UZ")} ${t("currencyAmountSuffix", { ns: "payments" })}`;

  const formatOrdersInHand = (data: CourierTransferCheck) => {
    const sampleIds = data.ordersSample.map((order) => `#${order.id}`);
    if (data.ordersInHand <= 0 || sampleIds.length === 0) return String(data.ordersInHand);

    const more = data.ordersInHand > sampleIds.length ? ", …" : "";
    return `${data.ordersInHand} (${sampleIds.join(", ")}${more})`;
  };

  const retryButton = (
    <Button size="small" loading={check.isFetching} onClick={() => void check.refetch()}>
      {t("courierTransfer.retry")}
    </Button>
  );

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
          className="inline-flex font-semibold text-main underline underline-offset-2 hover:text-main/80"
        >
          {t("courierTransfer.payHint")}
        </Link>
      );
    }

    // Filial kuryerining pulini faqat o'sha filial menejeri oladi — superadmin EMAS.
    return (
      <p className="m-0 font-medium">
        {t("courierTransfer.branchPayHint", { branch: data.currentBranch.name })}
      </p>
    );
  };

  const renderCheckStatus = () => {
    if (check.isPending) {
      return (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-slate-200/80 px-4 py-3 text-sm font-medium text-text-muted dark:border-white/10 dark:text-text-muted-dark"
        >
          <Loader2 size={16} className="shrink-0 animate-spin" />
          <span>{t("loading", { ns: "common" })}</span>
        </div>
      );
    }

    if (!checkData) {
      return (
        <Alert
          type="error"
          showIcon
          title={getApiErrorMessage(check.error, t("courierTransfer.checkFailed"))}
          action={retryButton}
        />
      );
    }

    if (checkData.reasons.length > 0 || !checkData.canTransfer) {
      return (
        <Alert
          type="error"
          showIcon
          title={t("courierTransfer.blocked")}
          description={
            <div className="space-y-2">
              {checkData.reasons.length > 0 ? (
                <ul className="m-0 list-disc space-y-1 pl-4">
                  {checkData.reasons.map((reason, index) => (
                    <li key={`${index}:${reason}`}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="m-0">{t("courierTransfer.checkFailed")}</p>
              )}
              {renderPayHint(checkData)}
            </div>
          }
          action={retryButton}
        />
      );
    }

    return <Alert type="success" showIcon title={t("courierTransfer.ok")} />;
  };

  const currentBranchLabel = checkData
    ? checkData.currentBranch
      ? checkData.currentBranch.name || `#${checkData.currentBranch.id}`
      : t("courierTransfer.noBranch")
    : "—";

  return (
    <FormPopup
      isOpen={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title={t("courierTransfer.title")}
      description={t("courierTransfer.description")}
      icon={<ArrowRightLeft size={22} />}
      submitLabel={t("courierTransfer.action")}
      isLoading={transfer.isPending}
      submitDisabled={submitDisabled}
      theme="branch"
      widthClassName="max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
          {courierName ? (
            <p className="m-0 truncate text-base font-bold text-maindark dark:text-white">
              {courierName}
            </p>
          ) : null}
          <dl className="m-0 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryItem label={t("courierTransfer.currentBranch")} value={currentBranchLabel} />
            <SummaryItem
              label={t("courierTransfer.balance")}
              value={checkData ? formatSom(checkData.balance) : "—"}
            />
            <SummaryItem
              label={t("courierTransfer.ordersInHand")}
              value={checkData ? formatOrdersInHand(checkData) : "—"}
            />
          </dl>
        </div>

        {renderCheckStatus()}

        <div className="space-y-2">
          <span className={popupLabelClassName}>{t("courierTransfer.targetBranch")}</span>
          <SearchableSelect
            label={t("courierTransfer.targetBranch")}
            name="courier-transfer-target"
            value={targetBranchId}
            onChange={setTargetBranchId}
            options={targets.map(({ id, label, disabled }) => ({ value: id, label, disabled }))}
            placeholder={t("courierTransfer.selectTarget")}
            icon={Building2}
            loading={destinations.isPending}
            disabled={!canTransfer || transfer.isPending}
            hideLabel
            surface="search"
          />
          {destinations.isError ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-300">
              <span>
                {getApiErrorMessage(destinations.error, t("courierTransfer.checkFailed"))}
              </span>
              <Button
                size="small"
                type="link"
                className="!px-0"
                onClick={() => void destinations.refetch()}
              >
                {t("courierTransfer.retry")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </FormPopup>
  );
};

export default TransferCourierModal;
