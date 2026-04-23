import { memo, useMemo } from "react";
import {
  ArrowRight,
  Calendar,
  CircleDollarSign,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import type { PaymentRow } from "./patmentHistoryTable";
import {
  useCashBox,
  type FinanceHistoryActor,
  type FinanceHistoryDetail,
} from "../../../entities/payments";

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

const getSourceTypeLabel = (value?: string | null) => {
  const normalized = value?.toLowerCase();
  if (normalized === "sell") return "Sotuv";
  if (normalized === "correction") return "Tuzatish";
  if (normalized === "salary") return "Oylik";
  if (normalized === "market_payment") return "Market to'lovi";
  if (normalized === "manual_income") return "Qo'lda kirim";
  if (normalized === "manual_expense") return "Qo'lda chiqim";
  return value || "—";
};

const getPaymentMethodLabel = (value?: string | null) => {
  const normalized = value?.toLowerCase();
  if (normalized === "cash") return "Naqd";
  if (normalized === "click") return "Click";
  if (normalized === "payme") return "Payme";
  if (normalized === "transfer") return "O'tkazma";
  if (normalized === "click_to_market") return "Do'konga o'tkazma";
  if (normalized === "card") return "Karta";
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
  if (value === "sold") return "To'langan";
  if (value === "cancelled") return "Bekor qilingan";
  if (value === "paid") return "To'langan";
  if (value === "partly_paid") return "Qisman to'langan";
  if (value === "new") return "Yangi";
  if (value === "received") return "Qabul qilingan";
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
    detail.order?.market ||
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

const InfoCard = memo(
  ({
    icon,
    label,
    value,
    fullWidth = false,
    accentClassName = "bg-[var(--color-main-soft)] dark:bg-main/25",
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    fullWidth?: boolean;
    accentClassName?: string;
  }) => (
    <div
      className={`rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:color-mix(in_srgb,var(--color-main)_10%,var(--color-sidebar))] p-3 dark:border-white/10 dark:bg-primarydark/55 ${fullWidth ? "col-span-2" : ""}`}
    >
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
  const { getFinanceHistoryById } = useCashBox();
  const rowId = row?.id ?? null;
  const { data, isLoading, isError } = getFinanceHistoryById(rowId, !!rowId);

  const detail = data?.data;
  const display = detail ?? row;
  const isIncome = display?.operation_type === "income";
  const actor = useMemo(() => resolvePrimaryActor(detail), [detail]);
  const actorName = getActorName(actor);
  const actorPhone = getActorPhone(actor);
  const hasComment = Boolean(detail?.comment);
  const actorRole = getRoleLabel(
    actor?.role ?? detail?.order?.market?.role ?? detail?.cashbox?.cashbox_type,
  );
  const directionLabel = isIncome ? "Qayerdan" : "Qayerga";
  const directionValue = resolveDirectionValue(detail, actor);
  const order = detail?.order;
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
        className="flex max-h-[94vh] w-[94vw] max-w-[38rem] flex-col overflow-hidden rounded-[2rem] border border-[color:var(--color-border-soft)] bg-sidebar shadow-2xl shadow-[0_28px_60px_var(--color-background-soft)] dark:border-white/10 dark:bg-maindark"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="shrink-0 px-5 py-4"
          style={{
            background:
              "linear-gradient(135deg, var(--color-main) 0%, var(--color-primarydark) 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                {isIncome ? (
                  <TrendingUp size={20} className="text-white" />
                ) : (
                  <TrendingDown size={20} className="text-white" />
                )}
              </div>
              <div>
                <p className="text-[16px] font-bold capitalize text-white">
                  {isIncome ? "kirim" : "chiqim"}
                </p>
                <p className="mt-0.5 text-[12px] text-white/80">To'lov tarixi</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="my-3 h-px bg-white/20" />

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-white/75">Miqdor</p>
              <p className="mt-1 text-[30px] leading-none font-extrabold text-white">
                {isIncome ? "+" : "-"}
                {fmt(display?.amount ?? 0)}
                <span className="ml-1.5 text-[14px] font-medium uppercase text-white/85">
                  UZS
                </span>
              </p>
            </div>

            {display?.balance_after !== undefined && (
              <div className="text-right">
                <p className="text-[10px] text-white/70">Amaldan keyingi balans</p>
                <p className="mt-1 text-[13px] font-bold text-white">
                  {fmt(display.balance_after)} UZS
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 space-y-3 overflow-hidden bg-sidebar p-4 dark:bg-maindark">
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
              <div className="grid grid-cols-2 gap-3">
                {actorPhone !== "—" && (
                  <InfoCard
                    icon={<Phone size={12} className="text-[var(--color-main)] dark:text-white" />}
                    label="Telefon raqami"
                    value={actorPhone}
                    accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                  />
                )}
                <InfoCard
                  icon={<ArrowRight size={12} className="text-[var(--color-main)] dark:text-white" />}
                  label={directionLabel}
                  value={directionValue}
                  accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                />
                <InfoCard
                  icon={<CreditCard size={12} className="text-[var(--color-main)] dark:text-white" />}
                  label="Manba turi"
                  value={getSourceTypeLabel(detail?.source_type)}
                  accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                />
                <InfoCard
                  icon={<Wallet size={12} className="text-[var(--color-main)] dark:text-white" />}
                  label="To'lov turi"
                  value={getPaymentMethodLabel(detail?.payment_method)}
                  accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                />
                <InfoCard
                  icon={<Calendar size={12} className="text-[var(--color-main)] dark:text-white" />}
                  label="To'lov kuni"
                  value={formatDate(detail?.payment_date ?? detail?.createdAt)}
                  accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                />
                <InfoCard
                  icon={<User size={12} className="text-[var(--color-main)] dark:text-white" />}
                  label="Foydalanuvchi"
                  value={
                    <div className="flex flex-col gap-1">
                      <span>{actorName || detail?.created_by || "—"}</span>
                      <span className="inline-flex w-fit rounded-md border border-[color:var(--color-border-soft)] bg-[var(--color-main-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-main)] dark:border-white/10 dark:bg-main/25 dark:text-white">
                        {actorRole}
                      </span>
                    </div>
                  }
                  accentClassName="bg-[var(--color-main-soft)] dark:bg-main/25"
                />
              </div>

              {order && (
                <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:color-mix(in_srgb,var(--color-main)_12%,var(--color-sidebar))] dark:border-white/10 dark:bg-primarydark/55">
                  <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-4 py-3 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-main)]">
                        <ShoppingCart size={17} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-main)] dark:text-white/85">
                          Buyurtma
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
                          <span>Izoh</span>
                        </div>
                        <p className="whitespace-pre-line text-[var(--color-maindark)] dark:text-white">
                          {detail?.comment}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_auto] gap-y-2.5">
                      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                        <MapPin size={12} className="text-[var(--color-main)] dark:text-white" />
                        <span>Hudud</span>
                      </div>
                      <span className="text-right font-medium text-[var(--color-maindark)] dark:text-white">
                        {locationLabel || "—"}
                      </span>

                      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                        <Phone size={12} className="text-[var(--color-main)] dark:text-white" />
                        <span>Telefon nomer</span>
                      </div>
                      <span className="text-right font-medium text-[var(--color-maindark)] dark:text-white">
                        {order.customer?.phone_number || "—"}
                      </span>
                    </div>

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <CircleDollarSign size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>Umumiy narx</span>
                        </div>
                        <span className="font-bold text-[var(--color-main)] dark:text-white">
                          {fmt(order.total_price ?? order.to_be_paid ?? 0)} UZS
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <ShoppingCart size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>Holat</span>
                        </div>
                        <span className="rounded-full border border-[color:var(--color-border-soft)] bg-[var(--color-main-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-main)] dark:border-white/10 dark:bg-main/25 dark:text-white">
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    </div>

                    {order.address && (
                      <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <MapPin size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>Manzil</span>
                        </div>
                        <p className="mt-1 leading-5 text-[var(--color-maindark)] dark:text-white">{order.address}</p>
                      </div>
                    )}

                    <div className="border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/75">
                          <ArrowRight size={12} className="text-[var(--color-main)] dark:text-white" />
                          <span>Yetkazish</span>
                        </div>
                        <span className="font-medium text-[var(--color-maindark)] dark:text-white">
                          {getDeliveryLabel(order.where_deliver)}
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
    </Popup>
  );
});

FinanceHistoryDetailPopup.displayName = "FinanceHistoryDetailPopup";

export default FinanceHistoryDetailPopup;
