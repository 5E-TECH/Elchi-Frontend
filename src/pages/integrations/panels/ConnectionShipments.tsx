import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Table, Tag, Tooltip, message } from "antd";
import { AlertTriangle, CheckCircle2, Clock, GitCompareArrows, Link2, RefreshCw, Send, Truck } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import {
  usePartnerShipments,
  useProviderShipments,
  useRedispatch,
  type PartnerShipmentRow,
  type ProviderShipmentRow,
  type ShipmentFilter,
} from "../../../entities/integrations/shipments";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import FilterPills from "../FilterPills";
import type { Connection } from "../useConnections";
import { useStatusLabel } from "../statusLabel";

/**
 * JO'NATMALAR — ulanish bo'yicha posilkalar.
 *
 * Shakl PCS `ElchiShipmentsTab` dan: filtr pillari + antd `Table` + yiqilgan
 * posilkani qayta jo'natish tugmasi.
 *
 * NEGA KERAK BO'LDI. Ma'lumot bazada bor edi (`provider_shipments`), lekin
 * ko'rish yo'li yo'q: faqat bitta buyurtma bo'yicha olish mumkin edi. Ya'ni
 * "qaysi posilka yetmadi?" degan savolga javob topish uchun buyurtmalarni
 * bittalab ochib chiqish kerak edi.
 */

const when = (v?: string | null) => (v ? new Date(v).toLocaleString("uz-UZ") : "—");

/** Buyurtma tafsiloti sahifasi (`/orders/edit/:orderId`; `/orders/:id` marshruti yo'q). */
const orderHref = (orderId: string | number) => `/orders/edit/${orderId}`;

const money = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : Math.round(Number(value)).toLocaleString("ru-RU").replace(/[\u00a0\u202f]/g, " ");

/**
 * Mijoz telefoni jurnal ekraniga chiqadi — faqat superadmin/admin to'liq
 * ko'radi (endpoint ham shu rollarga ochiq); boshqa rolda oxirgi 4 raqam.
 */
const PHONE_ROLES = new Set(["superadmin", "admin"]);
const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `*** ${digits.slice(-4)}` : "***";
};

const ConnectionShipments = ({ connection }: { connection: Connection }) =>
  connection.kind === "partner" ? (
    <PartnerShipments connection={connection} />
  ) : (
    <ProviderShipments connection={connection} />
  );

/** Chiquvchi: tashuvchiga berilgan posilkalar. */
const ProviderShipments = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  const [filter, setFilter] = useState<ShipmentFilter>("all");
  const [page, setPage] = useState(1);
  const statusLabel = useStatusLabel();
  const role = useSelector((state: RootState) => state.role.role);
  const canSeePhone = PHONE_ROLES.has(String(role ?? ""));

  const raw = connection.raw as { slug?: string };
  const slug = String(raw.slug ?? "");

  const list = useProviderShipments({
    integrationId: connection.id,
    filter,
    page,
    limit: 20,
  });
  const redispatch = useRedispatch();

  const rows = list.data?.items ?? [];
  const counts = list.data?.counts;

  const retry = async (orderId: string) => {
    if (!slug) {
      // Slug bo'lmasa dispatch marshruti yasalmaydi — sababini aytamiz.
      message.error(t("shpNoSlug"));
      return;
    }
    try {
      await redispatch.mutateAsync({ slug, orderId });
      message.success(t("shpResent"));
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("shpResendFailed"));
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4" /> {t("tabShipments")}
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={list.isFetching}
          onClick={() => void list.refetch()}
        >
          {t("refresh")}
        </Button>
      }
    >
      {/*
        Sanoqlar backenddan BITTA agregat so'rovda keladi. Kelmasa (eski
        backend) — pill sanoqsiz, "0" deb yolg'on ko'rsatilmaydi.
        "Nomuvofiqlik" — faqat status xaritasi bor ulanishda (aks holda
        hamma qator nomuvofiq bo'lib ko'rinardi).
      */}
      <FilterPills
        value={filter}
        onChange={(v) => {
          setFilter(v as ShipmentFilter);
          setPage(1);
        }}
        options={[
          { value: "all", label: t("filterAll"), count: counts?.all ?? list.data?.pagination.total },
          {
            value: "not_sent",
            label: t("filterNotSent"),
            count: counts?.not_sent,
            icon: <Clock className="h-3.5 w-3.5" />,
          },
          {
            value: "failed",
            label: t("filterFailed"),
            count: counts?.failed,
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-600 text-white border-red-600",
          },
          {
            value: "delivered",
            label: t("filterDelivered"),
            count: counts?.delivered,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-emerald-600 text-white border-emerald-600",
          },
          ...(counts && counts.mismatch !== null
            ? [
                {
                  value: "mismatch",
                  label: t("filterMismatch"),
                  count: counts.mismatch,
                  icon: <GitCompareArrows className="h-3.5 w-3.5" />,
                  activeClass: "bg-amber-500 text-white border-amber-500",
                },
              ]
            : []),
        ]}
      />

      <Table<ProviderShipmentRow>
        className="mt-3"
        rowKey={(r) => String(r.id)}
        size="small"
        // Yangi ustunlar bilan; "Amal" o'ngda qotirilgan — telefonda kesilmaydi.
        scroll={{ x: 1380 }}
        loading={list.isLoading}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize: list.data?.pagination.limit ?? 20,
          total: list.data?.pagination.total ?? rows.length,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: t("colOrder"),
            width: 110,
            fixed: "left" as const,
            // Odam o'qiydigan raqam (uuid emas) va buyurtma kartasiga havola.
            render: (_: unknown, r) => (
              <Link
                to={orderHref(r.order_id)}
                className="font-mono text-sm font-bold text-violet-600 hover:underline dark:text-violet-400"
              >
                #{r.order?.order_number ?? r.order_id}
              </Link>
            ),
          },
          {
            title: t("colCustomer"),
            width: 190,
            render: (_: unknown, r) =>
              r.order ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{r.order.customer_name ?? "—"}</span>
                  <span className="font-mono text-xs text-gray-500">
                    {r.order.customer_phone
                      ? canSeePhone
                        ? r.order.customer_phone
                        : maskPhone(r.order.customer_phone)
                      : "—"}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            title: t("mapAddress"),
            width: 170,
            render: (_: unknown, r) =>
              r.order ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{r.order.region_name ?? "—"}</span>
                  <span className="truncate text-xs text-gray-500">{r.order.district_name ?? "—"}</span>
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            // Jo'natilgan COD (buyurtma summasi) — yig'ilgani Hisob-kitob tabida.
            title: t("colAmountSent"),
            width: 130,
            align: "right" as const,
            render: (_: unknown, r) => (
              <span className="whitespace-nowrap font-mono text-sm tabular-nums">{money(r.order?.total_price)}</span>
            ),
          },
          {
            title: t("colTrackingCode"),
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">
                {r.tracking_number ?? r.external_ref ?? "—"}
              </span>
            ),
          },
          {
            title: t("colStatus"),
            width: 190,
            /*
              IKKI STATUS birga ko'rsatiladi va bu ataylab: ular ajralib
              ketishi mumkin (tashuvchi "delivered" deydi, bizda hali
              "waiting"). Faqat bittasini ko'rsatsak, farqni hech kim
              sezmasdi.
            */
            render: (_: unknown, r) => (
              <div className="space-y-1">
                {/*
                  ⚠️ BIZNING statusimiz TARJIMA qilinadi ("waiting" emas,
                  "Kutilmoqda"), ularniki esa XOM qoladi — "ular aynan nima
                  dedi?" degan savolga javob yo'qolmasligi kerak.
                */}
                <Tag color={r.last_error ? "red" : "blue"}>
                  biz: {statusLabel(r.internal_status)}
                </Tag>
                {r.provider_status && <Tag>ular: {r.provider_status}</Tag>}
              </div>
            ),
          },
          {
            title: t("colAttempt"),
            width: 90,
            align: "center" as const,
            render: (_: unknown, r) => <span className="tabular-nums">{r.send_attempts}</span>,
          },
          {
            title: t("colError"),
            render: (_: unknown, r) =>
              r.last_error ? (
                <Tooltip title={r.last_error}>
                  <span className="line-clamp-2 break-all text-xs text-red-600 dark:text-red-400">
                    {r.last_error}
                  </span>
                </Tooltip>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            title: t("colChanged"),
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.status_changed_at)}</span>
            ),
          },
          {
            title: t("colAction"),
            width: 120,
            fixed: "right" as const,
            /*
              Qayta jo'natish FAQAT xato bor qatorda. Muvaffaqiyatli
              posilkani qayta jo'natish tashuvchida ikkinchi yozuv
              yaratishi mumkin.
            */
            render: (_: unknown, r) =>
              r.last_error ? (
                <Button
                  size="small"
                  icon={<Send className="h-3 w-3" />}
                  loading={redispatch.isPending}
                  onClick={() => void retry(String(r.order_id))}
                >
                  {t("shpRetry")}
                </Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
};

/** Kiruvchi: hamkordan kelgan posilkalar bog'lanishi. */
const PartnerShipments = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  const [page, setPage] = useState(1);
  const list = usePartnerShipments({
    partnerId: connection.id,
    page,
    limit: 20,
  });
  const rows = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Alert type="info" showIcon message={t("shpLinkInfo")} description={t("shpLinkInfoDesc")} />

      <Card
        title={
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> {t("shpIncoming")}
          </span>
        }
        extra={
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            loading={list.isFetching}
            onClick={() => void list.refetch()}
          >
            {t("refresh")}
          </Button>
        }
      >
        <Table<PartnerShipmentRow>
          rowKey={(r) => String(r.id)}
          size="small"
          scroll={{ x: 600 }}
          loading={list.isLoading}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: list.data?.pagination.limit ?? 20,
            total: list.data?.pagination.total ?? rows.length,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: t("colTheirNumber"),
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">{r.external_order_id}</span>
              ),
            },
            {
              title: t("colOurOrder"),
              render: (_: unknown, r) => (
                <Link
                  to={orderHref(r.order_id)}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  #{r.order_id}
                </Link>
              ),
            },
            {
              title: t("colArrived"),
              width: 170,
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">{when(r.createdAt)}</span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ConnectionShipments;
