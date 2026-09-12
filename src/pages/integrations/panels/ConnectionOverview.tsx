import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../../entities/integrations';
import type { Connection } from '../useConnections';

/**
 * UMUMIY HOLAT — ulanish ishlashga tayyormi.
 *
 * NEGA CHECKLIST SHAKLIDA. Ilgari ulanish holati bir necha joyga tarqalgan
 * edi: manzil bir sahifada, sekret boshqasida, oxirgi sinxron uchinchisida.
 * "Nega ishlamayapti?" degan savolga javob topish uchun operator hammasini
 * ochib chiqishi kerak edi.
 *
 * Endi bitta ro'yxat: nima sozlangan, nima yo'q — va YETISHMAGANI qizil.
 *
 * ⚠️ Tekshiruvlar ULANISH TURIGA qarab farq qiladi, chunki inbound va
 * outbound ulanishning "tayyorlik" ma'nosi boshqa:
 *   inbound  — biz ularga webhook YUBORAMIZ, ya'ni manzil+sekret kerak
 *   outbound — biz ularga so'rov yuboramiz, ya'ni API manzili+kalit kerak
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
      label: 'Faol',
      ok: c.is_active,
      detail: c.is_active
        ? 'ulanish yoqilgan'
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
    total_synced_orders?: number;
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
      label: 'Autentifikatsiya',
      ok: Boolean(i.auth_type) && i.auth_type !== 'none',
      optional: i.auth_type === 'none',
      detail: i.auth_type
        ? `turi: ${i.auth_type}`
        : 'belgilanmagan',
    },
    {
      label: 'Oxirgi sinxron',
      ok: Boolean(i.last_sync_at),
      optional: true,
      detail: i.last_sync_at
        ? new Date(i.last_sync_at).toLocaleString('uz-UZ')
        : 'hali sinxron bo‘lmagan',
    },
  ];
};

const ConnectionOverview = ({ connection }: { connection: Connection }) => {
  const checks = buildChecks(connection);
  const blocking = checks.filter((c) => !c.ok && !c.optional);

  return (
    <div className="space-y-3">
      {/* Ulanish pasporti — rol va tur bir qarashda ko'rinsin. */}
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 dark:bg-primarydark">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-extrabold text-maindark dark:text-white">
            {connection.name}
          </h3>
          <span
            className="rounded-full bg-main/12 px-2 py-0.5 text-[11px] font-bold text-main"
            title={ROLE_META[connection.role].hint}
          >
            {ROLE_META[connection.role].label}
          </span>
          <span className="rounded-full bg-maindark/10 px-2 py-0.5 text-[11px] font-bold text-maindark/70 dark:bg-white/10 dark:text-primary/70">
            {CATEGORY_LABEL[connection.category]}
          </span>
          {/* Yo'nalish — eng ko'p chalkashgan joy, shuning uchun aniq yozamiz. */}
          <span className="rounded-full bg-maindark/5 px-2 py-0.5 text-[11px] font-semibold text-maindark/60 dark:bg-white/5 dark:text-primary/60">
            {connection.kind === 'partner'
              ? 'bizga ulanadi (inbound)'
              : 'biz ulanamiz (outbound)'}
          </span>
        </div>

        <p className="m-0 mt-2 text-xs text-[color:var(--color-text-muted)]">
          {connection.kind === 'partner'
            ? "Kalit bizdan chiqadi. Status o'zgarganda biz ularga webhook yuboramiz."
            : "Kalit ularda. So'rovni biz yuboramiz va javobini o'zimizga moslaymiz."}
        </p>
      </div>

      {/* Tayyorlik xulosasi — avval umumiy javob, keyin tafsilot. */}
      <div
        className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          blocking.length === 0
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
        }`}
      >
        {blocking.length === 0
          ? '✓ Ulanish ishlashga tayyor'
          : `${blocking.length} ta sozlama yetishmaydi`}
      </div>

      <div className="divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-primary dark:bg-primarydark">
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 shrink-0">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : c.optional ? (
                <Info className="h-4 w-4 text-[color:var(--color-text-muted)]" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-maindark dark:text-white">
                {c.label}
              </span>
              <span className="block break-all text-xs text-[color:var(--color-text-muted)]">
                {c.detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionOverview;
