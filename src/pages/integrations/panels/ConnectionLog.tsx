import { useState } from 'react';
import { Button, Card, Table, Tag, Tooltip, message } from 'antd';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCw,
  Send,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import {
  usePartnerActions,
  usePartnerWebhooks,
  type PartnerWebhookRow,
} from '../../../entities/partners';
import {
  syncWhen,
  useSyncHistory,
  type SyncHistoryRow,
} from '../../../entities/integrations/syncHistory';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import FilterPills from '../FilterPills';
import type { Connection } from '../useConnections';

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

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  completed: { color: 'green', label: 'yetkazildi' },
  pending: { color: 'gold', label: 'navbatda' },
  processing: { color: 'blue', label: 'yuborilmoqda' },
  awaiting_config: { color: 'cyan', label: 'sozlama kutilmoqda' },
  permanently_failed: { color: 'red', label: 'yetkazilmadi' },
};

const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString('uz-UZ') : '—';

const ConnectionLog = ({ connection }: { connection: Connection }) => {
  if (connection.kind !== 'partner') {
    return <OutboundLog connection={connection} />;
  }
  return <InboundLog connection={connection} />;
};

/** BIZ yuborgan webhooklar (`partner_webhook_outbox`). */
const InboundLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState('all');
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
          { value: 'all', label: 'Hammasi' },
          {
            value: 'completed',
            label: 'Yetkazildi',
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: 'bg-green-600 text-white border-green-600',
          },
          {
            value: 'pending',
            label: 'Navbatda',
            icon: <Clock className="h-3.5 w-3.5" />,
            activeClass: 'bg-amber-600 text-white border-amber-600',
          },
          {
            value: 'awaiting_config',
            label: 'Sozlama kutilmoqda',
            icon: <ShieldOff className="h-3.5 w-3.5" />,
            activeClass: 'bg-cyan-600 text-white border-cyan-600',
          },
          {
            value: 'permanently_failed',
            label: 'Yetkazilmadi',
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: 'bg-red-600 text-white border-red-600',
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
            title: 'Vaqt',
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{when(r.created_at)}</span>
            ),
          },
          {
            title: 'Holat',
            width: 150,
            render: (_: unknown, r) => {
              const t = STATUS_TAG[r.status] ?? {
                color: 'default',
                label: r.status,
              };
              return (
                <div className="space-y-1">
                  <Tag color={t.color}>{t.label}</Tag>
                  {r.attempts ? (
                    <Tag>{r.attempts} urinish</Tag>
                  ) : null}
                </div>
              );
            },
          },
          {
            title: 'Hodisa',
            render: (_: unknown, r) => (
              <span className="text-sm">
                {r.new_status ?? r.event_type ?? '—'}
              </span>
            ),
          },
          {
            title: 'Buyurtma',
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">
                {r.external_order_id ?? r.order_id ?? '—'}
              </span>
            ),
          },
          {
            title: 'Xato',
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
            title: 'Amal',
            width: 90,
            render: (_: unknown, r) =>
              r.status === 'completed' ? null : (
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
  const [status, setStatus] = useState('all');
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
  const rate =
    summary && summary.total_attempts > 0 ? `${summary.success_rate}%` : '—';

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
          { value: 'all', label: 'Hammasi', count: summary?.total_attempts },
          {
            value: 'success',
            label: 'Muvaffaqiyatli',
            count: summary?.success_count,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            activeClass: 'bg-green-600 text-white border-green-600',
          },
          {
            value: 'failed',
            label: 'Yiqilgan',
            count: summary?.failed_count,
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: 'bg-red-600 text-white border-red-600',
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
            title: 'Vaqt',
            width: 170,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{syncWhen(r.sync_date)}</span>
            ),
          },
          {
            title: 'Holat',
            width: 140,
            render: (_: unknown, r) =>
              r.status === 'success' ? (
                <Tag color="green">muvaffaqiyatli</Tag>
              ) : r.status === 'failed' ? (
                <Tag color="red">yiqildi</Tag>
              ) : (
                <Tag>noma'lum</Tag>
              ),
          },
          {
            title: 'Buyurtma',
            width: 120,
            render: (_: unknown, r) => (
              <span className="text-sm">{r.synced_orders} ta</span>
            ),
          },
          {
            title: 'Natija',
            /* Xato `result` JSON ichida bo'lishi mumkin — "yiqildi" so'zi
               o'zi sababni aytmaydi. */
            render: (_: unknown, r) =>
              r.status === 'failed' && r.result ? (
                <span className="break-all text-xs text-red-600 dark:text-red-400">
                  {typeof r.result.error === 'string'
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
