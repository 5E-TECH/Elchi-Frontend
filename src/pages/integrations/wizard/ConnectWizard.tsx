import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  Info,
  Loader2,
  MinusCircle,
  RotateCw,
  XCircle,
} from 'lucide-react';
import { usePartnerActions, type WebhookTestResult } from '../../../entities/partners';
import { useCreateIntegration } from '../../../entities/integrations';
import { useIntegrationHealthcheck } from '../../../entities/integrations/healthcheck';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import ConnectionFields, {
  buildChangedPayload,
  type FieldValues,
} from '../ConnectionFields';
import { findConnectionType, type ConnectionField } from '../connections';
import { outboundChecks, partnerChecks, type CheckState, type StepCheck } from './steps';

/**
 * ULASH USTASI — to'rt qadam.
 *
 *   1. Nomi      — nima kerakligini aytadi, nom oladi
 *   2. Kalitlar  — ulanish qiymatlari, oxirida YOZUV YARATILADI
 *   3. Sinash    — qadamlab tekshiradi (manzil → aloqa → javob → imzo)
 *   4. Tayyor    — kalit va keyingi qadamlar
 *
 * ⚠️ YOZUV NEGA 2-QADAMDAN KEYIN YARATILADI, 1-dan keyin emas.
 *
 * Sinash uchun yozuv mavjud bo'lishi SHART — `webhook-test` va
 * `healthcheck` ikkisi ham `:id` talab qiladi. Demak yaratish sinashdan
 * oldin bo'lishi kerak.
 *
 * Lekin 1-qadamdan keyin yaratish YOMON bo'lardi: hamkor yaratilishi bilan
 * API kalit tug'iladi. Nom yozib chiqib ketgan odam ortida EGASIZ, lekin
 * FAOL kalit qolardi — buni hech kim bilmaydi va hech kim o'chirmaydi.
 * Shuning uchun yozuv haqiqiy qiymatlar kiritilgandan keyin tug'iladi.
 *
 * ⚠️ KALIT 3-QADAMDA KO'RSATILADI, 4-da emas (garchi "Tayyor" mantiqiyroq
 * tuyulsa ham). Kalit faqat BIR MARTA qaytadi va boshqa olinmaydi. Uni
 * oxirgi qadamga qoldirsak, 3-qadamda brauzer yopilgan odam kalitni
 * butunlay yo'qotardi va rotatsiya qilishga majbur bo'lardi.
 */

const STEP_LABELS = ['Nomi', 'Kalitlar', 'Sinash', 'Tayyor'];

const STATE_ICON: Record<CheckState, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  fail: <XCircle className="h-4 w-4 text-red-600" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  skip: <MinusCircle className="h-4 w-4 text-[color:var(--color-text-muted)]" />,
};

const ConnectWizard = () => {
  const { typeKey } = useParams();
  const navigate = useNavigate();
  const type = useMemo(() => findConnectionType(String(typeKey ?? '')), [typeKey]);

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FieldValues>({});
  const [error, setError] = useState<string | null>(null);
  /** Yaratilgan yozuv — 2-qadamdan keyin to'ldiriladi. */
  const [created, setCreated] = useState<{ id: string; apiKey?: string } | null>(
    null,
  );
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [outboundResult, setOutboundResult] = useState<{
    ok?: boolean;
    status?: number;
    response_time_ms?: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { createPartner, testWebhook } = usePartnerActions();
  const createIntegration = useCreateIntegration();
  const healthcheck = useIntegrationHealthcheck();

  if (!type) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <p className="m-0 text-sm font-bold text-amber-700 dark:text-amber-300">
          Bunday ulanish turi yo'q
        </p>
        <button
          type="button"
          onClick={() => navigate('/integrations/new')}
          className="mt-3 rounded-xl border border-main px-4 py-2 text-xs font-bold text-main"
        >
          Katalogga qaytish
        </button>
      </div>
    );
  }

  const isPartner = type.kind === 'partner';
  /** 1-qadamda faqat kimlik maydonlari — qolgani 2-qadamda. */
  const identityKeys = isPartner ? ['name'] : ['name', 'slug'];
  const step1Fields = type.fields.filter((f) => identityKeys.includes(f.key));
  const step2Fields = type.fields.filter((f) => !identityKeys.includes(f.key));

  const change = (key: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const nameOk = String(values.name ?? '').trim().length > 0;
  const urlValue = String(
    (isPartner ? values.webhook_url : values.base_url) ?? '',
  );

  /** 2-qadam → yozuv yaratiladi va 3-qadamga o'tiladi. */
  const createRecord = async () => {
    setError(null);
    const payload = buildChangedPayload(type.fields, values, {});
    try {
      if (isPartner) {
        const res = await createPartner.mutateAsync(payload as never);
        setCreated({ id: String(res.id), apiKey: res.api_key || undefined });
      } else {
        /**
         * ⚠️ Backend `type`, `credentials` va `status` ni MAJBURIY deb
         * biladi (`CreateIntegrationRequestDto`). Ularni yubormasak 400
         * qaytadi — forma esa faqat "nimadir xato" deb ko'rsatardi.
         * `role`/`category` registrdan olinadi: taksonomiya shu yerda
         * to'ldirilmasa, ulanish ro'yxatda noto'g'ri guruhga tushardi.
         */
        const res = await createIntegration.mutateAsync({
          ...payload,
          type: 'api',
          status: 'active',
          credentials: {},
          role: type.role,
          category: type.category,
        } as never);
        const id =
          (res as { data?: { data?: { id?: string }; id?: string } })?.data?.data
            ?.id ??
          (res as { data?: { id?: string } })?.data?.id ??
          '';
        setCreated({ id: String(id) });
      }
      setStep(3);
    } catch (err) {
      setError(getBackendErrorMessage(err) || "Yaratib bo'lmadi");
    }
  };

  const runTest = async () => {
    setTestError(null);
    setTestResult(null);
    setOutboundResult(null);
    if (!created?.id) return;
    try {
      if (isPartner) {
        setTestResult(
          await testWebhook.mutateAsync({
            id: created.id,
            url: urlValue.trim() || undefined,
          }),
        );
      } else {
        const res = await healthcheck.mutateAsync(created.id);
        setOutboundResult({
          ok: res.ok,
          status: res.status ?? undefined,
          response_time_ms: res.response_time_ms ?? undefined,
        });
        // Backend yiqilganda HTTP xato BERMAYDI — sababni shu yerdan olamiz.
        if (!res.ok && res.message) setTestError(res.message);
      }
    } catch (err) {
      setTestError(getBackendErrorMessage(err) || 'Sinab bo‘lmadi');
    }
  };

  const checks: StepCheck[] = isPartner
    ? partnerChecks(urlValue, testResult)
    : outboundChecks(urlValue, outboundResult, testError);

  const testing = testWebhook.isPending || healthcheck.isPending;
  const creating = createPartner.isPending || createIntegration.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ═══ Sarlavha + qadam ko'rsatkichi ═══ */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? navigate('/integrations/new') : setStep(step - 1))}
          /* 3-qadamdan keyin ortga qaytish YO'Q: yozuv allaqachon yaratilgan,
             "Kalitlar"ga qaytish yangi yozuv yaratardi. */
          disabled={step >= 3}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--color-border-soft)] text-maindark disabled:opacity-30 dark:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-base font-extrabold text-maindark dark:text-white">
            {type.label}
          </h1>
          <p className="m-0 text-[11px] text-[color:var(--color-text-muted)]">
            {isPartner ? 'Ular bizga ulanadi' : 'Biz ularga ulanamiz'}
          </p>
        </div>
      </div>

      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const now = n === step;
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  now
                    ? 'bg-main text-white'
                    : done
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : 'bg-maindark/5 text-[color:var(--color-text-muted)] dark:bg-white/5'
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {n}. {label}
              </span>
              {n < STEP_LABELS.length && (
                <ChevronRight className="h-3 w-3 text-[color:var(--color-text-muted)]" />
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ═══ 1. NOMI ═══ */}
      {step === 1 && (
        <div className="space-y-3">
          <section className="rounded-2xl border border-main/25 bg-main/[0.04] p-4">
            <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-extrabold text-main">
              <Info className="h-3.5 w-3.5" />
              Boshlashdan oldin quyidagilar tayyor bo'lsin
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {type.prereqs.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs leading-snug text-maindark dark:text-primary"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-main" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <Panel>
            <ConnectionFields
              fields={step1Fields}
              values={values}
              onChange={change}
            />
          </Panel>

          <Primary disabled={!nameOk} onClick={() => setStep(2)}>
            Davom etish
          </Primary>
          {!nameOk && (
            <p className="m-0 text-[11px] text-[color:var(--color-text-muted)]">
              Nom kerak — operator ro'yxatda shu nomni ko'radi.
            </p>
          )}
        </div>
      )}

      {/* ═══ 2. KALITLAR ═══ */}
      {step === 2 && (
        <div className="space-y-3">
          <Panel>
            <ConnectionFields
              fields={step2Fields as ConnectionField[]}
              values={values}
              onChange={change}
              disabled={creating}
            />
          </Panel>

          {/* Nima bo'lishini OLDIN aytamiz — kalit bir marta ko'rsatiladi. */}
          <p className="m-0 rounded-xl border border-[color:var(--color-border-soft)] px-3.5 py-2.5 text-[11px] text-[color:var(--color-text-muted)]">
            {isPartner
              ? "Bosganingizda ulanish yaratiladi va API kalit BIR MARTA ko'rsatiladi — keyin uni qayta olish mumkin emas."
              : 'Bosganingizda ulanish yaratiladi, so‘ng aloqani sinab ko‘ramiz.'}
          </p>

          <Primary disabled={creating} onClick={createRecord}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Yaratish va sinashga o'tish
          </Primary>
        </div>
      )}

      {/* ═══ 3. SINASH ═══ */}
      {step === 3 && (
        <div className="space-y-3">
          {/* Kalit — DARHOL, 4-qadamni kutmasdan. */}
          {created?.apiKey && (
            <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="m-0 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                API kalit — HOZIR ko'chirib oling, boshqa ko'rsatilmaydi
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-maindark dark:bg-black/30 dark:text-white">
                  {created.apiKey}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(created.apiKey!);
                    setCopied(true);
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-600 px-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Ko'chirildi" : "Ko'chirish"}
                </button>
              </div>
            </section>
          )}

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-extrabold text-maindark dark:text-white">
                Ulanishni tekshirish
              </p>
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-main px-3 text-xs font-bold text-main disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                {testResult || outboundResult || testError ? 'Qayta sinash' : 'Sinash'}
              </button>
            </div>

            <div className="mt-3 divide-y divide-[color:var(--color-border-soft)]">
              {checks.map((c) => (
                <div key={c.label} className="flex items-start gap-2.5 py-2.5">
                  <span className="mt-0.5 shrink-0">{STATE_ICON[c.state]}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-maindark dark:text-white">
                      {c.label}
                    </span>
                    <span className="block break-all text-[11px] text-[color:var(--color-text-muted)]">
                      {c.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {/* Javob tanasi MUHIM: 200 qaytarib "imzo yaroqsiz" deyish mumkin. */}
            {testResult?.response_body && (
              <p className="m-0 mt-2 break-all rounded-lg bg-maindark/[0.03] px-3 py-2 text-[11px] text-[color:var(--color-text-muted)] dark:bg-white/[0.04]">
                Javob: {testResult.response_body.slice(0, 300)}
              </p>
            )}
          </Panel>

          {/*
            Sinov MUVAFFAQIYATSIZ bo'lsa ham davom etishga ruxsat beramiz:
            hamkor tomonda manzil hali tayyor bo'lmasligi mumkin va ulanish
            allaqachon yaratilgan. To'sib qo'ysak, odam ustadan chiqib
            ketardi va yozuv yarim holatda qolardi.
          */}
          <Primary onClick={() => setStep(4)}>Yakunlash</Primary>
        </div>
      )}

      {/* ═══ 4. TAYYOR ═══ */}
      {step === 4 && (
        <div className="space-y-3">
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="m-0 flex items-center gap-2 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Ulanish yaratildi
            </p>
            <p className="m-0 mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {String(values.name ?? '')} — endi Konsolda sozlash va kuzatish
              mumkin.
            </p>
          </section>

          <Panel>
            <p className="m-0 mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
              Keyingi qadamlar
            </p>
            <ol className="m-0 space-y-2 pl-5 text-xs leading-snug text-maindark dark:text-primary">
              {isPartner ? (
                <>
                  <li>API kalitni hamkorga XAVFSIZ kanal orqali yetkazing.</li>
                  <li>
                    Ular so'rovni <code>X-Api-Key</code> sarlavhasi bilan
                    yuboradi.
                  </li>
                  <li>
                    Webhook manzili hali tayyor bo'lmasa, hodisalar navbatda
                    kutadi — manzil qo'yilganda avtomatik yuboriladi.
                  </li>
                  <li>
                    IP cheklovini Konsol → Xavfsizlik bo'limida qo'shishingiz
                    mumkin.
                  </li>
                </>
              ) : (
                <>
                  <li>Konsol → Hodisalar bo'limida birinchi sinxronni kuzating.</li>
                  <li>
                    Xato chiqsa, javob matni shu yerda ko'rinadi — kalit yoki
                    manzil xatosi darhol bilinadi.
                  </li>
                  <li>
                    Kalitni almashtirish kerak bo'lsa, Konsol → Xavfsizlik.
                  </li>
                </>
              )}
            </ol>
          </Panel>

          <div className="flex flex-wrap gap-2">
            <Primary
              onClick={() =>
                navigate(
                  `/integrations/connections?c=${encodeURIComponent(
                    `${isPartner ? 'partner' : 'integration'}:${created?.id ?? ''}`,
                  )}`,
                )
              }
            >
              Konsolda ochish
            </Primary>
            <button
              type="button"
              onClick={() => navigate('/integrations')}
              className="h-11 rounded-xl border border-[color:var(--color-border-soft)] px-4 text-sm font-bold text-maindark dark:text-white"
            >
              Manzaraga
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 dark:bg-primarydark">
    {children}
  </div>
);

const Primary = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-main px-5 text-sm font-bold text-white disabled:opacity-50"
  >
    {children}
  </button>
);

export default ConnectWizard;
