import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
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
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { getBackendErrorMessage, receiveScannedPackage, type ScanResourceType } from "../lib/scanResource";
import BackButton from "../../../shared/ui/BackButton";

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

const pickBranchName = (...values: any[]) => {
  for (const value of values) {
    const name = value?.name ?? value?.title ?? value?.branch_name ?? value;
    const normalized = safe(name, "");
    if (normalized) return normalized;
  }

  return "—";
};

const pickRegionName = (...values: any[]) => {
  for (const value of values) {
    const name =
      value?.region?.name ??
      value?.region_name ??
      value?.name ??
      value?.title ??
      value;
    const normalized = safe(name, "");
    if (normalized) return normalized;
  }

  return "—";
};

const getPackageReceiveErrorText = (error: unknown, t: (key: string) => string) => {
  const message = getBackendErrorMessage(error);
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("already") ||
    normalized.includes("qabul qilingan") ||
    normalized.includes("accepted") ||
    normalized.includes("received")
  ) {
    return t("scannerPackageAlreadyReceived");
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("bekor")
  ) {
    return t("scannerPackageCancelled");
  }

  if (
    normalized.includes("branch") ||
    normalized.includes("filial") ||
    normalized.includes("permission") ||
    normalized.includes("ruxsat")
  ) {
    return t("scannerPackageWrongBranch");
  }

  return message ?? t("scannerPackageReceiveError");
};

const normalizePackageDetail = (response: any, type: ScanResourceType, t: (key: string) => string): PackageView => {
  const source = response?.data ?? response;
  const payload = source?.data ?? source?.package ?? source?.batch ?? source;
  const ordersSource =
    payload?.orders ??
    payload?.items ??
    payload?.order_list ??
    payload?.allOrdersByPackageId ??
    payload?.allOrdersByBatchId ??
    [];
  const orders = Array.isArray(ordersSource) ? ordersSource : [];
  const driver = payload?.driver ?? payload?.courier ?? payload?.user ?? {};
  const sourceBranch =
    payload?.source_branch ??
    payload?.from_branch ??
    payload?.fromBranch ??
    payload?.branch_from ??
    payload?.from ??
    payload?.branch ??
    {};
  const destinationBranch =
    payload?.to_branch ??
    payload?.toBranch ??
    payload?.destination_branch ??
    payload?.to ??
    {};
  const destinationRegion =
    payload?.destination_region ??
    payload?.to_region ??
    payload?.region ??
    destinationBranch?.region ??
    destinationBranch;

  return {
    id: safe(payload?.id ?? payload?.package_id ?? payload?.token),
    title: type === "returned-package" ? t("scannerReturnedPackageTitle") : t("scannerPackageTitle"),
    sourceBranch: pickBranchName(sourceBranch),
    destinationRegion: pickRegionName(destinationRegion, destinationBranch),
    ordersCount: safe(
      payload?.orders_count ??
        payload?.ordersCount ??
        payload?.order_count ??
        payload?.total_orders ??
        orders.length,
    ),
    totalAmount: formatMoney(
      payload?.total_price ??
        payload?.totalPrice ??
        payload?.amount ??
        payload?.total_amount ??
        payload?.total,
    ),
    carNumber: safe(
        payload?.vehicle_number ??
        payload?.car_number ??
        payload?.vehicle_plate ??
        payload?.plate_number,
    ),
    driver: safe(driver?.name ?? payload?.driver_name ?? payload?.courier_name ?? driver),
    createdAt: formatDate(payload?.created_at ?? payload?.createdAt ?? payload?.updated_at ?? payload?.updatedAt ?? payload?.sent_at),
    status: safe(payload?.status),
    orders: orders.map((order: any) => ({
      id: safe(order?.id ?? order?._id ?? order?.order_id),
      customer: safe(order?.receiver ?? order?.customer?.name ?? order?.customer_name ?? order?.name),
      phone: safe(order?.customer?.phone_number ?? order?.customer?.phone ?? order?.phone ?? order?.phone_number),
      amount: formatMoney(order?.total_price ?? order?.price ?? order?.amount),
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
  const orderColumns = useMemo<ColumnConfig<PackageOrderRow>[]>(
    () => [
      {
        key: "id",
        label: t("scannerOrderId"),
        render: (value) => <span className="font-black">{String(value)}</span>,
      },
      { key: "customer", label: t("scannerCustomer") },
      { key: "phone", label: t("phone") },
      {
        key: "amount",
        label: t("amount"),
        render: (value) => <span className="font-bold">{String(value)}</span>,
      },
      { key: "status", label: t("status") },
    ],
    [t],
  );

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
        text: getPackageReceiveErrorText(error, t),
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
          <BackButton to="/scan" className="shrink-0 bg-white dark:bg-maindark" label="" />
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

            <Table
              data={detail.orders}
              columns={orderColumns}
              keyExtractor={(row, index) => `${row.id}-${index}`}
              emptyMessage={t("scannerPackageOrdersEmpty")}
              dense
              bordered={false}
            />
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
            disabled={receiveMutation.isPending || inlineMessage?.tone === "success"}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-emerald-600 px-6 py-5 text-base font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
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
