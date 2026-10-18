// dizayn-v2: superadmin-integrations-wizard, admin-integrations-wizard
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Check, CircleX, RefreshCw } from "lucide-react";
import { usePartnerActions, type WebhookTestResult } from "../../../entities/partners";
import { useCreateIntegration } from "../../../entities/integrations";
import { useIntegrationHealthcheck } from "../../../entities/integrations/healthcheck";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { Badge, Button, Card, EmptyState, PageHeader, type Tone } from "../../../shared/ui/primitives";
import ConnectionFields, { buildChangedPayload, type FieldValue, type FieldValues } from "../ConnectionFields";
import { findConnectionType, type ConnectionField, type ConnectionTypeMeta } from "../connections";
import { CopyValue, InlineAlert } from "../ui";
import { missingForReady } from "../useConnections";
import { outboundChecks, partnerChecks, type CheckState, type StepCheck } from "./steps";

/**
 * ULASH USTASI — to'rt qadam (maket `*-integrations-wizard`).
 *
 *   1. Nomi      — nima kerakligini aytadi, nom oladi
 *   2. Kalitlar  — ulanish qiymatlari, oxirida YOZUV YARATILADI
 *   3. Sinash    — qadamlab tekshiradi (manzil → aloqa → javob → imzo)
 *   4. Tayyor    — kalit va keyingi qadamlar
 *
 * ⚠️ YOZUV NEGA 2-QADAMDAN KEYIN YARATILADI, 1-dan keyin emas. Sinash uchun yozuv mavjud bo'lishi SHART
 * (`webhook-test` va `healthcheck` ikkisi ham `:id` talab qiladi). Lekin 1-qadamdan keyin yaratish YOMON
 * bo'lardi: hamkor yaratilishi bilan API kalit tug'iladi — nom yozib chiqib ketgan odam ortida EGASIZ,
 * lekin FAOL kalit qolardi.
 *
 * ⚠️ KALIT 3-QADAMDA KO'RSATILADI, 4-da emas: kalit faqat BIR MARTA qaytadi. Uni oxirgi qadamga qoldirsak,
 * 3-qadamda brauzer yopilgan odam kalitni butunlay yo'qotardi.
 *
 * ⚠️ 3-qadamdan keyin «Orqaga» YO'Q: yozuv allaqachon yaratilgan, «Kalitlar»ga qaytish yangi yozuv yaratardi.
 */

const STEP_KEYS = ["console.wzStepName", "console.wzStepKeys", "console.wzStepTest", "console.wzStepDone"] as const;

/** Sinov natijasi → badge (maket: «O'tdi» · «Xato» · «O'tkazildi»). */
const STATE_BADGE: Record<CheckState, { tone: Tone; labelKey: string }> = {
  ok: { tone: "success", labelKey: "console.chkPassed" },
  fail: { tone: "danger", labelKey: "console.chkFailed" },
  warn: { tone: "warning", labelKey: "console.chkWarn" },
  skip: { tone: "neutral", labelKey: "console.chkSkipped" },
};

/** Konsoldagi scope (orqaga havola va «Konsolda ochish» uchun). */
const scopeOf = (type: ConnectionTypeMeta) =>
  type.kind === "partner" ? "partner" : type.category === "marketplace" ? "marketplace" : "external";

const SCOPE_LABEL = { partner: "navPartners", external: "navExternal", marketplace: "navMarketplace" } as const;

/** 1-qadamda majburiy maydon — «Davom etish» nomsiz o'chiq (`nameOk`). */
const REQUIRED_STEP1 = ["name"] as const;

/** Qadamlar paneli: desktopda chiziq bilan 4 ustun, telefonda ro'yxat. */
const StepsBar = ({ step, done }: { step: number; done: Array<string | null> }) => {
  const { t } = useTranslation("integrations");
  return (
    <Card padding="md" aria-label={t("console.wzStepsAria")}>
      <ol className="flex min-w-0 gap-3 max-md:flex-col max-md:gap-2">
        {STEP_KEYS.map((key, index) => {
          const n = index + 1;
          const isDone = n < step;
          const isCurrent = n === step;
          return (
            <li
              key={key}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 md:[&:not(:last-child)]:after:h-px md:[&:not(:last-child)]:after:min-w-6 md:[&:not(:last-child)]:after:flex-1 md:[&:not(:last-child)]:after:bg-border md:[&:not(:last-child)]:after:content-['']"
            >
              <span
                className={cx(
                  "inline-flex size-8 flex-none items-center justify-center rounded-full text-sm font-bold",
                  isDone ? "bg-success-soft text-success-fg" : isCurrent ? "bg-action text-on-solid" : "bg-sunken text-text-muted",
                )}
              >
                {isDone ? <Check size={16} aria-hidden="true" /> : n}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cx("text-[13px] font-semibold", isCurrent || isDone ? "text-text" : "text-text-muted")}>
                  <span className="max-md:hidden">{t("console.wzStepN", { n })} · </span>
                  {t(key)}
                  {isDone ? <span className="md:hidden"> — {t("console.wzStepDoneWord")}</span> : null}
                </span>
                {isDone && done[index] ? <span className="truncate text-xs text-text-muted">{done[index]}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

const ConnectWizard = () => {
  const { t } = useTranslation("integrations");
  const { typeKey } = useParams();
  const navigate = useNavigate();
  const type = useMemo(() => findConnectionType(String(typeKey ?? "")), [typeKey]);

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FieldValues>({});
  const [error, setError] = useState<string | null>(null);
  /** Yaratilgan yozuv — 2-qadamdan keyin to'ldiriladi. */
  const [created, setCreated] = useState<{ id: string; apiKey?: string } | null>(null);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [outboundResult, setOutboundResult] = useState<{ ok?: boolean; status?: number; response_time_ms?: number } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const { createPartner, testWebhook } = usePartnerActions();
  const createIntegration = useCreateIntegration();
  const healthcheck = useIntegrationHealthcheck();

  /**
   * YETISHMAYOTGAN SOZLAMALAR — ro'yxatdagi karta bilan AYNI qoidadan (`missingForReady`).
   * ⚠️ HOOK ERTA `return` DAN YUQORIDA turishi SHART. ⚠️ `has_webhook_secret` — server bayrog'i, ustada
   * u yo'q: operator sekretni shu formada kiritgan bo'lsa, uni «sozlangan» deb hisoblaymiz.
   */
  const gaps = useMemo(
    () =>
      type
        ? missingForReady({
            kind: type.kind === "partner" ? "partner" : "integration",
            role: type.role,
            raw: { ...values, has_webhook_secret: Boolean(String(values.webhook_secret ?? "").trim()) },
          })
        : [],
    [type, values],
  );

  /**
   * API kalit ko'chirib olinganini operator TASDIQLADIMI. ⚠️ Kalit javobda BIR MARTA keladi — qayta
   * ko'rsatish IMKONSIZ. «Yakunlash» shu belgigacha o'chirilgan turadi.
   */
  const [keyCopied, setKeyCopied] = useState(false);

  if (!type) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader back="/integrations/new" backLabel={t("newConnection")} title={t("newConnection")} />
        <Card padding="none">
          <EmptyState
            icon={CircleX}
            title={t("console.wzUnknownType")}
            action={
              <Button variant="secondary" onClick={() => navigate("/integrations/new")}>
                {t("console.wzBackToCatalog")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const isPartner = type.kind === "partner";
  const scope = scopeOf(type);
  /** 1-qadamda faqat kimlik maydonlari — qolgani 2-qadamda. */
  const identityKeys = isPartner ? ["name"] : ["name", "slug"];
  const step1Fields = type.fields.filter((f) => identityKeys.includes(f.key));
  const step2Fields = type.fields.filter((f) => !identityKeys.includes(f.key));

  const change = (key: string, value: FieldValue) => setValues((v) => ({ ...v, [key]: value }));

  const nameOk = String(values.name ?? "").trim().length > 0;
  const urlValue = String((isPartner ? values.webhook_url : values.base_url) ?? "");

  /** 2-qadam → yozuv yaratiladi va 3-qadamga o'tiladi. */
  const createRecord = async () => {
    setError(null);
    const payload = buildChangedPayload(type.fields, values, {});
    try {
      if (isPartner) {
        const res = await createPartner.mutateAsync(payload as never);
        if (!String(res.id ?? "").trim()) {
          /** ⚠️ Hamkor yo'lida `api_key` javobda BIR MARTA keladi — id bo'lmasa kalitni xabarda qaytaramiz. */
          setError(t("wzPartnerNoId", { key: res.api_key ?? t("wzKeyMissing") }));
          return;
        }
        setCreated({ id: String(res.id), apiKey: res.api_key || undefined });
      } else {
        /**
         * ⚠️ Backend `type`, `credentials` va `status` ni MAJBURIY deb biladi (`CreateIntegrationRequestDto`).
         * `role`/`category` registrdan: taksonomiya to'ldirilmasa ulanish ro'yxatda noto'g'ri guruhga tushardi.
         */
        const res = await createIntegration.mutateAsync({
          ...payload,
          type: "api",
          status: "active",
          credentials: {},
          role: type.role,
          category: type.category,
        } as never);
        const id =
          (res as { data?: { data?: { id?: string }; id?: string } })?.data?.data?.id ??
          (res as { data?: { id?: string } })?.data?.id ??
          "";
        /** ⚠️ ID BO'SH BO'LSA TO'XTAYMIZ: «Sinash» ishlamas, «Konsolda ochish» begona ulanishni ochardi. */
        if (!String(id).trim()) {
          setError(t("wzConnNoId"));
          return;
        }
        setCreated({ id: String(id) });
      }
      setStep(3);
    } catch (err) {
      setError(getBackendErrorMessage(err) || t("wzCreateFailed"));
    }
  };

  const runTest = async () => {
    setTestError(null);
    setTestResult(null);
    setOutboundResult(null);
    /** ⚠️ Ilgari bu yerda jimgina `return` bor edi — endi holat AYTILADI. */
    if (!created?.id) {
      setTestError(t("wzTestNoId"));
      return;
    }
    try {
      if (isPartner) {
        setTestResult(await testWebhook.mutateAsync({ id: created.id, url: urlValue.trim() || undefined }));
      } else {
        const res = await healthcheck.mutateAsync(created.id);
        setOutboundResult({ ok: res.ok, status: res.status ?? undefined, response_time_ms: res.response_time_ms ?? undefined });
        // Backend yiqilganda HTTP xato BERMAYDI — sababni shu yerdan olamiz.
        if (!res.ok && res.message) setTestError(res.message);
      }
    } catch (err) {
      setTestError(getBackendErrorMessage(err) || t("wzTestFailed"));
    }
  };

  const checks: StepCheck[] = isPartner ? partnerChecks(urlValue, testResult) : outboundChecks(urlValue, outboundResult, testError);
  const testing = testWebhook.isPending || healthcheck.isPending;
  const creating = createPartner.isPending || createIntegration.isPending;
  const tested = Boolean(testResult || outboundResult || testError);

  const footer = (children: ReactNode, note?: ReactNode) => (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <span className="min-w-0 flex-[1_1_240px] text-xs text-text-muted">{note}</span>
      <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-1">{children}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={`/integrations/connections?scope=${scope}`}
        backLabel={t(SCOPE_LABEL[scope])}
        title={t("console.wzTitle", { name: t(type.labelKey) })}
        description={t(isPartner ? "console.wzSubPartner" : "console.wzSubOutbound")}
      />

      <StepsBar
        step={step}
        done={[String(values.name ?? "") || null, created ? t("console.wzCreatedShort") : null, tested ? t("console.wzTestedShort") : null, null]}
      />

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {/* ═══ 1. NOMI ═══ */}
      {step === 1 ? (
        <Card
          footer={footer(
            <Button disabled={!nameOk} onClick={() => setStep(2)}>
              {t("console.wzContinue")}
            </Button>,
            nameOk ? null : t("console.wzNameNeeded"),
          )}
        >
          <div className="flex flex-col gap-4">
            <InlineAlert tone="info" title={t("wzPrereqTitle")}>
              <ul className="mt-1 flex flex-col gap-1">
                {type.prereqKeys.map((item: string) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={16} aria-hidden="true" className="mt-px flex-none text-text-subtle" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            </InlineAlert>
            <ConnectionFields fields={step1Fields} values={values} onChange={change} requiredKeys={REQUIRED_STEP1} />
          </div>
        </Card>
      ) : null}

      {/* ═══ 2. KALITLAR ═══ */}
      {step === 2 ? (
        <Card
          footer={footer(
            <>
              <Button variant="ghost" disabled={creating} onClick={() => setStep(1)}>
                {t("console.wzBack")}
              </Button>
              <Button loading={creating} onClick={() => void createRecord()}>
                {t("wzCreateBtn")}
              </Button>
            </>,
          )}
        >
          <div className="flex flex-col gap-4">
            <ConnectionFields fields={step2Fields as ConnectionField[]} values={values} onChange={change} disabled={creating} />
            {/* Nima bo'lishini OLDIN aytamiz — kalit bir marta ko'rsatiladi. */}
            <InlineAlert tone="warning">{isPartner ? t("wzCreateWarnPartner") : t("wzCreateWarnOutbound")}</InlineAlert>
          </div>
        </Card>
      ) : null}

      {/* ═══ 3. SINASH ═══ */}
      {step === 3 ? (
        <Card
          title={t("wzCheckTitle")}
          description={t(isPartner ? "console.wzCheckSubPartner" : "console.wzCheckSubOutbound")}
          actions={
            <Button variant="secondary" leftIcon={RefreshCw} loading={testing} onClick={() => void runTest()} className="max-md:min-h-11">
              {tested ? t("wzRetest") : t("wzTest")}
            </Button>
          }
          footer={footer(
            /*
              Sinov MUVAFFAQIYATSIZ bo'lsa ham davom etishga ruxsat beramiz: ulanish allaqachon yaratilgan.
              To'sib qo'ysak, odam ustadan chiqib ketardi va yozuv yarim holatda qolardi.
            */
            <Button disabled={Boolean(created?.apiKey) && !keyCopied} onClick={() => setStep(4)}>
              {t("console.wzFinish")}
            </Button>,
            Boolean(created?.apiKey) && !keyCopied ? (
              <span className="font-semibold text-warning-fg">{t("console.wzConfirmKeyFirst")}</span>
            ) : (
              t("console.wzContinueAnyway")
            ),
          )}
        >
          <div className="flex flex-col gap-4">
            {/* Kalit — DARHOL, 4-qadamni kutmasdan. */}
            {created?.apiKey ? (
              <InlineAlert tone="success" title={t("wzFreshKey")}>
                <span className="mt-2 flex flex-col gap-2">
                  {/* Nusxa olish TASDIQ sifatida ham hisoblanadi — operator bir narsani ikki marta bildirmasin. */}
                  <CopyValue value={created.apiKey} onCopied={() => setKeyCopied(true)} />
                  {/*
                    ⚠️ TASDIQ MAJBURIY. Kalit qayta ko'rsatilmaydi, shu bois «Yakunlash» shu belgigacha o'chirilgan.
                  */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-text">
                    <input
                      type="checkbox"
                      className="size-[18px] accent-action"
                      checked={keyCopied}
                      onChange={(e) => setKeyCopied(e.target.checked)}
                    />
                    {t("npKeyCopiedConfirm")}
                  </label>
                </span>
              </InlineAlert>
            ) : null}

            <ul aria-label={t("wzCheckTitle")} className="flex flex-col">
              {checks.map((c) => {
                const badge = STATE_BADGE[c.state];
                return (
                  <li key={c.labelKey} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-text">{t(c.labelKey)}</span>
                      <span className="[overflow-wrap:anywhere] text-[13px] text-text-muted">{t(c.detailKey, c.detailParams)}</span>
                    </span>
                    <Badge tone={badge.tone} dot={c.state !== "skip"}>
                      {t(badge.labelKey)}
                    </Badge>
                  </li>
                );
              })}
            </ul>

            {/* Javob tanasi MUHIM: 200 qaytarib «imzo yaroqsiz» deyish mumkin. */}
            {testResult?.response_body ? (
              <p className="break-all rounded-[10px] bg-sunken px-3 py-2 text-xs text-text-muted">
                {t("wzResponse", { body: testResult.response_body.slice(0, 300) })}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ═══ 4. TAYYOR ═══ */}
      {step === 4 ? (
        <Card
          footer={footer(
            <>
              <Button variant="secondary" onClick={() => navigate("/integrations")}>
                {t("wzToList")}
              </Button>
              <Button
                onClick={() =>
                  navigate(
                    `/integrations/connections?c=${encodeURIComponent(`${isPartner ? "partner" : "integration"}:${created?.id ?? ""}`)}`,
                  )
                }
              >
                {t("wzOpenConsole")}
              </Button>
            </>,
          )}
        >
          <div className="flex flex-col gap-4">
            {/*
              ⚠️ IKKI EKRAN AYNI GAPNI AYTISHI SHART: ro'yxatdagi karta va usta ikkalasi ham `missingForReady`
              dan — karta holatni, usta esa YETISHMAGAN NARSALAR ro'yxatini ko'rsatadi.
            */}
            {gaps.length === 0 ? (
              <InlineAlert tone="success" title={t("wzReady")}>
                {t("wzReadyDesc", { name: String(values.name ?? "") })}
              </InlineAlert>
            ) : (
              <InlineAlert tone="warning" title={t("wzNotReady")}>
                {t("wzNotReadyDesc", { name: String(values.name ?? "") })}
                <ul className="mt-1.5 list-disc pl-5">
                  {gaps.map((g: string) => (
                    <li key={g}>{t(g)}</li>
                  ))}
                </ul>
              </InlineAlert>
            )}

            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">{t("wzNextSteps")}</h2>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-[18px] text-text">
                {isPartner ? (
                  <>
                    <li>{t("wzNextPartner1")}</li>
                    <li>
                      {t("wzNextPartner2a")} <code className="font-mono">X-Api-Key</code> {t("wzNextPartner2b")}
                    </li>
                    <li>{t("wzNextPartner3")}</li>
                    <li>{t("wzNextPartner4")}</li>
                  </>
                ) : (
                  <>
                    <li>{t("wzNextOut1")}</li>
                    <li>{t("wzNextOut2")}</li>
                    <li>{t("wzNextOut3")}</li>
                  </>
                )}
              </ol>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

export default ConnectWizard;
