import { Alert, Card, Statistic, Tag, Tooltip } from 'antd';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Webhook,
  XCircle,
} from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../../entities/integrations';
import {
  fmtMetric,
  type ConnectionMetrics,
} from '../../../entities/integrations/metrics';
import type { Connection } from '../useConnections';

/**
 * UMUMIY HOLAT — tayyorlik checklisti + jonli raqamlar.
 *
 * Shakl PCS `ElchiDashboardTab` dan ko'chirildi: yuqorida xulosa `Alert`,
 * ostida ikki `Card` — chapda checklist, o'ngda raqamlar (`Statistic`).
 *
 * NEGA CHECKLIST. "Nega ishlamayapti?" degan savolga javob ilgari bir necha
 * joyga tarqalgan edi: manzil bir sahifada, sekret boshqasida, oxirgi
 * sinxron uchinchisida. Endi bitta ro'yxat va YETISHMAGANI qizil.
 *
 * ⚠️ Tekshiruvlar ULANISH TURIGA qarab farq qiladi, chunki inbound va
 * outbound uchun "tayyorlik" ma'nosi boshqa:
 *   inbound  — biz ularga webhook YUBORAMIZ → manzil + sekret kerak
 *   outbound — biz ularga so'rov yuboramiz → API manzili + kalit kerak
 */

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  /** `false` bo'lsa ham kritik emas — sariq, qizil emas. */
  optional?: boolean;
}

const buildChecks = (c: Connection): Check[] => {
  const common: Check[] = [
    {
      label: 'Ulanish yoqilgan',
      ok: c.is_active,
      detail: c.is_active
        ? 'faol'
        : "o'chirilgan — hech qanday amal bajarilmaydi",
    },
  ];

  if (c.kind === 'partner') {
    const p = c.raw as {
      webhook_url?: string | null;
      sandbox_webhook_url?: string | null;
    };
    return [
      ...common,
      {
        label: 'Webhook manzili',
        ok: Boolean(p.webhook_url),
        detail: p.webhook_url
          ? String(p.webhook_url)
          : "yo'q — status o'zgarishi hamkorga YETMAYDI (hodisalar kutib qoladi)",
      },
      {
        label: 'Sandbox manzili',
        ok: Boolean(p.sandbox_webhook_url),
        optional: true,
        detail: p.sandbox_webhook_url
          ? String(p.sandbox_webhook_url)
          : 'sozlanmagan — sinov nusxasi yuborilmaydi',
      },
    ];
  }

  const i = c.raw as {
    base_url?: string | null;
    api_url?: string | null;
    auth_type?: string | null;
    last_sync_at?: string | null;
  };
  const url = i.base_url || i.api_url || '';
  return [
    ...common,
    {
      label: 'API manzili',
      ok: Boolean(url),
      detail: url || "yo'q — so'rov yuborib bo'lmaydi",
    },
    {
      label: 'Kirish turi',
      ok: Boolean(i.auth_type),
      detail: i.auth_type ? `turi: ${i.auth_type}` : 'belgilanmagan',
    },
    {
      label: 'Oxirgi sinxron',
      ok: Boolean(i.last_sync_at),
      optional: true,
      detail: i.last_sync_at
        ? new Date(i.last_sync_at).toLocaleString('uz-UZ')
        : "hali sinxron bo'lmagan",
    },
  ];
};

/** PCS `ChecklistItem` — yashil belgi / qizil xato + izoh. */
const ChecklistItem = ({ check }: { check: Check }) => (
  <div className="flex items-start gap-2 py-1.5">
    {check.ok ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
    ) : check.optional ? (
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
    )}
    <div className="min-w-0">
      <span
        className={
          check.ok || check.optional
            ? 'text-gray-700 dark:text-gray-200'
            : 'font-medium text-red-600 dark:text-red-400'
        }
      >
        {check.label}
      </span>
      <span className="block break-words text-xs text-gray-400">
        {check.detail}
      </span>
    </div>
  </div>
);

const ConnectionOverview = ({
  connection,
  metrics,
}: {
  connection: Connection;
  metrics?: ConnectionMetrics;
}) => {
  const checks = buildChecks(connection);
  const blocking = checks.filter((c) => !c.ok && !c.optional);
  const failed = metrics?.failed ?? 0;
  const queued = metrics?.queued ?? 0;

  return (
    <div className="space-y-4">
      <Alert
        type={blocking.length === 0 ? 'success' : 'warning'}
        showIcon
        message={
          blocking.length === 0
            ? 'Ulanish ishlashga tayyor'
            : `${blocking.length} ta sozlama yetishmaydi — checklistni tugatish kerak`
        }
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Tag color="blue">{ROLE_META[connection.role].label}</Tag>
            <Tag>{CATEGORY_LABEL[connection.category]}</Tag>
            {/* Yo'nalish — eng ko'p chalkashgan joy, shuning uchun aniq. */}
            <Tooltip
              title={
                connection.kind === 'partner'
                  ? "Kalit bizdan chiqadi. Status o'zgarganda biz ularga webhook yuboramiz."
                  : "Kalit ularda. So'rovni biz yuboramiz va javobini o'zimizga moslaymiz."
              }
            >
              <Tag color="purple" className="cursor-help">
                {connection.kind === 'partner'
                  ? 'bizga ulanadi'
                  : 'biz ulanamiz'}
              </Tag>
            </Tooltip>
            {failed > 0 && <Tag color="red">{failed} hodisa yetmadi</Tag>}
            {queued > 0 && <Tag color="orange">{queued} navbatda</Tag>}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Tayyorlik checklisti
            </span>
          }
        >
          {checks.map((c) => (
            <ChecklistItem key={c.label} check={c} />
          ))}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Oxirgi 24 soat
            </span>
          }
        >
          {/*
            ⚠️ Metrika YO'Q bo'lishining ikki sababi bor va ular BOSHQA:
            hali kelmadi, yoki 24 soatda hodisa bo'lmagan. Ikkisini bir xil
            ko'rsatish "hodisa yo'q" degan xato xulosaga olib boradi.
          */}
          {!metrics ? (
            <Alert
              type="info"
              showIcon
              message="24 soatda hodisa bo'lmagan"
              description="O'lchash uchun ma'lumot yo'q — ulanish hali ishlatilmagan bo'lishi mumkin."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Statistic title="Hodisa" value={metrics.events} />
                <Statistic
                  title="Yetkazildi"
                  value={metrics.delivered}
                  valueStyle={{ color: '#16a34a' }}
                />
                <Statistic
                  title="Yetmadi"
                  value={metrics.failed}
                  valueStyle={{
                    color: metrics.failed > 0 ? '#dc2626' : undefined,
                  }}
                  prefix={
                    metrics.failed > 0 ? (
                      <AlertTriangle className="inline h-4 w-4" />
                    ) : undefined
                  }
                />
                <Statistic
                  title="Navbatda"
                  value={metrics.queued}
                  valueStyle={{
                    color: metrics.queued > 0 ? '#ea580c' : undefined,
                  }}
                />
              </div>

              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-700/60">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Muvaffaqiyat:</span>
                  {/*
                    `fmtMetric` — o'lchanmagan qiymat "—", hech qachon `0`.
                    `0%` "hammasi yiqildi" degan yolg'on xabar bo'lardi.
                  */}
                  <b>{fmtMetric(metrics.success_rate, '%')}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Javob vaqti:</span>
                  <b>{fmtMetric(metrics.avg_ms, ' ms')}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Webhook className="h-3.5 w-3.5" /> Oxirgi hodisa:
                  </span>
                  <span className="font-mono text-xs">
                    {metrics.last_event_at
                      ? new Date(metrics.last_event_at).toLocaleString('uz-UZ')
                      : '—'}
                  </span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ConnectionOverview;
