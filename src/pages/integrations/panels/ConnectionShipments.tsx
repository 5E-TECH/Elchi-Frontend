import { useState } from 'react';
import { Alert, Button, Card, Table, Tag, Tooltip, message } from 'antd';
import { AlertTriangle, Link2, RefreshCw, Send, Truck } from 'lucide-react';
import {
  usePartnerShipments,
  useProviderShipments,
  useRedispatch,
  type PartnerShipmentRow,
  type ProviderShipmentRow,
} from '../../../entities/integrations/shipments';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import FilterPills from '../FilterPills';
import type { Connection } from '../useConnections';

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

const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString('uz-UZ') : '—';

const ConnectionShipments = ({ connection }: { connection: Connection }) =>
  connection.kind === 'partner' ? (
    <PartnerShipments connection={connection} />
  ) : (
    <ProviderShipments connection={connection} />
  );

/** Chiquvchi: tashuvchiga berilgan posilkalar. */
const ProviderShipments = ({ connection }: { connection: Connection }) => {
  const [failedOnly, setFailedOnly] = useState('all');
  const [page, setPage] = useState(1);

  const raw = connection.raw as { slug?: string };
  const slug = String(raw.slug ?? '');

  const list = useProviderShipments({
    integrationId: connection.id,
    failedOnly: failedOnly === 'failed',
    page,
    limit: 20,
  });
  const redispatch = useRedispatch();

  const rows = list.data?.items ?? [];

  const retry = async (orderId: string) => {
    if (!slug) {
      // Slug bo'lmasa dispatch marshruti yasalmaydi — sababini aytamiz.
      message.error("Ulanishning `slug` qiymati yo'q — qayta jo'natib bo'lmaydi");
      return;
    }
    try {
      await redispatch.mutateAsync({ slug, orderId });
      message.success("Qayta jo'natildi");
    } catch (error) {
      message.error(getBackendErrorMessage(error) || "Jo'natib bo'lmadi");
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4" /> Jo'natmalar
        </span>
      }
      extra={
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          loading={list.isFetching}
          onClick={() => void list.refetch()}
        >
          Yangilash
        </Button>
      }
    >
      <FilterPills
        value={failedOnly}
        onChange={(v) => {
          setFailedOnly(v);
          setPage(1);
        }}
        options={[
          { value: 'all', label: 'Hammasi', count: list.data?.pagination.total },
          {
            value: 'failed',
            label: 'Yiqilgan',
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            activeClass: 'bg-red-600 text-white border-red-600',
          },
        ]}
      />

      <Table<ProviderShipmentRow>
        className="mt-3"
        rowKey={(r) => String(r.id)}
        size="small"
        scroll={{ x: 900 }}
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
            title: 'Buyurtma',
            width: 110,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">{r.order_id}</span>
            ),
          },
          {
            title: 'Kuzatuv kodi',
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">
                {r.tracking_number ?? r.external_ref ?? '—'}
              </span>
            ),
          },
          {
            title: 'Holat',
            width: 190,
            /*
              IKKI STATUS birga ko'rsatiladi va bu ataylab: ular ajralib
              ketishi mumkin (tashuvchi "delivered" deydi, bizda hali
              "waiting"). Faqat bittasini ko'rsatsak, farqni hech kim
              sezmasdi.
            */
            render: (_: unknown, r) => (
              <div className="space-y-1">
                <Tag color={r.last_error ? 'red' : 'blue'}>
                  biz: {r.internal_status ?? '—'}
                </Tag>
                {r.provider_status && (
                  <Tag>ular: {r.provider_status}</Tag>
                )}
              </div>
            ),
          },
          {
            title: 'Urinish',
            width: 90,
            align: 'center' as const,
            render: (_: unknown, r) => (
              <span className="tabular-nums">{r.send_attempts}</span>
            ),
          },
          {
            title: 'Xato',
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
            title: "O'zgargan",
            width: 160,
            render: (_: unknown, r) => (
              <span className="font-mono text-xs">
                {when(r.status_changed_at)}
              </span>
            ),
          },
          {
            title: 'Amal',
            width: 120,
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
                  Qayta
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
  const [page, setPage] = useState(1);
  const list = usePartnerShipments({
    partnerId: connection.id,
    page,
    limit: 20,
  });
  const rows = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="Bu ro'yxat bog'lanishni ko'rsatadi"
        description="Hamkorning buyurtma raqami ↔ bizdagi buyurtma. Holat va summa buyurtmaning o'zida — qatordagi havola buyurtma sahifasiga olib boradi."
      />

      <Card
        title={
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Kelgan posilkalar
          </span>
        }
        extra={
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            loading={list.isFetching}
            onClick={() => void list.refetch()}
          >
            Yangilash
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
              title: 'Ularning raqami',
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">{r.external_order_id}</span>
              ),
            },
            {
              title: 'Bizdagi buyurtma',
              render: (_: unknown, r) => (
                <a
                  href={`/orders/${r.order_id}`}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  #{r.order_id}
                </a>
              ),
            },
            {
              title: 'Kelgan vaqt',
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
