import { memo, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  BadgeCheck,
  Calendar,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Receipt,
  ShoppingCart,
  User,
  Wallet,
  X,
} from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import {
  useCashBox,
  type FinanceHistoryActor,
  type FinanceHistoryDetail,
} from "../../../entities/payments";
import { useTranslation } from "react-i18next";
import { getPaymentSourceTypeLabel } from "./paymentSourceType";

const fmt = (n: number) => Math.abs(n).toLocaleString("uz-UZ");

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return dateStr;
  }
};

const getPaymentMethodLabel = (value: string | null | undefined, t: (key: string) => string) => {
  const normalized = value?.toLowerCase();
  if (normalized === "cash") return t("cash");
  if (normalized === "click") return t("clickPayment");
  if (normalized === "payme") return t("paymePayment");
  if (normalized === "transfer") return t("transferOption");
  if (normalized === "click_to_market") return t("toMarketTransferOption");
  if (normalized === "card") return t("card");
  return value || "—";
};

const getRoleLabel = (value: string | null | undefined, t: (key: string) => string) => {
  const normalized = value?.toLowerCase();
  if (normalized === "market" || normalized === "markets" || normalized === "for_market") return t("marketShort");
  if (normalized === "courier" || normalized === "couriers" || normalized === "for_courier") return t("courierShort");
  if (normalized === "branch" || normalized === "branches" || normalized === "for_branch") return t("branchMainCashboxLabel");
  if (normalized === "main" || normalized === "hq") return t("mainCashbox");
  if (normalized === "customer") return t("customerRole");
  if (normalized === "admin") return t("adminRole");
  if (normalized === "superadmin") return t("superAdminRole");
  return value || t("user");
};

const getStatusLabel = (value: string | null | undefined, t: (key: string) => string) => {
  if (!value) return "—";
  if (value === "sold") return t("statusSold");
  if (value === "cancelled") return t("statusCancelled");
  if (value === "paid") return t("statusPaid");
  if (value === "partly_paid") return t("statusPartlyPaid");
  if (value === "new") return t("statusNew");
  if (value === "received") return t("statusReceived");
  return value;
};

const getDeliveryLabel = (value: string | null | undefined, t: (key: string) => string) => {
  if (value === "address") return t("deliveryAddress");
  if (value === "center") return t("deliveryCenter");
  return value || "—";
};

const getActorName = (actor?: Partial<FinanceHistoryActor> | null) => {
  const name =
    actor?.name?.trim() ||
    actor?.full_name?.trim() ||
    [actor?.first_name, actor?.last_name].filter(Boolean).join(" ").trim();

  return name || (actor?.id ? `#${actor.id}` : "—");
};

const resolvePrimaryActor = (
  detail?: FinanceHistoryDetail | null,
  row?: PaymentRow | null,
) => {
  const actors = [
    detail?.source_user,
    detail?.sourceUser,
    row?.source_user,
    row?.sourceUser,
    detail?.created_by_user,
    detail?.createdByUser,
    row?.created_by_user,
    row?.createdByUser,
    detail?.cashbox?.user,
    detail?.user,
    row?.user,
    detail?.order?.market,
  ];

  return actors.find(Boolean) ?? null;
};

const resolveDirectionValue = (
  detail: FinanceHistoryDetail | null | undefined,
  row: PaymentRow | null | undefined,
  actor: Partial<FinanceHistoryActor> | null,
) => {
  const actorName = getActorName(actor);
  if (actorName !== "—") return actorName;
  if (detail?.source_user_id) return `#${detail.source_user_id}`;
  if (row?.source_id) return `#${row.source_id}`;
  if (detail?.source_id) return `#${detail.source_id}`;
  if (detail?.cashbox?.id) return `#${detail.cashbox.id}`;
  return "—";
};

const getActorPhone = (actor?: Partial<FinanceHistoryActor> | null) =>
  actor?.phone_number?.trim() || actor?.phone?.trim() || "—";

const getHistoryCashboxId = (item?: Partial<FinanceHistoryDetail | PaymentRow> | null) =>
  item?.cashbox_id != null ? String(item.cashbox_id) : item?.cashbox?.id != null ? String(item.cashbox.id) : "";

const getDirectionCardClasses = (isIncome: boolean) =>
  isIncome
    ? "border-info/35 bg-linear-to-br from-info/14 to-info/7 dark:border-info/45 dark:from-info/25 dark:to-info/12"
    : "border-warning/35 bg-linear-to-br from-warning/16 to-error/8 dark:border-warning/45 dark:from-warning/24 dark:to-error/14";

const getDirectionIconClasses = (isIncome: boolean) =>
  isIncome
    ? "bg-linear-to-br from-info to-maindark text-primary"
    : "bg-linear-to-br from-warning-start to-warning-end text-primary";

const InfoCard = memo(
  ({
    icon,
    label,
    value,
    fullWidth = false,
    accentClassName = "bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10",
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    fullWidth?: boolean;
    accentClassName?: string;
  }) => (
    <div className={`rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:color-mix(in_srgb,var(--color-maindark)_4%,var(--color-primary))] p-3 dark:border-white/10 dark:bg-primarydark/55 ${fullWidth ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accentClassName}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] dark:text-white/75">
          {label}
        </span>
      </div>
      <div className="mt-2 text-[14px] font-semibold leading-5 text-[var(--color-maindark)] dark:text-white">
        {value}
      </div>
    </div>
  ),
);

InfoCard.displayName = "InfoCard";

const PopupState = memo(
  ({
    title,
    description,
    isError = false,
  }: {
    title: string;
    description: string;
    isError?: boolean;
  }) => (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          isError
            ? "bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-main/25 dark:text-white"
            : "bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-main/25 dark:text-white"
        }`}
      >
        {isError ? <MessageSquare size={24} /> : <Loader2 size={24} className="animate-spin" />}
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--color-maindark)] dark:text-white">{title}</p>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)] dark:text-white/75">
          {description}
        </p>
      </div>
    </div>
  ),
);

PopupState.displayName = "PopupState";

interface Props {
  row: PaymentRow | null;
  onClose: () => void;
}

const FinanceHistoryDetailPopup = memo(({ row, onClose }: Props) => {
  const { t } = useTranslation("payments");
  const { useGetFinanceHistoryById } = useCashBox();
  const rowId = row?.id ?? null;
  const { data, isLoading, isError } = useGetFinanceHistoryById(rowId, !!rowId);

  const fetchedDetail = data?.data;
  const rowCashboxId = getHistoryCashboxId(row);
  const detailCashboxId = getHistoryCashboxId(fetchedDetail);
  const isMismatchedDetail = Boolean(rowCashboxId && detailCashboxId && rowCashboxId !== detailCashboxId);
  const detail = isMismatchedDetail ? null : fetchedDetail;
  const display = detail
    ? {
        ...detail,
        operation_type: row?.operation_type ?? detail.operation_type,
        amount: row?.amount ?? detail.amount,
        balance_after: row?.balance_after ?? detail.balance_after,
        source_type: row?.source_type ?? detail.source_type,
        payment_method: row?.payment_method ?? detail.payment_method,
        payment_date: row?.payment_date ?? detail.payment_date,
        comment: row?.comment ?? detail.comment,
      }
    : row;
  const isIncome = display?.operation_type === "income";
  const actor = useMemo(() => resolvePrimaryActor(detail, row), [detail, row]);
  const actorName = getActorName(actor);
  const actorPhone = getActorPhone(actor);
  const hasComment = Boolean(display?.comment);
  const actorRole = getRoleLabel(
    actor?.role ?? detail?.order?.market?.role ?? detail?.cashbox?.cashbox_type ?? row?.cashbox_type,
    t,
  );
  const directionLabel = isIncome ? t("fromWhere") : t("toWhere");
  const directionValue = resolveDirectionValue(detail, row, actor);
  const directionRoleLabel = getRoleLabel(
    detail?.source_user?.role ??
      detail?.sourceUser?.role ??
      row?.source_user?.role ??
      row?.sourceUser?.role ??
      detail?.cashbox?.cashbox_type ??
      row?.cashbox_type,
    t,
  );
  const order = detail?.order;
  const locationLabel = [
    order?.district?.name ?? order?.customer?.district?.name ?? "",
    order?.region?.name ?? order?.customer?.region?.name ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  if (!row) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[color:color-mix(in_srgb,var(--color-background-deep)_72%,transparent)] p-2 pb-10 pt-4 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-[38rem] flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-primary shadow-2xl shadow-[0_28px_60px_var(--color-background-soft)] dark:border-white/10 dark:bg-maindark"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative shrink-0 overflow-hidden px-4 py-4 sm:px-5 sm:py-5"
          style={{
            background:
              isIncome
                ? "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 62%, var(--color-maindark)) 100%)"
                : "linear-gradient(135deg, var(--color-error) 0%, color-mix(in srgb, var(--color-error) 62%, var(--color-maindark)) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,var(--color-glass-border)_0,transparent_45%)]" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                {isIncome ? (
                  <ArrowUpRight size={20} className="text-primary" />
                ) : (
                  <ArrowDownRight size={20} className="text-primary" />
                )}
              </div>
              <div>
                <p className="text-[16px] font-bold capitalize text-primary">
                  {isIncome ? t("income") : t("expense")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-primary/80">
                  <Receipt size={12} />
                  {t("paymentHistory")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-primary transition-all hover:bg-white/30"
            >
              <X size={16} />
            </button>
          </div>

          <div className="my-3 h-px bg-white/20" />

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-primary/75">{t("amount")}</p>
              <p className="mt-1 text-[30px] leading-none font-extrabold text-primary">
                {isIncome ? "+" : "-"}
                {fmt(display?.amount ?? 0)}
                <span className="ml-1.5 text-[14px] font-medium uppercase text-primary/85">
                  {t("currency")}
                </span>
              </p>
            </div>

            {display?.balance_after !== undefined && (
              <div className="text-right">
                <p className="text-[10px] text-primary/70">{t("balanceAfterTransaction")}</p>
                <p className="mt-1 text-[13px] font-bold text-primary">
                  {fmt(display.balance_after)} {t("currency")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto bg-primary p-3 sm:p-4 dark:bg-maindark">
          {isLoading && (
            <PopupState
              title={t("detailLoading")}
              description={t("detailLoadingDescription")}
            />
          )}

          {!isLoading && isError && (
            <PopupState
              title={t("detailError")}
              description={t("detailErrorDescription")}
              isError
            />
          )}

          {!isLoading && !isError && (
            <>
              {hasComment && (
                <div className="rounded-2xl border border-[color:var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4 dark:border-[color:var(--color-warning-border)] dark:bg-[var(--color-warning-surface)]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-warning-start)] text-[var(--color-warning-text)] shadow-sm">
                      <MessageSquare size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning-end)] dark:text-[var(--color-warning-text)]">
                        {t("comment")}
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-maindark)] dark:text-primary">
                        {display?.comment}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`rounded-2xl border p-4 ${getDirectionCardClasses(isIncome)}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${getDirectionIconClasses(isIncome)}`}>
                    {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] dark:text-primary/85 ${isIncome ? "text-info" : "text-warning-end"}`}>
                      {directionLabel}
                    </p>
                    <p className="truncate text-sm font-bold text-[var(--color-maindark)] dark:text-primary">
                      {directionValue}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-muted)] dark:text-primary/65">
                      {directionRoleLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {actorPhone !== "—" && (
                  <InfoCard
                    icon={<Phone size={12} className="text-[color:var(--color-text-muted)] dark:text-white/80" />}
                    label={t("phoneNumber")}
                    value={actorPhone}
                    accentClassName="bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10"
                  />
                )}
                <InfoCard
                  icon={<CreditCard size={12} className="text-[color:var(--color-text-muted)] dark:text-white/80" />}
                  label={t("sourceType")}
                  value={getPaymentSourceTypeLabel(display?.source_type, t)}
                  accentClassName="bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10"
                />
                <InfoCard
                  icon={<Wallet size={12} className="text-[color:var(--color-text-muted)] dark:text-white/80" />}
                  label={t("paymentType")}
                  value={getPaymentMethodLabel(display?.payment_method, t)}
                  accentClassName="bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10"
                />
                <InfoCard
                  icon={<Calendar size={12} className="text-[color:var(--color-text-muted)] dark:text-white/80" />}
                  label={t("paymentDate")}
                  value={formatDate(display?.payment_date ?? display?.createdAt)}
                  accentClassName="bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10"
                />
                <InfoCard
                  icon={<User size={12} className="text-[color:var(--color-text-muted)] dark:text-white/80" />}
                  label={t("user")}
                  value={
                    <div className="flex flex-col gap-1">
                      <span>{actorName || detail?.created_by || "—"}</span>
                      <span className="inline-flex w-fit rounded-md border border-[color:var(--color-border-soft)] bg-[color:color-mix(in_srgb,var(--color-main)_12%,var(--color-primary))] px-2 py-0.5 text-[10px] font-bold text-[var(--color-main)] dark:border-white/10 dark:bg-main/25 dark:text-white">
                        {actorRole}
                      </span>
                    </div>
                  }
                  accentClassName="bg-[color:color-mix(in_srgb,var(--color-maindark)_8%,var(--color-primary))] dark:bg-white/10"
                />
              </div>

              {order && (
                <div className="overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--color-success)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_9%,var(--color-primary))] dark:border-white/10 dark:bg-primarydark/55">
                  <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-4 py-3 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 62%, var(--color-maindark)) 100%)",
                        }}
                      >
                        <ShoppingCart size={17} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-success)] dark:text-white/85">
                          {t("order")}
                        </p>
                        <p className="text-[15px] font-bold text-[var(--color-maindark)] dark:text-white">#{order.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-3 text-[14px]">
                    {hasComment && (
                      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-sidebar/70 p-3 dark:border-white/10 dark:bg-maindark/40">
                        <div className="mb-2 flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <MessageSquare size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>{t("comment")}</span>
                        </div>
                        <p className="whitespace-pre-line text-[var(--color-maindark)] dark:text-white">
                          {detail?.comment}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_auto] gap-y-2.5">
                      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                        <MapPin size={12} className="text-[var(--color-main)] dark:text-white" />
                        <span>{t("region")}</span>
                      </div>
                      <span className="text-right font-medium text-[var(--color-maindark)] dark:text-white">
                        {locationLabel || "—"}
                      </span>

                      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                        <Phone size={12} className="text-[var(--color-main)] dark:text-white" />
                        <span>{t("phoneNumber")}</span>
                      </div>
                      <span className="text-right font-medium text-[var(--color-maindark)] dark:text-white">
                        {order.customer?.phone_number || "—"}
                      </span>
                    </div>

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <Wallet size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>{t("totalPrice")}</span>
                        </div>
                        <span className="font-bold text-[var(--color-main)] dark:text-white">
                          {fmt(order.total_price ?? order.to_be_paid ?? 0)} {t("currency")}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <BadgeCheck size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>{t("transactionStatus")}</span>
                        </div>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-bold dark:border-white/10 dark:text-white"
                          style={{
                            color:
                              order.status === "sold" || order.status === "paid"
                                ? "var(--color-success)"
                                : "var(--color-error)",
                            background:
                              order.status === "sold" || order.status === "paid"
                                ? "color-mix(in srgb, var(--color-success) 15%, var(--color-primary))"
                                : "color-mix(in srgb, var(--color-error) 15%, var(--color-primary))",
                            borderColor:
                              order.status === "sold" || order.status === "paid"
                                ? "color-mix(in srgb, var(--color-success) 26%, transparent)"
                                : "color-mix(in srgb, var(--color-error) 26%, transparent)",
                          }}
                        >
                          {getStatusLabel(order.status, t)}
                        </span>
                      </div>
                    </div>

                    {order.address && (
                      <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <MapPin size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>{t("address")}</span>
                        </div>
                        <p className="mt-1 leading-5 text-[var(--color-maindark)] dark:text-white">{order.address}</p>
                      </div>
                    )}

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <ExternalLink size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>{t("delivery")}</span>
                        </div>
                        <span className="font-medium text-[var(--color-maindark)] dark:text-white">
                          {getDeliveryLabel(order.where_deliver, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

FinanceHistoryDetailPopup.displayName = "FinanceHistoryDetailPopup";

export default FinanceHistoryDetailPopup;
