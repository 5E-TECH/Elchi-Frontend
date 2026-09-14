import { useState } from "react";
import { Button, Card, Table, Tag, Tooltip, message } from "antd";
import {
  CheckCircle2,
  Clock,
  Inbox,
  RefreshCw,
  Wallet,
  RotateCw,
  Send,
  ShieldOff,
  XCircle,
} from "lucide-react";
import {
  usePartnerActions,
  usePartnerWebhooks,
  type PartnerWebhookRow,
} from "../../../entities/partners";
import {
  syncWhen,
  useSyncHistory,
  type SyncHistoryRow,
} from "../../../entities/integrations/syncHistory";
import {
  useWebhookLogs,
  webhookOutcome,
  type WebhookLogRow,
} from "../../../entities/integrations/webhookLogs";
import {
  paymentOutcome,
  usePayments,
  type PaymentRow,
} from "../../../entities/integrations/payments";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import FilterPills from "../FilterPills";
import type { Connection } from "../useConnections";

/**
 * HODISALAR — ulanish bo'yicha yetkazish tarixi.
 *
 * Shakl PCS `ElchiWebhookLogsTab` dan: yuqorida sanoqli filtr pillari,
 * ostida antd `Table size="small"` + `Tag` bilan holat.
 *
 * IKKI MANBA — IKKI KO'RINISH, bitta jadval emas. Maydonlari umuman boshqa:
 *   inbound  (`partner`)     — BIZ yuborgan webhooklar: yetdimi, necha
 *                              urinish, nega yiqildi
 *   outbound (`integration`) — BIZ tortib olgan sinxronlar: nechta buyurtma
 *
 * Ularni bitta jadvalga tiqish uchun ustunlarni umumlashtirish kerak
 * bo'lardi va natijada ikkisi ham ma'nosini yo'qotardi.
 */

/**
 * YETKAZISH HOLATI — YAGONA MANBA.
 *
 * ⚠️ NIMA BUZILGAN EDI. Ayni holat BIR EKRANDA ikki xil yozilardi: filtr
 * pillarida "Yetkazildi", jadval Tag'ida "yetkazildi". Operator ikkisi
 * boshqa narsa deb o'ylashi mumkin edi — ayniqsa filtrni bosib, jadvalda
 * boshqa yozuvni ko'rganda.
 *
 * Endi ikkisi ham shu xaritadan oladi, ya'ni farqlanishi MUMKIN EMAS.
 * Bosh harf bilan: pill mustaqil yorliq, Tag ham jadval katakchasida
 * o'zicha turadi.
 */
const STATUS_TAG: Record<string, { color: string; label: string }> = {
  completed: { color: "green", label: "Yetkazildi" },
  pending: { color: "gold", label: "Navbatda" },
  processing: { color: "blue", label: "Yuborilmoqda" },
  awaiting_config: { color: "cyan", label: "Sozlama kutilmoqda" },
  permanently_failed: { color: "red", label: "Yetkazilmadi" },
};

const when = (v?: string | null) => (v ? new Date(v).toLocaleString("uz-UZ") : "—");

const ConnectionLog = ({ connection }: { connection: Connection }) => {
  if (connection.kind !== "partner") {
    /**
     * ⚠️ IKKI YO'NALISH BIRGA KO'RSATILADI. Chiquvchi (biz tortib
     * olgan/yuborgan sinxronlar) VA kiruvchi (ular bizga yuborgan
     * webhooklar) — ikkisi bir ekranda, chunki operatorning savoli bitta:
     * "nega ishlamayapti?". Ilgari kiruvchi jurnalni KO'RSATADIGAN joy
     * umuman yo'q edi va butun diagnostika bazada qolib ketardi.
     */
    return (
      <div className="space-y-4">
        {/*
          To'lov tizimida PUL ro'yxati birinchi o'rinda: operatorning
          savoli "qaysi to'lov keldi va nima bo'ldi?". Hisob-kitob tabi
          to'lov roli uchun yashiringan (u kargo COD qarzi uchun qurilgan),
          shu bois pul ro'yxati shu yerda turadi.
        */}
        {connection.role === "payment" && <PaymentLog connection={connection} />}
        <OutboundLog connection={connection} />
        <IncomingWebhookLog connection={connection} />
      </div>
    );
  }
  return <InboundLog connection={connection} />;
};

/**
 * ONLAYN TO'LOVLAR (`payment_transactions`).
 *
 * ⚠️ NEGA BU JADVAL KERAK. 6-bosqichning darsi: JURNALGA YOZISH ≠
 * KO'RINISH. To'lov yozuvlari bazaga tushardi, lekin ularni ko'rsatadigan
 * ekran bo'lmasa "pul keldi, lekin buyurtmaga bog'lanmadi" holati hech
 * kimga ko'rinmaydi — ya'ni yo'qolgan pul.
 *
 * ⚠️ PUL KASSAGA YOZILMAYDI (foydalanuvchi qarori, 2026-09-13) — bu jadval
 * hozircha YAGONA joy, u summani ko'rsatadi. Kompaniya balansi bu pulni
 * hali hisobga olmaydi, shuning uchun banner qo'yilgan.
 */
const PaymentLog = ({ connection }: { connection: Connection }) => {
  const [unapplied, setUnapplied] = useState("all");
  const [page, setPage] = useState(1);

  const payments = usePayments({
    integrationId: connection.id,
    unappliedOnly: unapplied === "unapplied",
    page,
    limit: 20,
  });

  const rows = payments.data?.items ?? [];
  const meta = payments.data?.meta;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Onlayn to'lovlar
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={payments.isFetching}
          onClick={() => void payments.refetch()}
        >
          Yangilash
        </Button>
      }
    >
      {/*
        Bu banner ATAYLAB: operator bu summalarni kompaniya balansida
        izlab, topmasa "tizim buzuq" deb o'ylardi.
      */}
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
        Bu to'lovlar kassaga yozilmaydi — faqat buyurtmaga belgilanadi. Kompaniya balansi ularni
        hali hisobga olmaydi.
      </div>

      <FilterPills
        value={unapplied}
        onChange={(v) => {
          setUnapplied(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "Hammasi", count: meta?.total },
          {
            value: "unapplied",
            label: "Qo'llanmagan",
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-600 text-white border-red-600",
          },
        ]}
      />

      <Table<PaymentRow>
        className="mt-3"
        rowKey={(r) => String(r.id)}
        size="small"
        scroll={{ x: 780 }}
        loading={payments.isLoading}
        dataSource={rows}
        pagination={{
          current: meta?.page ?? page,
          pageSize: meta?.limit ?? 20,
          total: meta?.total ?? rows.length,
          onChange: setPage,
          showSizeChanger: false,
        }}
        columns={[
          {
            title: "Vaqt",
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.createdAt)}</span>
            ),
          },
          {
            title: "Summa",
            width: 140,
            render: (_: unknown, r) => (
              <span className="font-semibold tabular-nums">
                {Number(r.amount).toLocaleString("uz-UZ")} {r.currency}
              </span>
            ),
          },
          {
            title: "Buyurtma",
            width: 130,
            render: (_: unknown, r) =>
              r.order_id ? (
                <span className="font-mono text-xs">#{r.order_id}</span>
              ) : (
                /* Bog'lanmagan to'lov — havola nima kelganini ko'rsatamiz,
                   aks holda operator qaysi to'lov ekanini topa olmaydi. */
                <span className="text-xs text-red-600 dark:text-red-400">
                  {r.order_ref ? `? ${r.order_ref}` : "bog'lanmagan"}
                </span>
              ),
          },
          {
            title: "Natija",
            width: 220,
            render: (_: unknown, r) => {
              const outcome = paymentOutcome(r);
              return <Tag color={outcome.color}>{outcome.label}</Tag>;
            },
          },
          {
            title: "Tranzaksiya",
            render: (_: unknown, r) => (
              <span className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                {r.provider_transaction_id}
                {r.provider_status ? ` · ${r.provider_status}` : ""}
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
};

/**
 * ULAR BIZGA yuborgan webhooklar (`provider_webhook_logs`).
 *
 * Tana ko'rsatilmaydi — serverdan ham qaytmaydi: ichida mijozning telefoni
 * va manzili bo'ladi, savol esa "nima bo'ldi", "mijoz kim" emas.
 */
const IncomingWebhookLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const logs = useWebhookLogs({
    integrationId: connection.id,
    status,
    page,
    limit: 20,
  });

  const rows = logs.data?.items ?? [];
  const meta = logs.data?.meta;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Kiruvchi webhooklar
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={logs.isFetching}
          onClick={() => void logs.refetch()}
        >
          Yangilash
        </Button>
      }
    >
      <FilterPills
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "Hammasi", count: meta?.total },
          {
            value: "processed",
            label: "Qo'llanildi",
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "rejected",
            label: "Rad etildi",
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-600 text-white border-red-600",
          },
        ]}
      />

      <Table<WebhookLogRow>
        className="mt-3"
        rowKey={(r) => String(r.id)}
        size="small"
        scroll={{ x: 720 }}
        loading={logs.isLoading}
        dataSource={rows}
        pagination={{
          current: meta?.page ?? page,
          pageSize: meta?.limit ?? 20,
          total: meta?.total ?? rows.length,
          onChange: setPage,
          showSizeChanger: false,
        }}
        columns={[
          {
            title: "Vaqt",
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.createdAt)}</span>
            ),
          },
          {
            title: "Hodisa",
            width: 150,
            render: (_: unknown, r) => <span className="text-xs">{r.event_type || "—"}</span>,
          },
          {
            title: "Natija",
            width: 200,
            /*
              `status` faqat uch qiymatni biladi (rejected/verified/processed) —
              operator uchun muhim savol esa boshqa: NIMA bo'ldi. Shuning
              uchun natija `error` ichidagi `apply: <natija>` dan o'qiladi.
            */
            render: (_: unknown, r) => {
              const outcome = webhookOutcome(r);
              return <Tag color={outcome.color}>{outcome.label}</Tag>;
            },
          },
          {
            title: "Sabab",
            render: (_: unknown, r) =>
              r.error ? (
                <span className="break-all text-xs text-gray-600 dark:text-gray-300">
                  {r.error}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
        ]}
      />
    </Card>
  );
};

/** BIZ yuborgan webhooklar (`partner_webhook_outbox`). */
const InboundLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const webhooks = usePartnerWebhooks({
    partner_id: connection.id,
    status,
    page,
    limit: 20,
  });
  const { retryWebhook } = usePartnerActions();

  const rows = webhooks.data?.data ?? [];

  const retry = async (id: string) => {
    try {
      await retryWebhook.mutateAsync(id);
      message.success("Qayta navbatga qo'yildi");
    } catch (error) {
      message.error(getBackendErrorMessage(error) || "Qayta urinib bo'lmadi");
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Send className="h-4 w-4" /> Biz yuborgan hodisalar
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={webhooks.isFetching}
          onClick={() => void webhooks.refetch()}
        >
          Yangilash
        </Button>
      }
    >
      <FilterPills
        value={status}
        onChange={(v) => {
          setStatus(v);
          // Filtr o'zgarganda sahifani boshiga qaytaramiz — aks holda
          // 3-sahifada turib filtr almashsa bo'sh ro'yxat ko'rinardi.
          setPage(1);
        }}
        options={[
          { value: "all", label: "Hammasi" },
          /* Yorliqlar `STATUS_TAG` dan — jadval Tag'i bilan bir xil bo'lsin. */
          {
            value: "completed",
            label: STATUS_TAG.completed.label,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "pending",
            label: STATUS_TAG.pending.label,
            icon: <Clock className="h-3.5 w-3.5" />,
            activeClass: "bg-amber-600 text-white border-amber-600",
          },
          {
            value: "awaiting_config",
            label: STATUS_TAG.awaiting_config.label,
            icon: <ShieldOff className="h-3.5 w-3.5" />,
            activeClass: "bg-cyan-600 text-white border-cyan-600",
          },
          {
            value: "permanently_failed",
            label: STATUS_TAG.permanently_failed.label,
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-600 text-white border-red-600",
          },
        ]}
      />

      <Table<PartnerWebhookRow>
        className="mt-3"
        rowKey="id"
        size="small"
        scroll={{ x: 800 }}
        loading={webhooks.isLoading}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize: 20,
          total: webhooks.data?.total ?? rows.length,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "Vaqt",
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.created_at)}</span>
            ),
          },
          {
            title: "Holat",
            width: 150,
            render: (_: unknown, r) => {
              const t = STATUS_TAG[r.status] ?? {
                color: "default",
                label: r.status,
              };
              return (
                <div className="space-y-1">
                  <Tag color={t.color}>{t.label}</Tag>
                  {r.attempts ? <Tag>{r.attempts} urinish</Tag> : null}
                </div>
              );
            },
          },
          {
            title: "Hodisa",
            render: (_: unknown, r) => (
              <span className="text-sm">{r.new_status ?? r.event_type ?? "—"}</span>
            ),
          },
          {
            title: "Buyurtma",
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{r.external_order_id ?? r.order_id ?? "—"}</span>
            ),
          },
          {
            title: "Xato",
            /* Xato matni MUHIM: "yetkazilmadi" o'zi sababni aytmaydi. */
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
            title: "Amal",
            width: 90,
            render: (_: unknown, r) =>
              r.status === "completed" ? null : (
                <Button
                  size="small"
                  icon={<RotateCw className="h-3 w-3" />}
                  loading={retryWebhook.isPending}
                  onClick={() => void retry(String(r.id))}
                  title="Qayta navbatga qo'yish va darhol urinib ko'rish"
                >
                  Qayta
                </Button>
              ),
          },
        ]}
      />
    </Card>
  );
};

/** BIZ tortib olgan sinxronlar (`sync_history`). */
const OutboundLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState("all");
  const history = useSyncHistory({
    integrationId: connection.id,
    status,
    limit: 20,
  });

  const rows = history.data?.items ?? [];
  const summary = history.data?.summary;

  /**
   * ⚠️ Urinish bo'lmasa backend `success_rate: 0` qaytaradi. `0%` deb
   * ko'rsatish "hammasi yiqildi" degan YOLG'ON bo'lardi — aslida hali
   * urinish yo'q.
   */
  const rate = summary && summary.total_attempts > 0 ? `${summary.success_rate}%` : "—";

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Sinxron tarixi
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={history.isFetching}
          onClick={() => void history.refetch()}
        >
          Yangilash
        </Button>
      }
    >
      <FilterPills
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Hammasi", count: summary?.total_attempts },
          {
            value: "success",
            label: "Muvaffaqiyatli",
            count: summary?.success_count,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "failed",
            label: "Yiqilgan",
            count: summary?.failed_count,
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-600 text-white border-red-600",
          },
        ]}
      />

      {summary && (
        <p className="m-0 mt-2 text-xs text-gray-500 dark:text-gray-400">
          Muvaffaqiyat darajasi: <b>{rate}</b>
        </p>
      )}

      <Table<SyncHistoryRow>
        className="mt-3"
        rowKey={(r) => String(r.id)}
        size="small"
        scroll={{ x: 600 }}
        loading={history.isLoading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: "Vaqt",
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{syncWhen(r.sync_date)}</span>
            ),
          },
          {
            title: "Holat",
            width: 140,
            render: (_: unknown, r) =>
              r.status === "success" ? (
                <Tag color="green">muvaffaqiyatli</Tag>
              ) : r.status === "failed" ? (
                <Tag color="red">yiqildi</Tag>
              ) : (
                <Tag>noma'lum</Tag>
              ),
          },
          {
            title: "Buyurtma",
            width: 120,
            render: (_: unknown, r) => <span className="text-sm">{r.synced_orders} ta</span>,
          },
          {
            title: "Natija",
            /* Xato `result` JSON ichida bo'lishi mumkin — "yiqildi" so'zi
               o'zi sababni aytmaydi. */
            render: (_: unknown, r) =>
              r.status === "failed" && r.result ? (
                <span className="break-all text-xs text-red-600 dark:text-red-400">
                  {typeof r.result.error === "string"
                    ? r.result.error
                    : JSON.stringify(r.result).slice(0, 200)}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
        ]}
      />
    </Card>
  );
};

export default ConnectionLog;
