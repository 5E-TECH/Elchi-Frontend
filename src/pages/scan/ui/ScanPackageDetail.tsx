import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  Receipt,
  ScanLine,
  Truck,
  UserRound,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getBackendErrorMessage, receiveScannedPackage, type ScanResourceType } from "../lib/scanResource";

type PackageOrderRow = {
  id: string;
  customer: string;
  phone: string;
  amount: string;
  status: string;
};

type PackageView = {
  id: string;
  title: string;
  sourceBranch: string;
  destinationRegion: string;
  ordersCount: string;
  totalAmount: string;
  carNumber: string;
  driver: string;
  createdAt: string;
  status: string;
  orders: PackageOrderRow[];
};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const formatMoney = (value: unknown) => {
  if (typeof value === "number") return `${value.toLocaleString("uz-UZ")} so'm`;
  return safe(value);
};

const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizePackageDetail = (response: any, type: ScanResourceType, t: (key: string) => string): PackageView => {
  const source = response?.data ?? response;
  const payload = source?.data ?? source?.package ?? source?.batch ?? source;
  const ordersSource = payload?.orders ?? payload?.items ?? payload?.order_list ?? [];
  const orders = Array.isArray(ordersSource) ? ordersSource : [];
  const driver = payload?.driver ?? payload?.courier ?? payload?.user ?? {};
  const sourceBranch = payload?.source_branch ?? payload?.from_branch ?? payload?.branch_from ?? payload?.branch ?? {};
  const destinationRegion = payload?.destination_region ?? payload?.to_region ?? payload?.region ?? {};

  return {
    id: safe(payload?.id ?? payload?.package_id ?? payload?.token),
    title: type === "returned-package" ? t("scannerReturnedPackageTitle") : t("scannerPackageTitle"),
    sourceBranch: safe(sourceBranch?.name ?? sourceBranch),
    destinationRegion: safe(destinationRegion?.name ?? destinationRegion),
    ordersCount: safe(
      payload?.orders_count ??
        payload?.order_count ??
        payload?.total_orders ??
        orders.length,
    ),
    totalAmount: formatMoney(payload?.total_price ?? payload?.amount ?? payload?.total_amount),
    carNumber: safe(
      payload?.vehicle_number ??
        payload?.car_number ??
        payload?.vehicle_plate ??
        payload?.plate_number,
    ),
    driver: safe(driver?.name ?? payload?.driver_name ?? payload?.courier_name),
    createdAt: formatDate(payload?.createdAt ?? payload?.updatedAt ?? payload?.sent_at),
    status: safe(payload?.status),
    orders: orders.map((order: any) => ({
      id: safe(order?.id),
      customer: safe(order?.customer?.name ?? order?.customer_name ?? order?.name),
      phone: safe(order?.customer?.phone_number ?? order?.phone ?? order?.phone_number),
      amount: formatMoney(order?.total_price ?? order?.amount),
      status: safe(order?.status),
    })),
  };
};

interface ScanPackageDetailProps {
  data: unknown;
  token: string;
  type: ScanResourceType;
}

const ScanPackageDetail = ({ data, token, type }: ScanPackageDetailProps) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const detail = useMemo(() => normalizePackageDetail(data, type, t), [data, t, type]);
  const [inlineMessage, setInlineMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const receiveMutation = useMutation({
    mutationFn: () => receiveScannedPackage(detail.id !== "—" ? detail.id : token),
    onSuccess: () => {
      setInlineMessage({
        tone: "success",
        text: t("scannerPackageReceiveSuccess"),
      });
      window.setTimeout(() => {
        navigate("/scan");
      }, 2000);
    },
    onError: (error) => {
      setInlineMessage({
        tone: "error",
        text: getBackendErrorMessage(error) ?? t("scannerPackageReceiveError"),
      });
    },
  });

  useEffect(() => {
    setInlineMessage(null);
  }, [token]);

  return (
    <div className="rounded-[32px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_94%,var(--color-main)_6%)_0%,color-mix(in_srgb,var(--color-sidebar)_88%,var(--color-main)_12%)_100%)] shadow-sm dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-maindark)_92%,var(--color-main)_8%)_0%,color-mix(in_srgb,var(--color-primarydark)_88%,var(--color-maindark)_12%)_100%)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-white text-[color:var(--color-text-muted)] transition hover:border-main/30 hover:bg-main/5 hover:text-main dark:bg-maindark dark:text-white/80 dark:hover:bg-white/12 dark:hover:text-white"
            aria-label={t("back")}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-100">
            <Package size={20} />
          </div>
          <div>
            <p className="m-0 text-lg font-extrabold tracking-tight text-maindark dark:text-white">
              {detail.title}
            </p>
            <p className="m-0 mt-0.5 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerPackageSubtitle")}
            </p>
          </div>
        </div>

        <div className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-100">
          {t("scannerScannedOk")}
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] md:px-7 md:py-7">
        <div className="space-y-4">
          <div className="rounded-[30px] border border-[color:var(--color-border-soft)] bg-maindark p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200/70">
                  {t("scannerPackageCode")}
                </p>
                <h2 className="m-0 mt-3 text-3xl font-extrabold text-white">
                  #{detail.id}
                </h2>
                <p className="m-0 mt-2 text-sm text-white/60">
                  {detail.createdAt}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  {t("status")}
                </p>
                <p className="m-0 mt-2 text-lg font-extrabold text-white">
                  {detail.status}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                { icon: <Building2 size={16} />, label: t("scannerPackageFromBranch"), value: detail.sourceBranch },
                { icon: <MapPin size={16} />, label: t("scannerPackageDestination"), value: detail.destinationRegion },
                { icon: <Receipt size={16} />, label: t("amount"), value: detail.totalAmount },
                { icon: <CalendarDays size={16} />, label: t("date"), value: detail.createdAt },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2 text-white/55">
                    {item.icon}
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.16em]">
                      {item.label}
                    </p>
                  </div>
                  <p className="m-0 mt-3 text-base font-bold text-white [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[color:var(--color-border-soft)] bg-white/85 shadow-sm dark:bg-white/[0.04]">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-5 py-4">
              <div>
                <p className="m-0 text-lg font-extrabold text-maindark dark:text-white">
                  {t("scannerPackageOrdersTitle")}
                </p>
                <p className="m-0 mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  {t("scannerPackageOrdersCount", { count: detail.orders.length })}
                </p>
              </div>
              <div className="rounded-2xl border border-main/10 bg-main/10 px-4 py-2 text-sm font-bold text-main dark:text-white">
                {detail.ordersCount}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[color:var(--color-border-soft)] text-left">
                    {[t("scannerOrderId"), t("scannerCustomer"), t("phone"), t("amount"), t("status")].map((label) => (
                      <th key={label} className="px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-white/55">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.orders.map((order) => (
                    <tr key={order.id} className="border-b border-[color:var(--color-border-soft)] last:border-b-0">
                      <td className="px-5 py-3 text-sm font-semibold text-maindark dark:text-white">{order.id}</td>
                      <td className="px-5 py-3 text-sm text-maindark dark:text-white">{order.customer}</td>
                      <td className="px-5 py-3 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">{order.phone}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-maindark dark:text-white">{order.amount}</td>
                      <td className="px-5 py-3 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[30px] border border-[color:var(--color-border-soft)] bg-white/80 p-6 shadow-sm dark:bg-white/[0.04]">
            <div className="grid gap-3">
              {[
                { icon: <Truck size={16} />, label: t("scannerPackageCarNumber"), value: detail.carNumber },
                { icon: <UserRound size={16} />, label: t("scannerPackageDriver"), value: detail.driver },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/55">
                    {item.icon}
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.16em]">
                      {item.label}
                    </p>
                  </div>
                  <p className="m-0 mt-3 text-base font-bold text-maindark dark:text-white [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {inlineMessage ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inlineMessage.tone === "success"
                  ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-100"
                  : "border-red-300/20 bg-red-500/12 text-red-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {inlineMessage.tone === "success" ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                )}
                <span>{inlineMessage.text}</span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => receiveMutation.mutate()}
            disabled={receiveMutation.isPending}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-emerald-500 px-6 py-5 text-base font-extrabold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {receiveMutation.isPending ? (
              <>
                <ScanLine size={18} className="animate-pulse" />
                {t("scannerPackageReceiving")}
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                {t("scannerPackageReceive")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ScanPackageDetail);
