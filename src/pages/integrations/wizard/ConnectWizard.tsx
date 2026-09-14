import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { Alert, Checkbox, Button, Card, Form, Steps, Typography } from "antd";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Info,
  MinusCircle,
  RotateCw,
  XCircle,
} from "lucide-react";
import { usePartnerActions, type WebhookTestResult } from "../../../entities/partners";
import { useCreateIntegration } from "../../../entities/integrations";
import { useIntegrationHealthcheck } from "../../../entities/integrations/healthcheck";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import ConnectionFields, {
  buildChangedPayload,
  type FieldValue,
  type FieldValues,
} from "../ConnectionFields";
import { findConnectionType, type ConnectionField } from "../connections";
import { missingForReady } from "../useConnections";
import { outboundChecks, partnerChecks, type CheckState, type StepCheck } from "./steps";

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

const STEP_LABELS = ["Nomi", "Kalitlar", "Sinash", "Tayyor"];

/**
 * ⚠️ HAR BIR RANGDA `dark:` JUFTLIGI BOR. Ilgari faqat `skip` da bor edi,
 * qolgan uchtasida unutilgan — ya'ni qorong'i yuzada (`#3A3358`) to'q
 * `-600` tuslari deyarli ko'rinmasdi. Bu ikonkalar ustaning sinov
 * natijasini ko'rsatadi, ya'ni operator "o'tdimi yoki yiqildimi" degan
 * savolga javobni aynan shu yerdan oladi.
 */
const STATE_ICON: Record<CheckState, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  fail: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  skip: <MinusCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />,
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
  const [outboundResult, setOutboundResult] = useState<{
    ok?: boolean;
    status?: number;
    response_time_ms?: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const { createPartner, testWebhook } = usePartnerActions();
  const createIntegration = useCreateIntegration();
  const healthcheck = useIntegrationHealthcheck();

  /**
   * YETISHMAYOTGAN SOZLAMALAR — ro'yxatdagi karta bilan AYNI qoidadan.
   *
   * `missingForReady` `useConnections` da yashaydi va `isConfigured` ham
   * o'shanga tayanadi. Shu bois usta bilan karta bir xil gapiradi.
   *
   * ⚠️ HOOK ERTA `return` DAN YUQORIDA turishi SHART (`if (!type)`).
   * Shu bois `type` yo'q holati ham shu yerda hisobga olinadi — hooklar
   * shartli chaqirilsa React tartibni yo'qotadi.
   *
   * ⚠️ `has_webhook_secret` — server bayrog'i, ustada u yo'q. Operator
   * sekretni shu formada kiritgan bo'lsa, uni "sozlangan" deb hisoblaymiz:
   * aks holda usta yangi yaratilgan ulanishni doim "sekret yo'q" deb
   * ko'rsatardi.
   */
  const gaps = useMemo(
    () =>
      type
        ? missingForReady({
            kind: type.kind === "partner" ? "partner" : "integration",
            role: type.role,
            raw: {
              ...values,
              has_webhook_secret: Boolean(String(values.webhook_secret ?? "").trim()),
            },
          })
        : [],
    [type, values],
  );

  /**
   * API kalit ko'chirib olinganini operator TASDIQLADIMI.
   *
   * ⚠️ NEGA KERAK. Kalit javobda BIR MARTA keladi va bazada faqat uning
   * hash'i saqlanadi — ya'ni qayta ko'rsatish IMKONSIZ. Ilgari "Yakunlash"
   * bosilishi bilan kalit ekrandan yo'qolardi va hech qanday ogohlantirish
   * yo'q edi: operator uni ko'chirmagan bo'lsa, hamkor integratsiyani
   * BOSHLAY OLMASDI va yechim faqat kalitni almashtirish bo'lardi.
   */
  const [keyCopied, setKeyCopied] = useState(false);

  if (!type) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <p className="m-0 text-sm font-bold text-amber-700 dark:text-amber-300">
          Bunday ulanish turi yo'q
        </p>
        <button
          type="button"
          onClick={() => navigate("/integrations/new")}
          className="mt-3 rounded-xl border border-indigo-500 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300"
        >
          Katalogga qaytish
        </button>
      </div>
    );
  }

  const isPartner = type.kind === "partner";
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
          /**
           * ⚠️ Hamkor yo'lida bu YANA xavfliroq: `api_key` javobda BIR
           * MARTA keladi. Id bo'lmasa kalitni ko'rsatib, keyin uni hech
           * qaysi ulanishga bog'lab bo'lmasdi.
           */
          setError(t("wzPartnerNoId", { key: res.api_key ?? t("wzKeyMissing") }));
          return;
        }
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
        /**
         * ⚠️ ID BO'SH BO'LSA TO'XTAYMIZ.
         *
         * Javob qobig'i marshrutga qarab bir-ikki qatlam bo'ladi va id
         * ajratib olinmasligi mumkin. Ilgari bunda ham 3-qadamga o'tilardi
         * va ikki narsa jimgina buzilardi:
         *
         *   • "Sinash" hech narsa qilmasdi (`if (!created?.id) return`) —
         *     tugma bosiladi, javob yo'q, sabab ko'rinmaydi;
         *   • "Konsolda ochish" `partner:` (id'siz) manziliga o'tardi va
         *     BEGONA ulanish ochilardi — operator boshqa hamkorning
         *     sozlamasini tahrirlab yuborishi mumkin edi.
         *
         * Ulanish YARATILGAN, shu bois xabar buni aytadi va ro'yxatga
         * yuboradi — yana bir nusxa yaratilmasin.
         */
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
    /**
     * ⚠️ Ilgari bu yerda jimgina `return` bor edi: tugma bosiladi, hech
     * narsa bo'lmaydi, sabab ko'rinmaydi. Endi holat AYTILADI.
     * (Yaratish darvozasi tufayli bu holat deyarli yuzaga kelmaydi, lekin
     * jim qolish hech qachon to'g'ri javob emas.)
     */
    if (!created?.id) {
      setTestError(t("wzTestNoId"));
      return;
    }
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
      setTestError(getBackendErrorMessage(err) || t("wzTestFailed"));
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
        {/* 3-qadamdan keyin ortga qaytish YO'Q: yozuv allaqachon yaratilgan,
            "Kalitlar"ga qaytish yangi yozuv yaratardi. */}
        <Button
          icon={<ArrowLeft className="h-4 w-4" />}
          disabled={step >= 3}
          onClick={() => (step === 1 ? navigate("/integrations/new") : setStep(step - 1))}
        />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-base font-extrabold text-gray-800 dark:text-white">
            {t(type.labelKey)}
          </h1>
          <p className="m-0 text-[11px] text-gray-500 dark:text-gray-400">
            {isPartner ? "Ular bizga ulanadi" : "Biz ularga ulanamiz"}
          </p>
        </div>
      </div>

      {/*
        antd `Steps` — PCS ham ko'p qadamli oqimlarda shu komponentni
        ishlatadi. Qo'lda yasalgan chip qatoridan afzalligi: bajarilgan
        qadam avtomatik belgilanadi va mobil ekranda o'zi siqiladi.
      */}
      <Steps
        size="small"
        current={step - 1}
        items={STEP_LABELS.map((label) => ({ title: label }))}
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ═══ 1. NOMI ═══ */}
      {step === 1 && (
        <div className="space-y-3">
          <Alert
            type="info"
            showIcon
            icon={<Info className="h-4 w-4" />}
            message={t("wzPrereqTitle")}
            description={
              <ul className="m-0 list-none space-y-1.5 p-0">
                {type.prereqKeys.map((item: string) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-snug">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            }
          />

          <Panel>
            <Form layout="vertical">
              <ConnectionFields fields={step1Fields} values={values} onChange={change} />
            </Form>
          </Panel>

          <Primary disabled={!nameOk} onClick={() => setStep(2)}>
            Davom etish
          </Primary>
          {!nameOk && (
            <p className="m-0 text-[11px] text-gray-500 dark:text-gray-400">
              Nom kerak — operator ro'yxatda shu nomni ko'radi.
            </p>
          )}
        </div>
      )}

      {/* ═══ 2. KALITLAR ═══ */}
      {step === 2 && (
        <div className="space-y-3">
          <Panel>
            {/*
              ⚠️ `Form` O'RAMASI SHART: `ConnectionFields` antd `Form.Item`
              chiqaradi va u Form konteksti bo'lmasa yorliq/izohni
              joylashtira olmaydi (antd ogohlantirish beradi).
            */}
            <Form layout="vertical">
              <ConnectionFields
                fields={step2Fields as ConnectionField[]}
                values={values}
                onChange={change}
                disabled={creating}
              />
            </Form>
          </Panel>

          {/* Nima bo'lishini OLDIN aytamiz — kalit bir marta ko'rsatiladi. */}
          <Alert
            type="warning"
            showIcon
            message={isPartner ? t("wzCreateWarnPartner") : t("wzCreateWarnOutbound")}
          />

          <Primary loading={creating} onClick={createRecord}>
            {t("wzCreateBtn")}
          </Primary>
        </div>
      )}

      {/* ═══ 3. SINASH ═══ */}
      {step === 3 && (
        <div className="space-y-3">
          {/* Kalit — DARHOL, 4-qadamni kutmasdan. */}
          {created?.apiKey && (
            <Alert
              type="success"
              showIcon
              message={t("wzFreshKey")}
              description={
                /*
                  antd `copyable` — o'z holatini o'zi boshqaradi ("ko'chirildi"
                  belgisi ham). Qo'lda yozilgan tugma va `copied` state kerak
                  emas edi.
                */
                <>
                  <Typography.Paragraph
                    copyable={{
                      text: created.apiKey!,
                      // Ko'chirish TASDIQ sifatida ham hisoblanadi — operator
                      // ikki marta bir narsani bildirmasin.
                      onCopy: () => setKeyCopied(true),
                    }}
                    className="!mb-0 !mt-1 break-all font-mono text-xs"
                  >
                    {created.apiKey}
                  </Typography.Paragraph>
                  {/*
                    ⚠️ TASDIQ MAJBURIY. Kalit qayta ko'rsatilmaydi, shu bois
                    "Yakunlash" shu belgigacha o'chirilgan turadi. Bu
                    to'sqinlik ATAYLAB: bir marta ko'rsatiladigan sirni
                    e'tibordan chetda qoldirish oqibati og'ir — hamkor
                    integratsiyani boshlay olmaydi.
                  */}
                  <Checkbox
                    checked={keyCopied}
                    onChange={(e: CheckboxChangeEvent) => setKeyCopied(e.target.checked)}
                    className="mt-2 text-xs"
                  >
                    Kalitni ko'chirib oldim va xavfsiz saqladim
                  </Checkbox>
                </>
              }
            />
          )}

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-extrabold text-gray-800 dark:text-white">
                {t("wzCheckTitle")}
              </p>
              <Button
                icon={<RotateCw className="h-3.5 w-3.5" />}
                loading={testing}
                onClick={runTest}
              >
                {testResult || outboundResult || testError ? t("wzRetest") : t("wzTest")}
              </Button>
            </div>

            <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
              {checks.map((c) => (
                <div key={c.labelKey} className="flex items-start gap-2.5 py-2.5">
                  <span className="mt-0.5 shrink-0">{STATE_ICON[c.state]}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-gray-800 dark:text-white">
                      {t(c.labelKey)}
                    </span>
                    <span className="block break-all text-[11px] text-gray-500 dark:text-gray-400">
                      {t(c.detailKey, c.detailParams)}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {/* Javob tanasi MUHIM: 200 qaytarib "imzo yaroqsiz" deyish mumkin. */}
            {testResult?.response_body && (
              <p className="m-0 mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                {t("wzResponse", { body: testResult.response_body.slice(0, 300) })}
              </p>
            )}
          </Panel>

          {/*
            Sinov MUVAFFAQIYATSIZ bo'lsa ham davom etishga ruxsat beramiz:
            hamkor tomonda manzil hali tayyor bo'lmasligi mumkin va ulanish
            allaqachon yaratilgan. To'sib qo'ysak, odam ustadan chiqib
            ketardi va yozuv yarim holatda qolardi.
          */}
          <Primary disabled={Boolean(created?.apiKey) && !keyCopied} onClick={() => setStep(4)}>
            Yakunlash
          </Primary>
          {Boolean(created?.apiKey) && !keyCopied && (
            <p className="m-0 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Davom etish uchun API kalitni ko'chirib olganingizni tasdiqlang — u boshqa
              ko'rsatilmaydi.
            </p>
          )}
        </div>
      )}

      {/* ═══ 4. TAYYOR ═══ */}
      {step === 4 && (
        <div className="space-y-3">
          {/*
            ⚠️ IKKI EKRAN AYNI GAPNI AYTISHI SHART.
            Ilgari bu yer HAR DOIM yashil "Ulanish yaratildi ... endi
            kuzatish mumkin" derdi, ro'yxatdagi karta esa AYNI ulanishni
            "E'tibor kerak" deb ko'rsatardi — operator qaysi biriga
            ishonishni bilmasdi va ustadan "tayyor" degan ishonch bilan
            chiqib ketardi.
            Endi ikkisi ham `missingForReady` dan kelib chiqadi: karta
            nuqtani, usta esa YETISHMAGAN NARSALAR ro'yxatini ko'rsatadi.
          */}
          {gaps.length === 0 ? (
            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="m-0 flex items-center gap-2 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {t("wzReady")}
              </p>
              <p className="m-0 mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                {t("wzReadyDesc", { name: String(values.name ?? "") })}
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="m-0 flex items-center gap-2 text-sm font-extrabold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {t("wzNotReady")}
              </p>
              <p className="m-0 mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
                {t("wzNotReadyDesc", { name: String(values.name ?? "") })}
              </p>
              <ul className="m-0 mt-2 space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-200">
                {gaps.map((g: string) => (
                  <li key={g}>{t(g)}</li>
                ))}
              </ul>
            </section>
          )}

          <Panel>
            <p className="m-0 mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              {t("wzNextSteps")}
            </p>
            <ol className="m-0 space-y-2 pl-5 text-xs leading-snug text-gray-700 dark:text-gray-200">
              {isPartner ? (
                <>
                  <li>{t("wzNextPartner1")}</li>
                  <li>
                    {t("wzNextPartner2a")} <code>X-Api-Key</code> {t("wzNextPartner2b")}
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
          </Panel>

          <div className="flex flex-wrap gap-2">
            <Primary
              onClick={() =>
                navigate(
                  `/integrations/connections?c=${encodeURIComponent(
                    `${isPartner ? "partner" : "integration"}:${created?.id ?? ""}`,
                  )}`,
                )
              }
            >
              {t("wzOpenConsole")}
            </Primary>
            <Button size="large" onClick={() => navigate("/integrations")}>
              {t("wzToList")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Panel — antd `Card`, PCS panellari bilan bir xil ko'rinish. */
const Panel = ({ children }: { children: React.ReactNode }) => <Card size="small">{children}</Card>;

const Primary = ({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <Button type="primary" size="large" onClick={onClick} disabled={disabled} loading={loading}>
    {children}
  </Button>
);

export default ConnectWizard;
