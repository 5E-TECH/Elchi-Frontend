import { memo, useMemo } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ArrowRight,
  CreditCard,
  Calendar,
  User,
  Landmark,
  ExternalLink,
  Phone,
  ShoppingCart,
  MapPin,
  Wallet,
  CircleDollarSign,
  Package,
  Loader2,
} from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import type { PaymentRow } from "./patmentHistoryTable";
import {
  useCashBox,
  type FinanceHistoryActor,
  type FinanceHistoryDetail,
} from "../../../entities/payments";

// ─── Utils ────────────────────────────────────────────────────────────────────

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

const getOperationLabel = (value?: string | null) => {
  if (value === "income") return "Income";
  if (value === "expense") return "Expense";
  return value || "—";
};

const getSourceTypeLabel = (value?: string | null) => {
  const normalized = value?.toLowerCase();
  if (normalized === "sell") return "Sale";
  if (normalized === "correction") return "Correction";
  if (normalized === "salary") return "Salary";
  if (normalized === "market_payment") return "Market payment";
  if (normalized === "manual_income") return "Manual income";
  if (normalized === "manual_expense") return "Manual expense";
  return value || "—";
};

const getPaymentMethodLabel = (value?: string | null) => {
  const normalized = value?.toLowerCase();
  if (normalized === "cash") return "Cash";
  if (normalized === "click") return "Click";
  if (normalized === "payme") return "Payme";
  if (normalized === "transfer") return "Transfer";
  if (normalized === "card") return "Card";
  return value || "—";
};

const getCashboxTypeLabel = (value?: string | null) => {
  if (value === "markets") return "Markets";
  if (value === "couriers") return "Couriers";
  return value || "—";
};

const getRoleLabel = (value?: string | null) => {
  if (value === "market") return "Market";
  if (value === "courier") return "Courier";
  if (value === "customer") return "Customer";
  if (value === "admin") return "Admin";
  if (value === "superadmin") return "Super Admin";
  return value || "User";
};

const getStatusLabel = (value?: string | null) => {
  if (!value) return "—";
  if (value === "sold") return "Sold";
  if (value === "cancelled") return "Cancelled";
  if (value === "paid") return "Paid";
  if (value === "partly_paid") return "Partly paid";
  if (value === "new") return "New";
  if (value === "received") return "Received";
  return value;
};

const getDeliveryLabel = (value?: string | null) => {
  if (value === "address") return "Manzilga";
  if (value === "center") return "Markazga";
  return value || "—";
};

const getActorName = (actor?: FinanceHistoryActor | null) =>
  actor?.name?.trim() || actor?.id || "—";

const resolvePrimaryActor = (detail?: FinanceHistoryDetail | null) => {
  if (!detail) return null;

  return (
    detail.source_user ||
    detail.created_by_user ||
    detail.user ||
    (detail.cashbox?.cashbox_type === "markets" ? detail.order?.market : null) ||
    null
  );
};

const resolveDirectionValue = (
  detail: FinanceHistoryDetail | null | undefined,
  actor: FinanceHistoryActor | null,
) => {
  if (actor?.name) return actor.name;
  if (detail?.source_id) return detail.source_id;
  if (detail?.cashbox?.id) return `#${detail.cashbox.id}`;
  return "—";
};

const getActorPhone = (actor?: FinanceHistoryActor | null) =>
  actor?.phone_number?.trim() || "—";

// ─── InfoCard ─────────────────────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accentClassName?: string;
  fullWidth?: boolean;
}

const InfoCard = memo(
  ({ icon, label, value, accentClassName = "bg-main/15", fullWidth }: InfoCardProps) => (
    <div
      className={`flex flex-col gap-1.5 rounded-xl p-3.5 bg-white/5 border border-white/10 ${fullWidth ? "col-span-2" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={`w-5 h-5 rounded-md flex items-center justify-center ${accentClassName}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          {label}
        </span>
      </div>
      <div className="text-[13px] font-semibold text-white/90 pl-0.5">
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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          isError ? "bg-error/15 text-error" : "bg-primary/15 text-primary"
        }`}
      >
        {isError ? (
          <MessageSquare size={24} />
        ) : (
          <Loader2 size={24} className="animate-spin" />
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-primary">{title}</p>
        <p className="mt-1 text-xs text-primary/55">{description}</p>
      </div>
    </div>
  ),
);

PopupState.displayName = "PopupState";

// ─── FinanceHistoryDetailPopup ────────────────────────────────────────────────

interface Props {
  row: PaymentRow | null;
  onClose: () => void;
}

const FinanceHistoryDetailPopup = memo(({ row, onClose }: Props) => {
  const { getFinanceHistoryById } = useCashBox();
  const rowId = row?.id ?? null;
  const { data, isLoading, isError } = getFinanceHistoryById(rowId, !!rowId);

  const detail = data?.data;
  const display = detail ?? row;
  const isIncome = display?.operation_type === "income";
  const actor = useMemo(() => resolvePrimaryActor(detail), [detail]);
  const actorName = getActorName(actor);
  const actorPhone = getActorPhone(actor);
  const directionLabel = isIncome ? "Qayerdan" : "Qayerga";
  const directionValue = resolveDirectionValue(detail, actor);
  const order = detail?.order;
  const orderItems = order?.items ?? [];
  const locationLabel = [
    order?.district?.name ?? order?.customer?.district?.name ?? "",
    order?.region?.name ?? order?.customer?.region?.name ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  if (!row) return null;

  return (
    <Popup isShow={!!row} onClose={onClose}>
      <div
        className="w-[92vw] max-w-[30rem] h-[90vh] max-h-[52rem] rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-[var(--color-background)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="shrink-0 px-5 py-4"
          style={{
            background: isIncome
              ? "linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 72%, var(--color-main)))"
              : "linear-gradient(135deg, var(--color-error), color-mix(in srgb, var(--color-error) 72%, var(--color-purple)))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center backdrop-blur-sm">
                {isIncome ? (
                  <TrendingUp size={20} className="text-primary" />
                ) : (
                  <TrendingDown size={20} className="text-primary" />
                )}
              </div>
              <div>
                <p className="text-[15px] font-bold text-primary leading-tight">
                  {getOperationLabel(display?.operation_type)}
                </p>
                <p className="text-[11px] text-primary/75 flex items-center gap-1 mt-0.5">
                  <Landmark size={11} />
                  Payment history
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
            >
              <X size={16} className="text-primary" />
            </button>
          </div>

          <div className="h-px bg-primary/20 my-3.5" />

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] text-primary/65 mb-1">Amount</p>
              <p className="text-[28px] font-extrabold text-primary leading-none">
                {isIncome ? "+" : "-"}
                {fmt(display?.amount ?? 0)}
                <span className="text-[14px] font-semibold text-primary/75 ml-1.5">
                  UZS
                </span>
              </p>
            </div>

            {display?.balance_after !== undefined && (
              <div className="text-right">
                <p className="text-[10px] text-primary/55">
                  Balance after transaction
                </p>
                <p className="text-[13px] font-bold text-primary">
                  {display.balance_after < 0 ? "-" : ""}
                  {fmt(display.balance_after)} UZS
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex-1 min-h-0 flex flex-col gap-3 p-4 pb-6 overflow-y-auto custom-scrollbar"
        >
          {isLoading && (
            <PopupState
              title="Detail yuklanmoqda"
              description="Backenddan payment history detail olinmoqda."
            />
          )}

          {!isLoading && isError && (
            <PopupState
              title="Detail yuklanmadi"
              description="`finance/history/:id` detailini olishda xatolik bo‘ldi."
              isError
            />
          )}

          {!isLoading && !isError && (
            <>
              {detail?.comment && (
                <div
                  className="flex items-start gap-3 rounded-xl p-3.5 border"
                  style={{
                    background: isIncome
                      ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                      : "color-mix(in srgb, var(--color-error) 10%, transparent)",
                    borderColor: isIncome
                      ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
                      : "color-mix(in srgb, var(--color-error) 22%, transparent)",
                  }}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? "bg-success/15" : "bg-error/15"
                    }`}
                  >
                    <MessageSquare
                      size={16}
                      className={isIncome ? "text-success" : "text-error"}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                        isIncome ? "text-success" : "text-error"
                      }`}
                    >
                      Comment
                    </p>
                    <p className="text-[13px] text-primary/85 leading-relaxed whitespace-pre-line">
                      {detail.comment}
                    </p>
                  </div>
                </div>
              )}

              <div
                className="flex items-center gap-3 rounded-xl p-3.5 border"
                style={{
                  background: isIncome
                    ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                    : "color-mix(in srgb, var(--color-error) 10%, transparent)",
                  borderColor: isIncome
                    ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
                    : "color-mix(in srgb, var(--color-error) 22%, transparent)",
                }}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isIncome ? "bg-success/15" : "bg-error/15"
                  }`}
                >
                  <ArrowRight
                    size={16}
                    className={isIncome ? "text-success" : "text-error"}
                  />
                </div>
                <div>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                      isIncome ? "text-success" : "text-error"
                    }`}
                  >
                    {directionLabel}
                  </p>
                  <p className="text-[14px] font-bold text-primary">{directionValue}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <InfoCard
                  icon={<CreditCard size={12} className="text-main" />}
                  label="Source type"
                  value={<span>{getSourceTypeLabel(detail?.source_type)}</span>}
                />

                <InfoCard
                  icon={<Wallet size={12} className="text-main" />}
                  label="To'lov turi"
                  value={<span>{getPaymentMethodLabel(detail?.payment_method)}</span>}
                />

                <InfoCard
                  icon={<Calendar size={12} className="text-main" />}
                  label="Payment date"
                  value={formatDate(detail?.payment_date ?? detail?.createdAt)}
                />

                <InfoCard
                  icon={<User size={12} className="text-main" />}
                  label="User"
                  value={
                    <div className="flex flex-col gap-1">
                      <span>{actorName || detail?.created_by || "—"}</span>
                      <span className="text-[11px] inline-flex w-fit px-2 py-0.5 rounded-md bg-warning/15 text-warning">
                        {getRoleLabel(
                          actor?.role ?? order?.market?.role ?? detail?.cashbox?.cashbox_type,
                        )}
                      </span>
                    </div>
                  }
                />

                {actorPhone !== "—" && (
                  <InfoCard
                    icon={<Phone size={12} className="text-main" />}
                    label="Phone number"
                    value={actorPhone}
                    fullWidth
                  />
                )}
              </div>

              {detail?.cashbox && (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-primary/5">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-primary/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-main/15">
                        <Landmark size={15} className="text-main" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-main">
                          Cashbox
                        </p>
                        <p className="text-primary font-bold text-[13px]">
                          #{detail.cashbox.id}
                        </p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-primary/30" />
                  </div>

                  <div className="divide-y divide-white/6">
                    <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                      <span className="text-primary/55">Balance</span>
                      <span className="font-bold text-primary">
                        {fmt(detail.cashbox.balance)} UZS
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                      <span className="text-primary/55">Type</span>
                      <span className="font-bold text-primary">
                        {getCashboxTypeLabel(detail.cashbox.cashbox_type)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                      <span className="text-primary/55">Cash balance</span>
                      <span className="font-bold text-primary">
                        {fmt(detail.cashbox.balance_cash ?? 0)} UZS
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                      <span className="text-primary/55">Card balance</span>
                      <span className="font-bold text-primary">
                        {fmt(detail.cashbox.balance_card ?? 0)} UZS
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {order && (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: isIncome
                      ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
                      : "color-mix(in srgb, var(--color-info) 22%, transparent)",
                    background:
                      "color-mix(in srgb, var(--color-info) 7%, transparent)",
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center">
                        <ShoppingCart size={16} className="text-success" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-success">
                          Order
                        </p>
                        <p className="text-primary font-bold text-[13px]">
                          #{order.id}
                        </p>
                      </div>
                    </div>
                    {order.market?.name && (
                      <span className="text-[11px] text-primary/65 font-semibold">
                        {order.market.name}
                      </span>
                    )}
                  </div>

                  <div className="px-4 py-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <InfoCard
                        icon={<MapPin size={12} className="text-main" />}
                        label="District"
                        value={locationLabel || "—"}
                      />
                      <InfoCard
                        icon={<Phone size={12} className="text-main" />}
                        label="Phone number"
                        value={order.customer?.phone_number || "—"}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <InfoCard
                        icon={<CircleDollarSign size={12} className="text-main" />}
                        label="Total price"
                        value={`${fmt(order.total_price ?? 0)} UZS`}
                      />
                      <InfoCard
                        icon={<CircleDollarSign size={12} className="text-main" />}
                        label="To be paid"
                        value={`${fmt(order.to_be_paid ?? 0)} UZS`}
                      />
                      <InfoCard
                        icon={<CircleDollarSign size={12} className="text-main" />}
                        label="Paid"
                        value={`${fmt(order.paid_amount ?? 0)} UZS`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <InfoCard
                        icon={<ShoppingCart size={12} className="text-main" />}
                        label="Status"
                        value={getStatusLabel(order.status)}
                      />
                      <InfoCard
                        icon={<ExternalLink size={12} className="text-main" />}
                        label="Delivery"
                        value={getDeliveryLabel(order.where_deliver)}
                      />
                    </div>

                    {order.address && (
                      <InfoCard
                        icon={<MapPin size={12} className="text-main" />}
                        label="Address"
                        value={order.address}
                        fullWidth
                      />
                    )}

                    {orderItems.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-primary/5 p-3.5">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Package size={14} className="text-main" />
                          <p className="text-[11px] font-bold uppercase tracking-widest text-main m-0">
                            Mahsulotlar
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {orderItems.map((item) => (
                            <div
                              key={item.id}
                              className="px-2.5 py-2 rounded-lg bg-primary/5 border border-white/10 min-w-[8rem]"
                            >
                              <p className="text-[12px] font-semibold text-primary leading-tight">
                                {item.product?.name || `Product #${item.product_id}`}
                              </p>
                              <p className="text-[11px] text-primary/55 mt-1">
                                Qty: {item.quantity}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Popup>
  );
});

FinanceHistoryDetailPopup.displayName = "FinanceHistoryDetailPopup";

export default FinanceHistoryDetailPopup;
