// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-external-console, admin-integrations-partners, admin-integrations-external
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  Info,
  Plug,
  RefreshCw,
  Timer,
  Truck,
  Wallet,
  Webhook,
} from "lucide-react";
import { useIntegrationHealthcheck } from "../../../entities/integrations/healthcheck";
import type { ConnectionMetrics } from "../../../entities/integrations/metrics";
import { toAmount, useReceivableBalance } from "../../../entities/integrations/settlement";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { MINUS_SIGN, formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Pressable,
  StateIcon,
  TONE_FG,
  type Tone,
} from "../../../shared/ui/primitives";
import { ChartBlock, ColumnGrid, LegendList, SegBar, SuccessGauge } from "../ui";
import type { Connection } from "../useConnections";

/**
 * UMUMIY HOLAT — tayyorlik ro'yxati + 24 soatlik natija (maket `*-partners-console`, `*-external-console`).
 *
 * Tuzilma (3 ustun, orasida 1 px chiziq): «Tayyorlik ro'yxati» · «Muvaffaqiyat · 24 soat» (speedometr) ·
 * «Hodisalar tarkibi». Ostida — mavjud uch blok (Posilkalar 24 soat · Kiruvchi webhooklar 24 soat ·
 * COD butun vaqt, `data-testid="ovw-*"`) bitta qatorda: maketdagi «Hodisalar · oxirgi 7 kun» — «Taklif»
 * (kunlik seriya API'da yo'q), chizilmaydi, o'rnini shu bloklar egallaydi.
 *
 * NEGA CHECKLIST. "Nega ishlamayapti?" degan savolga javob bitta ro'yxatda, YETISHMAGANI ajralib
 * turadi va tuzatiladigan joyga bitta bosishda olib boradi (`onFix(tab)`).
 *
 * ⚠️ Tekshiruvlar ULANISH TURIGA qarab farq qiladi, chunki inbound va outbound uchun «tayyorlik»
 * ma'nosi boshqa:
 *   inbound  — biz ularga webhook YUBORAMIZ → manzil + sekret kerak
 *   outbound — biz ularga so'rov yuboramiz → API manzili + kalit kerak
 */

export interface Check {
  labelKey: string;
  ok: boolean;
  detailKey: string;
  /** `detailKey` ichidagi `{{...}}` o'rniga qo'yiladigan qiymatlar. */
  detailParams?: Record<string, string>;
  /** `false` bo'lsa ham kritik emas — sariq, qizil emas. */
  optional?: boolean;
  /**
   * Bu kamchilik QAYSI tabda tuzatiladi.
   *
   * ⚠️ BUSIZ CHECKLIST YARIM FOYDALI. Foydalanuvchi aynan shuni aytdi: «beepostda webhook yo'q deb
   * ko'rsatilayapti, lekin uni qayerdan qo'shish kerak — noma'lumligicha qolayapti».
   */
  fixTab?: string;
  /** Tuzatiladigan maydonning yorlig'i — «qayerda?» savoliga javob. */
  fixHintKey?: string;
}

export const buildChecks = (c: Connection): Check[] => {
  const common: Check[] = [
    {
      labelKey: "checkEnabled",
      ok: c.is_active,
      detailKey: c.is_active ? (c.kind === "partner" ? "chkActive" : "chkActiveOutbound") : "chkInactiveDetail",
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
       * SINOV REJIMI — KALITDAN hisoblanadi, manzilning borligidan EMAS: manzil bor, kalit o'chiq
       * bo'lsa nusxa KETMAYDI; kalit yoqilgan, sekret yo'q bo'lsa backend nusxani tashlab yuboradi.
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
      ...(url ? { detailKey: "rawValue", detailParams: { value: url } } : { detailKey: "chkApiUrlMissing" }),
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
        ? { detailKey: "rawValue", detailParams: { value: formatDateTimeLocalized(i.last_sync_at) } }
        : { detailKey: "chkNeverSynced" }),
      fixTab: "control",
      fixHintKey: "fixControlQueue",
    },
  ];
};

/** Kirish turi xom kodi → yorliq kaliti («Turi: API kalit»). */
const AUTH_TYPE_KEY: Record<string, string> = { api_key: "fOptApiKeyLabel", login: "fOptLoginLabel" };

/** Yetishmagan majburiy qatordagi tugma matni (maket: «Webhook manzilini kiritish»). */
const FIX_BUTTON_KEY: Record<string, string> = {
  checkEnabled: "console.fixEnable",
  checkWebhookUrl: "console.fixWebhookUrl",
  checkApiUrl: "console.fixApiUrl",
  checkAuthType: "console.fixAuthType",
};

/** Metrika so'rovining holati — «—» ning SABABI shunga qarab aytiladi. */
export type MetricsState = "loading" | "error" | "ready";

const ChecklistItem = ({ check, onFix }: { check: Check; onFix?: (tab: string) => void }) => {
  const { t } = useTranslation("integrations");
  const actionable = !check.ok && Boolean(check.fixTab) && Boolean(onFix);
  const missing = !check.ok && !check.optional;
  const params =
    check.detailParams && check.labelKey === "checkAuthType" && AUTH_TYPE_KEY[check.detailParams.type]
      ? { ...check.detailParams, type: t(AUTH_TYPE_KEY[check.detailParams.type]) }
      : check.detailParams;
  const Icon = check.ok ? CircleCheck : check.optional ? Info : CircleX;
  const srKey = check.ok ? "console.chkDone" : check.optional ? "console.chkOptional" : "console.chkMissing";

  return (
    <div
      role="listitem"
      className={cx("flex items-start gap-3 rounded-[10px] px-3 py-2.5", missing && "bg-warning-soft")}
    >
      <span
        className={cx(
          "mt-px inline-flex",
          check.ok ? TONE_FG.success : check.optional ? "text-text-subtle" : TONE_FG.warning,
        )}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="sr-only">{t(srKey)}</span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text">{t(check.labelKey)}</span>
          {check.optional ? <span className="text-xs text-text-subtle">{t("console.optional")}</span> : null}
        </span>
        <span className="text-[13px] leading-[18px] text-text-muted [overflow-wrap:anywhere]">
          {t(check.detailKey, params)}
        </span>
        {actionable && missing && FIX_BUTTON_KEY[check.labelKey] ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="secondary" rightIcon={ChevronRight} onClick={() => onFix!(check.fixTab!)}>
              {t(FIX_BUTTON_KEY[check.labelKey])}
            </Button>
          </div>
        ) : actionable ? (
          <Pressable
            onClick={() => onFix!(check.fixTab!)}
            className="mt-1 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-action-fg hover:underline max-md:min-h-11"
          >
            {t(check.fixHintKey ?? "fixDefault")}
            <ChevronRight size={16} aria-hidden="true" />
          </Pressable>
        ) : null}
      </div>
    </div>
  );
};

/**
 * RAQAM PLITKASI — bosilsa raqamning manbai bo'lgan tabga o'tadi.
 *
 * ⚠️ Qiymat `null` bo'lsa «—» (o'lchanmagan), HECH QACHON `0`: `0` «hammasi joyida / qarz yo'q»
 * degan yolg'on xabar bo'lardi.
 */
const MetricTile = ({
  label,
  value,
  tone,
  tab,
  tabLabel,
  onOpen,
}: {
  label: string;
  /** Tayyor matn yoki `null` — «—». */
  value: string | null;
  /** Rang faqat o'lchangan va e'tibor talab qiladigan qiymatga beriladi. */
  tone?: Extract<Tone, "success" | "warning" | "danger">;
  tab: string;
  tabLabel: string;
  onOpen?: (tab: string) => void;
}) => {
  const { t } = useTranslation("integrations");
  const body = (
    <>
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <span
        data-tile-value=""
        className={cx(
          "whitespace-nowrap text-xl font-bold leading-7 tabular-nums",
          value !== null && tone ? TONE_FG[tone] : "text-text",
        )}
      >
        {value ?? "—"}
      </span>
    </>
  );
  if (!onOpen) return <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-sunken px-3 py-2.5">{body}</div>;
  return (
    <Pressable
      onClick={() => onOpen(tab)}
      title={t("ovwOpenTab", { tab: tabLabel })}
      aria-label={`${label}: ${value ?? "—"}. ${t("ovwOpenTab", { tab: tabLabel })}`}
      className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-sunken px-3 py-2.5 text-left transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none"
    >
      {body}
    </Pressable>
  );
};

/** «—» nega turibdi — bir qatorda (yuklanayotganda hech narsa, xatoda — «yuklab bo'lmadi»). */
const MissingNote = ({ state, missing }: { state: MetricsState; missing: boolean }) => {
  const { t } = useTranslation("integrations");
  if (state === "error") return <p className={cx("text-xs", TONE_FG.danger)}>{t("ovwMetricsError")}</p>;
  if (state === "ready" && missing) return <p className="text-xs text-text-muted">{t("ovwNotMeasured")}</p>;
  return null;
};

const WindowBadge = ({ children }: { children: ReactNode }) => <Badge size="sm">{children}</Badge>;

const ConnectionOverview = ({
  connection,
  metrics,
  onFix,
  metricsState = "ready",
  hiddenTabs,
  onRefresh,
  refreshing,
  prevSuccessRate = null,
}: {
  connection: Connection;
  metrics?: ConnectionMetrics;
  /** Metrika so'rovi holati (yuklanmoqda / xato / tayyor). */
  metricsState?: MetricsState;
  /** Kamchilikni tuzatish / raqam manbaini ochish uchun tabga o'tkazadi. */
  onFix?: (tab: string) => void;
  /** Shu ulanishda YO'Q tablar — ularning bloki ham, havolasi ham chiqmaydi. */
  hiddenTabs?: ReadonlySet<string>;
  /** «Yangilash» — ulanish va metrika keshini invalidatsiya qiladi. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Kechagi (48 − 24 soat) muvaffaqiyat foizi — maket «Kecha 99,3% edi» (D1); `null` — ko'rsatilmaydi. */
  prevSuccessRate?: number | null;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const pct = (value: number) => formatPercentLocalized(value, { language });
  const healthcheck = useIntegrationHealthcheck();
  const checks = buildChecks(connection);
  const required = checks.filter((c) => !c.optional);
  const blocking = required.filter((c) => !c.ok);

  const isPartner = connection.kind === "partner";
  const isIntegration = !isPartner;
  const hasTab = (tab: string) => !hiddenTabs?.has(tab);
  const shipments = metrics?.shipments ?? null;
  const webhooks = metrics?.webhooks ?? null;
  const cod = metrics?.cod ?? null;
  /** Kiruvchi webhook — faqat «biz ulanamiz» turida (imzoni BIZ tekshiramiz). */
  const showWebhooks = isIntegration && hasTab("log");
  const showShipments = hasTab("shipments");
  /** COD daftari faqat tashuvchi ulanishida yuritiladi (hamkorda — ularda). */
  const showCod = isIntegration && hasTab("settlement");
  /**
   * ⚠️ YOPILMAGAN QARZ — Hisob-kitob tabidagi qoldiqning O'ZI: AYNI so'rov, AYNI kesh kaliti. Metrika
   * endpointidan alohida `cod.debt` olinsa, bir yorliq ostida ikki manba bo'lib qolardi.
   */
  const balance = useReceivableBalance(showCod ? connection.id : undefined, { silentError: true });
  const debt = balance.data ? toAmount(balance.data.outstanding_amount) : null;

  const count = (value: number | null | undefined) => (value === null || value === undefined ? null : num(value));
  const amount = (value: number | null | undefined) =>
    value === null || value === undefined ? null : formatMoneyLocalized(value, { language });

  /** «Aloqani sinash» — Ish rejimi tabidagi AYNI amal va nom (terminologiya testi). */
  const ping = async () => {
    const label = t("ctlPingBtn");
    try {
      const res = await healthcheck.mutateAsync(connection.id);
      // ⚠️ Backend yiqilganda HTTP xato BERMAYDI — natija `ok` bo'yicha o'qiladi.
      if (!res.ok) throw new Error(res.message ?? `HTTP ${res.status ?? "—"}`);
      notify.success(t("ctlDone", { label }));
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("ctlFailed", { label }));
    }
  };

  /* ── Tayyorlik ── */
  const requiredDone = required.length - blocking.length;
  const optionalChecks = checks.filter((c) => c.optional);
  const readinessParts = [
    ...required.map((c) => ({ value: 1, className: c.ok ? "bg-success" : "bg-warning" })),
    ...optionalChecks.map((c) => ({ value: 1, className: c.ok ? "bg-success" : "bg-chart-muted" })),
  ];
  const allDone = blocking.length === 0 && optionalChecks.every((c) => c.ok);

  /* ── 24 soat natijasi ── */
  const delivered = metrics?.delivered ?? 0;
  const failed = metrics?.failed ?? 0;
  const queued = metrics?.queued ?? 0;
  const events = metrics?.events ?? 0;
  const rate = metrics?.success_rate ?? null;
  const measured = rate !== null;
  const rateDelta = measured && prevSuccessRate !== null ? rate - prevSuccessRate : null;
  const zone: Tone = !measured ? "neutral" : rate >= 70 ? "success" : rate >= 40 ? "warning" : "danger";
  const zoneKey = rate === null ? null : rate >= 70 ? "console.zoneGood" : rate >= 40 ? "console.zoneMid" : "console.zoneLow";
  const total = delivered + queued + failed;
  const share = (value: number) => (total > 0 ? pct((value / total) * 100) : pct(0));

  return (
    <div className="flex min-w-0 flex-col">
      {/* Amallar — sarlavha ostidagi qator (telefonda to'liq enli). */}
      <div
        data-testid="ovw-actions"
        className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3 max-md:px-4 max-md:[&>*]:flex-1"
      >
        {isIntegration ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Plug}
            loading={healthcheck.isPending}
            title={t("ctlPingTip")}
            onClick={() => void ping()}
            className="max-md:min-h-11"
          >
            {t("ctlPingBtn")}
          </Button>
        ) : null}
        {onRefresh ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={RefreshCw}
            loading={refreshing}
            onClick={onRefresh}
            className="max-md:min-h-11"
          >
            {t("refresh")}
          </Button>
        ) : null}
      </div>

      <ColumnGrid>
        {/* ═══ Tayyorlik ro'yxati ═══ */}
        <section
          data-testid="ovw-checklist"
          aria-labelledby={`ovw-chk-${connection.uid}`}
          className="flex flex-col gap-4 bg-surface p-5 max-md:p-4"
        >
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <h3 id={`ovw-chk-${connection.uid}`} className="text-sm font-semibold text-text">
              {t("ovwChecklistTitle")}
            </h3>
            {blocking.length > 0 ? (
              <Badge tone="warning">{t("console.missingCount", { count: blocking.length })}</Badge>
            ) : (
              <Badge tone="success" dot>
                {t("ovwReady")}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-text-muted">{t("console.checksLabel")}</span>
              <span className="font-semibold text-text">
                {allDone
                  ? t("console.checksAllDone", { done: num(checks.length), total: num(checks.length) })
                  : t("console.checksRequired", { done: num(requiredDone), total: num(required.length) })}
              </span>
            </div>
            <SegBar
              parts={readinessParts}
              ariaLabel={t("console.checksAria", {
                done: num(requiredDone),
                total: num(required.length),
                optional: num(optionalChecks.filter((c) => !c.ok).length),
              })}
            />
          </div>
          <div role="list" className="-mx-3 flex flex-col gap-1">
            {checks.map((c) => (
              <ChecklistItem key={c.labelKey} check={c} onFix={onFix} />
            ))}
          </div>
          {blocking.length === 0 && failed > 0 && hasTab("log") ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-text-muted">
              <span>{t("console.readyButFailed", { count: failed })}</span>
              {onFix ? (
                <Pressable
                  onClick={() => onFix("log")}
                  className="inline-flex items-center gap-1 font-semibold text-action-fg hover:underline max-md:min-h-11"
                >
                  {t("console.openEvents")}
                  <ChevronRight size={16} aria-hidden="true" />
                </Pressable>
              ) : null}
            </p>
          ) : null}
        </section>

        {/* ═══ Muvaffaqiyat · 24 soat ═══ */}
        <ChartBlock
          id={`ovw-rate-${connection.uid}`}
          title={t("console.rateTitle")}
          subtitle={
            measured
              ? prevSuccessRate !== null
                ? t("console.rateYesterday", { rate: pct(prevSuccessRate) })
                : t("console.rateSub")
              : t("console.rateNotMeasuredSub")
          }
          controls={
            rateDelta !== null ? (
              <Badge tone={Math.abs(rateDelta) < 0.05 ? "neutral" : rateDelta > 0 ? "success" : "danger"}>
                {t("console.deltaPp", {
                  value: `${rateDelta > 0 ? "+" : rateDelta < 0 ? MINUS_SIGN : ""}${formatNumberLocalized(Math.abs(rateDelta), { language, fractionDigits: 1 })}`,
                })}
              </Badge>
            ) : null
          }
        >
          <SuccessGauge
            value={rate}
            valueText={measured ? pct(rate) : "—"}
            label={measured ? t("console.rateLabel") : t("console.rateNoneLabel")}
            badge={
              zoneKey ? (
                <Badge tone={zone}>{t(zoneKey)}</Badge>
              ) : (
                <Badge icon={CircleMinus}>{t("console.rateNotMeasured")}</Badge>
              )
            }
            ariaLabel={
              measured
                ? t("console.rateAria", { rate: pct(rate), delivered: num(delivered), failed: num(failed) })
                : t("console.rateNoneAria", { queued: num(queued) })
            }
            stats={[
              {
                key: "delivered",
                tone: measured ? "success" : "neutral",
                icon: <CircleCheck size={16} aria-hidden="true" />,
                value: t("console.countTa", { count: num(delivered) }),
                label: t("deliveryDelivered"),
              },
              {
                key: "failed",
                tone: measured ? "danger" : "neutral",
                icon: <CircleX size={16} aria-hidden="true" />,
                value: t("console.countTa", { count: num(failed) }),
                label: t("deliveryFailed"),
              },
            ]}
          />
        </ChartBlock>

        {/* ═══ Hodisalar tarkibi ═══ */}
        <ChartBlock
          id={`ovw-mix-${connection.uid}`}
          title={t("console.mixTitle")}
          subtitle={t("console.mixSub", { count: num(events) })}
          controls={
            onFix && hasTab("log") ? (
              <Button variant="ghost" size="sm" rightIcon={ChevronRight} onClick={() => onFix("log")} className="-mr-2 max-md:min-h-11">
                {t("console.all")}
              </Button>
            ) : null
          }
        >
          {!metrics ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-sunken px-4 py-6 text-center">
              <StateIcon icon={Clock} size="chart" />
              <p className="text-base font-bold text-text">{t("ovwNoEvents24h")}</p>
              <p className="max-w-[320px] text-sm text-text-muted">{t("ovwNoEventsDesc")}</p>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-6 gap-y-4">
                <div
                  role="img"
                  aria-label={
                    total > 0 && queued === total
                      ? t("console.mixAllQueuedAria", { count: num(queued) })
                      : t("console.mixAria", {
                          count: num(total),
                          delivered: num(delivered),
                          queued: num(queued),
                          failed: num(failed),
                        })
                  }
                  className="flex min-w-0 flex-[0_1_184px] flex-col items-center gap-1.5 py-2"
                >
                  {total > 0 && queued === total ? (
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-warning-soft text-warning-fg">
                      <Clock size={16} aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="whitespace-nowrap text-[28px] leading-9 font-bold text-text proportional-nums">
                    {num(total > 0 && queued === total ? queued : events)}
                    <span className="ml-1 text-sm font-semibold text-text-muted">
                      {total > 0 && queued === total ? t("console.unitTa") : t("console.unitEvents24h")}
                    </span>
                  </span>
                  {total > 0 && queued === total ? (
                    <span className="text-center text-[13px] text-text-muted">{t("console.allQueued")}</span>
                  ) : null}
                </div>
                <LegendList
                  ariaLabel={t("console.mixLegendAria")}
                  className="min-w-0 flex-[1_1_240px]"
                  rows={[
                    {
                      key: "delivered",
                      keyClassName: "bg-success",
                      icon: <CircleCheck size={14} aria-hidden="true" className="shrink-0 text-text-muted" />,
                      label: t("deliveryDelivered"),
                      value: t("console.countTa", { count: num(delivered) }),
                      share: share(delivered),
                    },
                    {
                      key: "queued",
                      keyClassName: "bg-warning",
                      icon: <Clock size={14} aria-hidden="true" className="shrink-0 text-text-muted" />,
                      label: t("deliveryQueued"),
                      value: t("console.countTa", { count: num(queued) }),
                      share: share(queued),
                    },
                    {
                      key: "failed",
                      keyClassName: "bg-danger",
                      icon: <CircleX size={14} aria-hidden="true" className="shrink-0 text-text-muted" />,
                      label: t("deliveryFailed"),
                      value: t("console.countTa", { count: num(failed) }),
                      share: share(failed),
                    },
                  ]}
                />
              </div>
              {isPartner && queued > 0 && !(connection.raw as { webhook_url?: string | null }).webhook_url ? (
                <p className="flex items-start gap-2 text-xs text-text-muted">
                  <Clock size={14} aria-hidden="true" className="mt-px shrink-0" />
                  <span>{t("console.queuedWillSend", { count: num(queued) })}</span>
                </p>
              ) : null}
            </>
          )}
          <dl className="mt-auto flex flex-col border-t border-border">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="flex min-w-0 items-center gap-2 text-[13px] text-text">
                <Timer size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
                {t("console.responseTime")}
              </dt>
              <dd className="m-0 flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
                {metrics?.avg_ms != null ? (
                  <span className="whitespace-nowrap font-semibold text-text">
                    {t("console.ms", { value: num(metrics.avg_ms) })}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-text-muted">
                      {isPartner ? t("console.noResponseYet") : t("console.notMeasuredOutbound")}
                    </span>
                    <span className="font-semibold text-text">—</span>
                  </>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border py-2.5">
              <dt className="flex min-w-0 items-center gap-2 text-[13px] text-text">
                <Webhook size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
                {t("console.lastEvent")}
              </dt>
              <dd className="m-0 whitespace-nowrap font-semibold text-text">
                {metrics?.last_event_at ? formatDateTimeLocalized(metrics.last_event_at, { language }) : "—"}
              </dd>
            </div>
          </dl>
        </ChartBlock>
      </ColumnGrid>

      {/* ═══ Posilkalar · webhooklar · COD — bitta qatorda (telefonda ustma-ust) ═══ */}
      {showShipments || showWebhooks || showCod ? (
        <ColumnGrid basis={300}>
          {showShipments ? (
            <ChartBlock
              data-testid="ovw-shipments"
              title={t("ovwShipmentsTitle")}
              titleAddon={<WindowBadge>{t("ovwWindow24h")}</WindowBadge>}
              controls={<Truck size={18} aria-hidden="true" className="text-text-subtle" />}
            >
              <div className="grid grid-cols-2 gap-2">
                <MetricTile label={t("ovwShpTotal")} value={count(shipments?.total)} tab="shipments" tabLabel={t("tabShipments")} onOpen={onFix} />
                <MetricTile
                  label={t("filterDelivered")}
                  value={count(shipments?.delivered)}
                  tone="success"
                  tab="shipments"
                  tabLabel={t("tabShipments")}
                  onOpen={onFix}
                />
                <MetricTile
                  label={t("filterFailed")}
                  value={count(shipments?.failed)}
                  tone={(shipments?.failed ?? 0) > 0 ? "danger" : undefined}
                  tab="shipments"
                  tabLabel={t("tabShipments")}
                  onOpen={onFix}
                />
                {/* ⚠️ Status xaritasi yo'q ulanishda (`mismatch: null`) bu raqam CHIQMAYDI. */}
                {shipments?.mismatch !== null && shipments?.mismatch !== undefined ? (
                  <MetricTile
                    label={t("filterMismatch")}
                    value={count(shipments.mismatch)}
                    tone={shipments.mismatch > 0 ? "warning" : undefined}
                    tab="shipments"
                    tabLabel={t("tabShipments")}
                    onOpen={onFix}
                  />
                ) : null}
              </div>
              <MissingNote state={metricsState} missing={!shipments} />
            </ChartBlock>
          ) : null}

          {showWebhooks ? (
            <ChartBlock
              data-testid="ovw-webhooks"
              title={t("ovwWebhooksTitle")}
              titleAddon={<WindowBadge>{t("ovwWindow24h")}</WindowBadge>}
              controls={<Webhook size={18} aria-hidden="true" className="text-text-subtle" />}
            >
              <div className="grid grid-cols-2 gap-2">
                <MetricTile label={t("filterApplied")} value={count(webhooks?.success)} tone="success" tab="log" tabLabel={t("tabEvents")} onOpen={onFix} />
                <MetricTile
                  label={t("filterRejected")}
                  value={count(webhooks?.failed)}
                  tone={(webhooks?.failed ?? 0) > 0 ? "danger" : undefined}
                  tab="log"
                  tabLabel={t("tabEvents")}
                  onOpen={onFix}
                />
                {/* Imzo xato — sekret ikki tomonda mos emas degani. */}
                {!webhooks || webhooks.invalid_signature !== null ? (
                  <MetricTile
                    label={t("filterInvalidSignature")}
                    value={count(webhooks?.invalid_signature)}
                    tone={(webhooks?.invalid_signature ?? 0) > 0 ? "danger" : undefined}
                    tab="log"
                    tabLabel={t("tabEvents")}
                    onOpen={onFix}
                  />
                ) : null}
              </div>
              <MissingNote state={metricsState} missing={!webhooks} />
            </ChartBlock>
          ) : null}

          {/*
            ═══ COD (BUTUN VAQT) ═══ ⚠️ OYNA BOSHQA: yuqoridagi raqamlar 24 soatlik, bu esa butun vaqt —
            qarz davr bilan kesilmaydi. Manba — hisob-kitob daftari, Hisob-kitob tabi bilan AYNI raqam.
          */}
          {showCod ? (
            <ChartBlock
              data-testid="ovw-cod"
              title={t("ovwCodTitle")}
              titleAddon={<WindowBadge>{t("ovwWindowAllTime")}</WindowBadge>}
              controls={<Wallet size={18} aria-hidden="true" className="text-text-subtle" />}
            >
              {/* Summa uzun («15 000 000 so'm») — tor blokda bitta ustun, kesilmaydi. */}
              <div className="@container">
              <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                <MetricTile label={t("ovwCodDispatched")} value={amount(cod?.dispatched)} tab="settlement" tabLabel={t("tabSettlement")} onOpen={onFix} />
                <MetricTile label={t("ovwCodCollected")} value={amount(cod?.collected)} tab="settlement" tabLabel={t("tabSettlement")} onOpen={onFix} />
                <MetricTile
                  label={t("ovwCodRemitted")}
                  value={amount(cod?.remitted)}
                  tone="success"
                  tab="settlement"
                  tabLabel={t("tabSettlement")}
                  onOpen={onFix}
                />
                <MetricTile
                  label={t("ovwCodDebt")}
                  value={amount(debt)}
                  tone={(debt ?? 0) > 0 ? "warning" : undefined}
                  tab="settlement"
                  tabLabel={t("tabSettlement")}
                  onOpen={onFix}
                />
              </div>
              </div>
              <MissingNote state={metricsState} missing={!cod} />
              {balance.isError ? <p className={cx("text-xs", TONE_FG.danger)}>{t("ovwBalanceError")}</p> : null}
              <p className="text-xs text-text-muted">{t("ovwCodNote")}</p>
            </ChartBlock>
          ) : null}
        </ColumnGrid>
      ) : null}
    </div>
  );
};

export default ConnectionOverview;
