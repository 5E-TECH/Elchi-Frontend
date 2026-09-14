import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Segmented, Table, Tag, Tooltip, message } from "antd";
import {
  CheckCircle2,
  Clock,
  ArrowDownUp,
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
const STATUS_TAG: Record<string, { color: string; labelKey: string }> = {
  completed: { color: "green", labelKey: "deliveryDelivered" },
  pending: { color: "gold", labelKey: "deliveryQueued" },
  processing: { color: "blue", labelKey: "deliverySending" },
  awaiting_config: { color: "cyan", labelKey: "deliveryAwaitingConfig" },
  permanently_failed: { color: "red", labelKey: "deliveryFailed" },
};

const when = (v?: string | null) => (v ? new Date(v).toLocaleString("uz-UZ") : "—");

/**
 * ⚠️ BITTA VAQTDA BITTA JADVAL.
 *
 * NIMA BUZILGAN EDI. Chiquvchi va kiruvchi jurnallar (to'lov tizimida esa
 * ustiga to'lovlar ro'yxati) BIRDAN, ustma-ust chizilardi. Natijada bir
 * ekranda UCHTA "Yangilash" tugmasi, UCHTA filtr qatori va uchta jadval
 * turardi: operator qaysi filtr qaysi jadvalga tegishli ekanini
 * taxmin qilardi va kerakli jadvalga yetish uchun uzoq suradi.
 *
 * ⚠️ BITTA UMUMIY JADVALGA BIRLASHTIRILMADI — bu ataylab. Ularning
 * maydonlari umuman boshqa (yetkazish urinishlari / sinxron qilingan
 * buyurtma soni / to'lov summasi). Umumlashtirilgan ustunlar uchalasining
 * ham ma'nosini yo'qotardi.
 *
 * Yechim — KO'RINISH ALMASHTIRGICHI: faqat tanlangan jadval MOUNT bo'ladi,
 * ya'ni ekranda tabiiy ravishda bitta "Yangilash" va bitta filtr qatori
 * qoladi. Har bir ko'rinish o'z so'rovini o'zi boshqaradi (ilgari ham
 * shunday edi), shu bois mantiq o'zgarmadi.
 */
type LogView = "payments" | "inbound" | "outbound";

const ConnectionLog = ({ connection }: { connection: Connection }) => {
  /**
   * Hamkorda YAGONA ko'rinish bor (biz yuborgan hodisalar) — almashtirgich
   * ko'rsatish shovqin bo'lardi.
   */
  if (connection.kind === "partner") {
    return <InboundLog connection={connection} />;
  }
  return <OutboundViews connection={connection} />;
};

const OutboundViews = ({ connection }: { connection: Connection }) => {
  const isPayment = connection.role === "payment";

  /**
   * Tartib ATAYLAB: to'lov tizimida operatorning birinchi savoli "qaysi
   * to'lov keldi va nima bo'ldi?" — shu bois pul ro'yxati birinchi.
   * (Hisob-kitob tabi to'lov roli uchun yashiringan: u kargo COD qarzi
   * uchun qurilgan.)
   */
  const views: Array<{ value: LogView; label: string; icon: ReactNode }> = [
    ...(isPayment
      ? [
          {
            value: "payments" as LogView,
            label: "Onlayn to'lovlar",
            icon: <Wallet className="h-3.5 w-3.5" />,
          },
        ]
      : []),
    {
      value: "inbound",
      label: "Kiruvchi webhooklar",
      icon: <Inbox className="h-3.5 w-3.5" />,
    },
    {
      value: "outbound",
      label: "Sinxron tarixi",
      icon: <ArrowDownUp className="h-3.5 w-3.5" />,
    },
  ];

  const [view, setView] = useState<LogView>(views[0].value);

  return (
    <div className="space-y-3">
      {/*
        Almashtirgich gorizontal sura oladigan bo'lishi kerak: uch yorliq
        telefon ekranida sig'maydi.
      */}
      <div className="overflow-x-auto pb-1">
        <Segmented<LogView>
          value={view}
          onChange={setView}
          options={views.map((v) => ({
            value: v.value,
            label: (
              <span className="flex items-center gap-1.5">
                {v.icon}
                {v.label}
              </span>
            ),
          }))}
        />
      </div>

      {view === "payments" && <PaymentLog connection={connection} />}
      {view === "inbound" && <IncomingWebhookLog connection={connection} />}
      {view === "outbound" && <OutboundLog connection={connection} />}
    </div>
  );
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
  const { t } = useTranslation("integrations");
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
      /*
        ⚠️ SARLAVHA YO'Q — ko'rinishni ALMASHTIRGICH nomlaydi. Ikkisi ham
        yozilsa ayni matn ustma-ust ikki marta chiqardi (test buni
        ushlagan). `extra` yolg'iz ham antd sarlavha qatorini chizadi, ya'ni
        "Yangilash" tugmasi joyida qoladi.
      */
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
          { value: "all", label: t("filterAll"), count: meta?.total },
          {
            value: "unapplied",
            label: t("filterUnapplied"),
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
            title: t("colTime"),
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.createdAt)}</span>
            ),
          },
          {
            title: t("colAmount"),
            width: 140,
            render: (_: unknown, r) => (
              <span className="font-semibold tabular-nums">
                {Number(r.amount).toLocaleString("uz-UZ")} {r.currency}
              </span>
            ),
          },
          {
            title: t("colOrder"),
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
            title: t("colOutcome"),
            width: 220,
            render: (_: unknown, r) => {
              const outcome = paymentOutcome(r);
              return <Tag color={outcome.color}>{t(outcome.labelKey)}</Tag>;
            },
          },
          {
            title: t("colTransaction"),
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
  const { t } = useTranslation("integrations");
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
      /*
        ⚠️ SARLAVHA YO'Q — ko'rinishni ALMASHTIRGICH nomlaydi. Ikkisi ham
        yozilsa ayni matn ustma-ust ikki marta chiqardi (test buni
        ushlagan). `extra` yolg'iz ham antd sarlavha qatorini chizadi, ya'ni
        "Yangilash" tugmasi joyida qoladi.
      */
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
          { value: "all", label: t("filterAll"), count: meta?.total },
          {
            value: "processed",
            label: t("filterApplied"),
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "rejected",
            label: t("filterRejected"),
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
            title: t("colTime"),
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.createdAt)}</span>
            ),
          },
          {
            title: t("colEvent"),
            width: 150,
            render: (_: unknown, r) => <span className="text-xs">{r.event_type || "—"}</span>,
          },
          {
            title: t("colOutcome"),
            width: 200,
            /*
              `status` faqat uch qiymatni biladi (rejected/verified/processed) —
              operator uchun muhim savol esa boshqa: NIMA bo'ldi. Shuning
              uchun natija `error` ichidagi `apply: <natija>` dan o'qiladi.
            */
            render: (_: unknown, r) => {
              const outcome = webhookOutcome(r);
              return <Tag color={outcome.color}>{t(outcome.labelKey)}</Tag>;
            },
          },
          {
            title: t("colReason"),
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
  const { t } = useTranslation("integrations");
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
          { value: "all", label: t("filterAll") },
          /* Yorliqlar `STATUS_TAG` dan — jadval Tag'i bilan bir xil bo'lsin. */
          {
            value: "completed",
            label: t(STATUS_TAG.completed.labelKey),
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "pending",
            label: t(STATUS_TAG.pending.labelKey),
            icon: <Clock className="h-3.5 w-3.5" />,
            activeClass: "bg-amber-600 text-white border-amber-600",
          },
          {
            value: "awaiting_config",
            label: t(STATUS_TAG.awaiting_config.labelKey),
            icon: <ShieldOff className="h-3.5 w-3.5" />,
            activeClass: "bg-cyan-600 text-white border-cyan-600",
          },
          {
            value: "permanently_failed",
            label: t(STATUS_TAG.permanently_failed.labelKey),
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
            title: t("colTime"),
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.created_at)}</span>
            ),
          },
          {
            title: t("colStatus"),
            width: 150,
            render: (_: unknown, r) => {
              /**
               * ⚠️ O'ZGARUVCHI NOMI `tag`, `t` EMAS. Ilgari u `t` deb
               * nomlangan edi va i18n funksiyasini SOYA QILARDI — ya'ni
               * shu blok ichida tarjima chaqirib bo'lmasdi.
               *
               * Xato tur darajasida chiqdi (`label` yo'q), lekin u
               * chiqmasligi ham mumkin edi: agar mahalliy obyektda ham
               * `label` bo'lsa, `t("colTime")` jimgina noto'g'ri narsa
               * qaytarardi.
               */
              const tag = STATUS_TAG[r.status];
              return (
                <div className="space-y-1">
                  <Tag color={tag?.color ?? "default"}>{tag ? t(tag.labelKey) : r.status}</Tag>
                  {r.attempts ? (
                    <Tag>
                      {r.attempts} {t("colAttempt").toLowerCase()}
                    </Tag>
                  ) : null}
                </div>
              );
            },
          },
          {
            title: t("colEvent"),
            render: (_: unknown, r) => (
              <span className="text-sm">{r.new_status ?? r.event_type ?? "—"}</span>
            ),
          },
          {
            title: t("colOrder"),
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{r.external_order_id ?? r.order_id ?? "—"}</span>
            ),
          },
          {
            title: t("colError"),
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
            title: t("colAction"),
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
  const { t } = useTranslation("integrations");
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
      /*
        ⚠️ SARLAVHA YO'Q — ko'rinishni ALMASHTIRGICH nomlaydi. Ikkisi ham
        yozilsa ayni matn ustma-ust ikki marta chiqardi (test buni
        ushlagan). `extra` yolg'iz ham antd sarlavha qatorini chizadi, ya'ni
        "Yangilash" tugmasi joyida qoladi.
      */
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
          { value: "all", label: t("filterAll"), count: summary?.total_attempts },
          {
            value: "success",
            label: t("filterSuccess"),
            count: summary?.success_count,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: "bg-green-600 text-white border-green-600",
          },
          {
            value: "failed",
            label: t("filterFailed"),
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
            title: t("colTime"),
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{syncWhen(r.sync_date)}</span>
            ),
          },
          {
            title: t("colStatus"),
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
            title: t("colOrder"),
            width: 120,
            render: (_: unknown, r) => <span className="text-sm">{r.synced_orders} ta</span>,
          },
          {
            title: t("colOutcome"),
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
