import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Receipt,
  ScanLine,
  Truck,
  UserRound,
} from "lucide-react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

type PostOrderRow = {
  id: string;
  customer: string;
  phone: string;
  amount: string;
  status: string;
};

type PostView = {
  id: string;
  region: string;
  courier: string;
  createdAt: string;
  totalAmount: string;
  orders: PostOrderRow[];
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

const normalizePostDetail = (response: any): PostView => {
  const source = response?.data ?? response;
  const payload = source?.data ?? source?.post ?? source;
  const ordersSource = payload?.allOrdersByPostId ?? payload?.orders ?? payload?.items ?? [];
  const orders = Array.isArray(ordersSource) ? ordersSource : [];

  return {
    id: safe(payload?.id ?? payload?.post_id ?? payload?.token),
    region: safe(
      payload?.region?.name ??
        payload?.district?.region?.name ??
        orders[0]?.region?.name ??
        orders[0]?.district?.region?.name,
    ),
    courier: safe(
      payload?.courier?.name ??
        payload?.driver?.name ??
        payload?.user?.name,
    ),
    createdAt: formatDate(payload?.createdAt ?? payload?.updatedAt),
    totalAmount: formatMoney(
      payload?.post_total_price ??
        payload?.total_price ??
        orders.reduce(
          (sum: number, order: any) => sum + (typeof order?.total_price === "number" ? order.total_price : 0),
          0,
        ),
    ),
    orders: orders.map((order: any) => ({
      id: safe(order?.id),
      customer: safe(order?.customer?.name ?? order?.customer_name),
      phone: safe(order?.customer?.phone_number ?? order?.phone_number),
      amount: formatMoney(order?.total_price),
      status: safe(order?.status),
    })),
  };
};

interface ScanPostDetailProps {
  data: unknown;
}

const ScanPostDetail = ({ data }: ScanPostDetailProps) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const detail = useMemo(() => normalizePostDetail(data), [data]);

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
            <Truck size={20} />
          </div>
          <div>
            <p className="m-0 text-lg font-extrabold tracking-tight text-maindark dark:text-white">
              {t("scannerPostTitle")}
            </p>
            <p className="m-0 mt-0.5 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerPostSubtitle")}
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
                  {t("scannerPostCode")}
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
                  {t("amount")}
                </p>
                <p className="m-0 mt-2 text-lg font-extrabold text-white">
                  {detail.totalAmount}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                { icon: <MapPin size={16} />, label: t("region"), value: detail.region },
                { icon: <UserRound size={16} />, label: t("scannerPackageDriver"), value: detail.courier },
                { icon: <Receipt size={16} />, label: t("scannerPackageOrdersTitle"), value: String(detail.orders.length) },
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
            <div className="flex items-center gap-2 text-maindark dark:text-white">
              <CheckCircle2 size={16} className="text-[#a5b4fc]" />
              <p className="m-0 text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] dark:text-white/55">
                {t("scannerResultLabel")}
              </p>
            </div>
            <h3 className="m-0 mt-3 text-2xl font-extrabold leading-tight text-maindark dark:text-white">
              {t("scannerPostSubtitle")}
            </h3>
            <p className="m-0 mt-2 text-sm leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerGuideText")}
            </p>
          </div>

          {[
            { icon: <Truck size={16} />, label: t("scannerPackageDriver"), value: detail.courier },
            { icon: <Building2 size={16} />, label: t("region"), value: detail.region },
            { icon: <Package size={16} />, label: t("scannerPackageOrdersTitle"), value: String(detail.orders.length) },
            { icon: <Phone size={16} />, label: t("scannerBackToScanner"), value: t("scannerPostStaticHint") },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/80 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
            >
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

          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-main px-6 py-5 text-base font-extrabold text-white shadow-lg shadow-main/25 transition hover:bg-main/90"
          >
            <ScanLine size={18} />
            {t("scannerBackToScanner")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ScanPostDetail);
