import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Receipt,
  RefreshCw,
  ScanLine,
  Sparkles,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  extractScannerToken,
  playScanFeedback,
} from "./lib/scanShared";
import {
  fetchScanDetail,
  getScanDetailQueryKey,
  getScanResourceType,
} from "./lib/scanResource";
import ScanPackageDetail from "./ui/ScanPackageDetail";
import ScanPostDetail from "./ui/ScanPostDetail";

type ScanOrderView = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  total: string;
  delivery: string;
  sender: string;
  market: string;
  products: string;
  comment: string;
  createdAt: string;
  status: string;
};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const formatMoney = (value: unknown) => {
  if (typeof value !== "number") return safe(value);
  return `${value.toLocaleString("uz-UZ")} so'm`;
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

const getDeliveryLabel = (value: unknown) => {
  if (value === "center") return "Markazga";
  if (value === "home" || value === "address") return "Uyga";
  return safe(value);
};

const getStatusLabel = (value: unknown) => {
  if (value === "new") return "Yangi";
  if (value === "received") return "Qabul qilingan";
  if (value === "on the road") return "Yo'lda";
  if (value === "sold") return "Sotilgan";
  if (value === "cancelled") return "Bekor qilingan";
  return safe(value);
};

const normalizeOrder = (response: any): ScanOrderView => {
  const source = response?.data ?? response;
  const payload = source?.data ?? source?.order ?? source;
  const order = payload?.order ?? payload;
  const customer = order?.customer ?? {};
  const market = order?.market ?? order?.sender ?? {};
  const district = customer?.district ?? order?.district;
  const region = customer?.region ?? order?.region ?? district?.region;
  const address = [region?.name, district?.name, order?.address].filter(Boolean).join(", ");
  const items = Array.isArray(order?.items)
    ? order.items
        .map((item: any) => {
          const name = item?.product?.name ?? item?.name;
          const quantity = item?.quantity ? ` x${item.quantity}` : "";
          return name ? `${name}${quantity}` : null;
        })
        .filter(Boolean)
        .join(", ")
    : "—";

  return {
    id: safe(order?.id),
    customerName: safe(customer?.name),
    phone: safe(customer?.phone_number),
    address: safe(address),
    total: formatMoney(order?.total_price),
    delivery: getDeliveryLabel(order?.where_deliver),
    sender: safe(market?.name ?? order?.operator),
    market: safe(market?.name),
    products: safe(items),
    comment: safe(order?.comment),
    createdAt: formatDate(order?.createdAt ?? order?.updatedAt),
    status: getStatusLabel(order?.status),
  };
};

const ScanDetailPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const normalizedToken = extractScannerToken(token) ?? token.trim();
  const resourceType = getScanResourceType(normalizedToken);
  const isPackageResource = resourceType === "package" || resourceType === "returned-package";
  const loadingText = isPackageResource
    ? t("scannerPackageLoading")
    : resourceType === "post"
      ? t("scannerPostLoading")
      : t("scannerOrderLoading");
  const notFoundTitle = isPackageResource
    ? t("scannerPackageNotFound")
    : resourceType === "post"
      ? t("scannerPostNotFound")
      : t("scannerOrderNotFound");
  const notFoundText = isPackageResource
    ? t("scannerPackageNotFoundText")
    : resourceType === "post"
      ? t("scannerPostNotFoundText")
      : t("scannerOrderNotFoundText");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: getScanDetailQueryKey(normalizedToken),
    queryFn: () => fetchScanDetail(normalizedToken),
    enabled: Boolean(normalizedToken),
  });

  useEffect(() => {
    if (isError) {
      void playScanFeedback("error");
    }
  }, [isError]);

  if (data?.type === "package" || data?.type === "returned-package") {
    return (
      <ScanPackageDetail
        data={data.data}
        token={normalizedToken}
        type={data.type}
      />
    );
  }

  if (data?.type === "post") {
    return <ScanPostDetail data={data.data} />;
  }

  const order = data ? normalizeOrder(data.data) : null;

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-[color:var(--color-border-soft)] bg-primary p-8 shadow-sm dark:bg-primarydark">
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-maindark dark:text-white">
            <div className="h-11 w-11 animate-spin rounded-full border-2 border-main/20 border-t-main" />
            <p className="m-0 text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {loadingText}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="rounded-[32px] border border-[color:var(--color-border-soft)] bg-primary p-8 shadow-sm dark:bg-primarydark">
        <div className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center text-center text-maindark dark:text-white">
          <div className="flex h-18 w-18 items-center justify-center rounded-[28px] border border-red-300/20 bg-red-500/12 text-red-200">
            <AlertTriangle size={36} />
          </div>
          <h2 className="m-0 mt-6 text-2xl font-extrabold">
            {notFoundTitle}
          </h2>
          <p className="m-0 mt-3 max-w-md text-sm leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {notFoundText}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark transition hover:border-main/30 hover:bg-main/5 dark:bg-white/6 dark:text-white dark:hover:bg-white/10"
            >
              <RefreshCw size={15} />
              {t("retry")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/scan")}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18"
            >
              <ScanLine size={15} />
              {t("scannerBackToScanner")}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="m-0 text-lg font-extrabold tracking-tight text-maindark dark:text-white">
              {t("scannerOrderTitle")}
            </p>
            <p className="m-0 mt-0.5 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerOrderSubtitle")}
            </p>
          </div>
        </div>

        <div className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-100">
          {t("scannerScannedOk")}
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] md:px-7 md:py-7">
        <div className="space-y-4">
          <div className="rounded-[30px] border border-[color:var(--color-border-soft)] bg-maindark p-6 shadow-sm dark:bg-maindark">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200/70">
                  {t("scannerOrderId")}
                </p>
                <h2 className="m-0 mt-3 text-3xl font-extrabold text-white">
                  {order.customerName}
                </h2>
                <p className="m-0 mt-2 text-sm text-white/60">
                  #{order.id}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  {t("scannerDelivery")}
                </p>
                <p className="m-0 mt-2 text-lg font-extrabold text-white">
                  {order.delivery}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                { icon: <Phone size={16} />, label: t("phone"), value: order.phone },
                { icon: <Receipt size={16} />, label: t("amount"), value: order.total },
                { icon: <Store size={16} />, label: t("scannerSender"), value: order.sender },
                { icon: <CalendarDays size={16} />, label: t("date"), value: order.createdAt },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
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

          <div className="rounded-[30px] border border-[color:var(--color-border-soft)] bg-white/80 p-6 shadow-sm dark:bg-white/[0.04]">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
              <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/55">
                  <MapPin size={16} />
                  <p className="m-0 text-xs font-bold uppercase tracking-[0.16em]">
                    {t("address")}
                  </p>
                </div>
                <p className="m-0 mt-3 text-base font-bold leading-7 text-maindark dark:text-white [overflow-wrap:anywhere]">
                  {order.address}
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] dark:text-white/55">
                  <Package size={16} />
                  <p className="m-0 text-xs font-bold uppercase tracking-[0.16em]">
                    {t("scannerProducts")}
                  </p>
                </div>
                <p className="m-0 mt-3 text-base font-bold leading-7 text-maindark dark:text-white [overflow-wrap:anywhere]">
                  {order.products}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[30px] border border-[color:var(--color-border-soft)] bg-white/80 p-6 shadow-sm dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-maindark dark:text-white">
              <Sparkles size={16} className="text-[#a5b4fc]" />
              <p className="m-0 text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] dark:text-white/55">
                {t("scannerResultLabel")}
              </p>
            </div>
            <h3 className="m-0 mt-3 text-2xl font-extrabold leading-tight text-maindark dark:text-white">
              {t("scannerOrderSubtitle")}
            </h3>
            <p className="m-0 mt-2 text-sm leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerGuideText")}
            </p>
          </div>

          {[
            { icon: <UserRound size={16} />, label: t("scannerCustomer"), value: order.customerName },
            { icon: <Truck size={16} />, label: t("status"), value: order.status },
            { icon: <Building2 size={16} />, label: t("scannerMarket"), value: order.market },
            { icon: <Store size={16} />, label: t("comment"), value: order.comment },
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
        </div>
      </div>
    </div>
  );
};

export default memo(ScanDetailPage);
