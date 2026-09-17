import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Statistic, Tag, Tooltip } from "antd";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Webhook,
  XCircle,
} from "lucide-react";
import { CATEGORY_LABEL, ROLE_META } from "../../../entities/integrations";
import { fmtMetric, type ConnectionMetrics } from "../../../entities/integrations/metrics";
import type { Connection } from "../useConnections";
import { MUTED } from "../ui";

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

export interface Check {
  labelKey: string;
  ok: boolean;
  detailKey: string;
  /** `detailKey` ichidagi `{{...}}` orniga qoyiladigan qiymatlar. */
  detailParams?: Record<string, string>;
  /** `false` bo'lsa ham kritik emas — sariq, qizil emas. */
  optional?: boolean;
  /**
   * Bu kamchilik QAYSI tabda tuzatiladi.
   *
   * ⚠️ BUSIZ CHECKLIST YARIM FOYDALI. Foydalanuvchi aynan shuni aytdi:
   * "beepostda webhook yo'q deb ko'rsatilayapti, lekin uni qayerdan qo'shish
   * kerak — nomalumligicha qolayapti". Muammoni ko'rsatib, yechimga yo'l
   * ko'rsatmaslik operatorni ekranlar bo'ylab qidirishga majbur qiladi.
   */
  fixTab?: string;
  /** Tuzatiladigan maydonning yorlig'i — "qayerda?" savoliga javob. */
  fixHintKey?: string;
}

export const buildChecks = (c: Connection): Check[] => {
  const common: Check[] = [
    {
      labelKey: "checkEnabled",
      ok: c.is_active,
      detailKey: c.is_active ? "chkActive" : "chkInactiveDetail",
      fixTab: "control",
      fixHintKey: "fixControlMaster",
    },
  ];

  if (c.kind === "partner") {
    const p = c.raw as {
      webhook_url?: string | null;
      sandbox_webhook_url?: string | null;
      sandbox_enabled?: boolean;
      has_sandbox_secret?: boolean;
    };
    return [
      ...common,
      {
        labelKey: "checkWebhookUrl",
        ok: Boolean(p.webhook_url),
        ...(p.webhook_url
          ? { detailKey: "rawValue", detailParams: { value: String(p.webhook_url) } }
          : { detailKey: "chkWebhookMissing" }),
        fixTab: "settings",
        fixHintKey: "fixSettingsWebhook",
      },
      /**
       * SINOV REJIMI — KALITDAN hisoblanadi, manzilning borligidan EMAS.
       *
       * ⚠️ Ilgari faqat `sandbox_webhook_url` tekshirilardi. Ikki xato
       * bergan:
       *  1. manzil bor, kalit o'chiq bo'lsa "sozlangan" deb ko'rsatardi —
       *     nusxa esa KETMASDI;
       *  2. kalit yoqilgan, sekret yo'q bo'lsa ham "sozlangan" derdi —
       *     backend esa nusxani tashlab yuboradi (prodakshn sekreti sinov
       *     muhitiga yuborilmaydi).
       *
       * Endi uchala holat ajratilgan va matn KEYINGI QADAMNI aytadi.
       */
      {
        labelKey: "checkSandbox",
        ok: Boolean(p.sandbox_enabled && p.has_sandbox_secret),
        optional: true,
        detailKey: !p.sandbox_enabled
          ? p.sandbox_webhook_url
            ? "chkSandboxOffWithUrl"
            : "chkSandboxOff"
          : !p.sandbox_webhook_url
            ? "chkSandboxOnNoUrl"
            : !p.has_sandbox_secret
              ? "chkSandboxOnNoSecret"
              : "chkSandboxOn",
        detailParams: { url: String(p.sandbox_webhook_url ?? "") },
        fixTab: "settings",
        fixHintKey: "fixSettingsSandbox",
      },
    ];
  }

  const i = c.raw as {
    base_url?: string | null;
    api_url?: string | null;
    auth_type?: string | null;
    last_sync_at?: string | null;
  };
  const url = i.base_url || i.api_url || "";
  return [
    ...common,
    {
      labelKey: "checkApiUrl",
      ok: Boolean(url),
      ...(url
        ? { detailKey: "rawValue", detailParams: { value: url } }
        : { detailKey: "chkApiUrlMissing" }),
      fixTab: "settings",
      fixHintKey: "fixSettingsApiUrl",
    },
    {
      labelKey: "checkAuthType",
      ok: Boolean(i.auth_type),
      detailKey: i.auth_type ? "chkAuthTypeSet" : "chkAuthTypeMissing",
      detailParams: { type: String(i.auth_type ?? "") },
      fixTab: "settings",
      fixHintKey: "fixSettingsAuthType",
    },
    {
      labelKey: "checkLastSync",
      ok: Boolean(i.last_sync_at),
      optional: true,
      ...(i.last_sync_at
        ? {
            detailKey: "rawValue",
            detailParams: { value: new Date(i.last_sync_at).toLocaleString("uz-UZ") },
          }
        : { detailKey: "chkNeverSynced" }),
      fixTab: "control",
      fixHintKey: "fixControlQueue",
    },
  ];
};

/**
 * PCS `ChecklistItem` — yashil belgi / qizil xato + izoh.
 *
 * Yetishmagan qator BOSILADI va tuzatiladigan tabga o'tkazadi. Bajarilgan
 * qator bosilmaydi: tuzatadigan narsa yo'q va bosiladigandek ko'rinishi
 * chalg'itardi.
 */
const ChecklistItem = ({ check, onFix }: { check: Check; onFix?: (tab: string) => void }) => {
  const { t } = useTranslation("integrations");
  const actionable = !check.ok && Boolean(check.fixTab) && Boolean(onFix);
  const Row = actionable ? "button" : "div";

  return (
    <Row
      {...(actionable
        ? {
            type: "button" as const,
            onClick: () => onFix!(check.fixTab!),
            className:
              "flex w-full cursor-pointer items-start gap-2 rounded-lg py-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40",
          }
        : { className: "flex items-start gap-2 py-1.5" })}
    >
      {check.ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
      ) : check.optional ? (
        <Info className={`mt-0.5 h-4 w-4 shrink-0 ${MUTED}`} />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      )}
      <div className="min-w-0">
        <span
          className={
            check.ok || check.optional
              ? "text-gray-700 dark:text-gray-200"
              : "font-medium text-red-600 dark:text-red-400"
          }
        >
          {t(check.labelKey)}
        </span>
        {/*
        ⚠️ `MUTED` — ilgari `text-gray-400` (dark juftligi YO'Q) edi.
        Bu qator eng muhim diagnostik matnni ko'rsatadi ("webhook manzili
        yo'q — status o'zgarishi hamkorga YETMAYDI"), qorong'ida esa u
        deyarli o'qilmasdi.
      */}
        <span className={`block break-words text-xs ${MUTED}`}>
          {t(check.detailKey, check.detailParams)}
        </span>
        {/* Qayerdan tuzatish — matn bilan aytiladi, taxmin qoldirilmaydi. */}
        {actionable && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            {t(check.fixHintKey ?? "fixDefault")}
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Row>
  );
};

const ConnectionOverview = ({
  connection,
  metrics,
  onFix,
}: {
  connection: Connection;
  metrics?: ConnectionMetrics;
  /** Kamchilikni tuzatish uchun tabga o'tkazadi. */
  onFix?: (tab: string) => void;
}) => {
  const { t } = useTranslation("integrations");
  const checks = buildChecks(connection);
  const blocking = checks.filter((c) => !c.ok && !c.optional);
  const failed = metrics?.failed ?? 0;
  const queued = metrics?.queued ?? 0;

  return (
    <div className="space-y-4">
      <Alert
        type={blocking.length === 0 ? "success" : "warning"}
        showIcon
        message={
          blocking.length === 0 ? t("ovwReady") : t("ovwMissing", { count: blocking.length })
        }
        action={
          /*
            Eng muhim kamchilikka BIR BOSISHDA o'tish. Checklistdagi qator
            ham bosiladi, lekin banner tepada turadi va odam birinchi shuni
            ko'radi.
          */
          blocking.length > 0 && blocking[0].fixTab && onFix ? (
            <Button size="small" type="primary" onClick={() => onFix(blocking[0].fixTab!)}>
              {t("fixDefault")}
            </Button>
          ) : undefined
        }
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Tag color="blue">{t(ROLE_META[connection.role].labelKey)}</Tag>
            <Tag>{t(CATEGORY_LABEL[connection.category])}</Tag>
            {/* Yo'nalish — eng ko'p chalkashgan joy, shuning uchun aniq. */}
            <Tooltip
              title={connection.kind === "partner" ? t("ovwPartnerTip") : t("ovwIntegrationTip")}
            >
              <Tag color="purple" className="cursor-help">
                {connection.kind === "partner" ? t("ovwTagInbound") : t("ovwTagOutbound")}
              </Tag>
            </Tooltip>
            {failed > 0 && <Tag color="red">{t("eventsFailed", { count: failed })}</Tag>}
            {queued > 0 && <Tag color="orange">{t("ovwQueuedTag", { count: queued })}</Tag>}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> {t("ovwChecklistTitle")}
            </span>
          }
        >
          {checks.map((c) => (
            <ChecklistItem key={c.labelKey} check={c} onFix={onFix} />
          ))}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t("ovwLast24h")}
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
              message={t("ovwNoEvents24h")}
              description={t("ovwNoEventsDesc")}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Statistic title={t("statEvents")} value={metrics.events} />
                <Statistic
                  title={t("statDelivered")}
                  value={metrics.delivered}
                  valueStyle={{ color: "#16a34a" }}
                />
                <Statistic
                  title={t("statFailed")}
                  value={metrics.failed}
                  valueStyle={{
                    color: metrics.failed > 0 ? "#dc2626" : undefined,
                  }}
                  prefix={
                    metrics.failed > 0 ? <AlertTriangle className="inline h-4 w-4" /> : undefined
                  }
                />
                <Statistic
                  title={t("statQueued")}
                  value={metrics.queued}
                  valueStyle={{
                    color: metrics.queued > 0 ? "#ea580c" : undefined,
                  }}
                />
              </div>

              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-700/60">
                <div className="flex justify-between gap-2">
                  <span className={MUTED}>{t("ovwSuccessRate")}</span>
                  {/*
                    `fmtMetric` — o'lchanmagan qiymat "—", hech qachon `0`.
                    `0%` "hammasi yiqildi" degan yolg'on xabar bo'lardi.
                  */}
                  <b>{fmtMetric(metrics.success_rate, "%")}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className={MUTED}>{t("ovwAvgMs")}</span>
                  <b>{fmtMetric(metrics.avg_ms, " ms")}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className={`flex items-center gap-1 ${MUTED}`}>
                    <Webhook className="h-3.5 w-3.5" /> {t("ovwLastEvent")}
                  </span>
                  <span className="font-mono text-xs">
                    {metrics.last_event_at
                      ? new Date(metrics.last_event_at).toLocaleString("uz-UZ")
                      : "—"}
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
