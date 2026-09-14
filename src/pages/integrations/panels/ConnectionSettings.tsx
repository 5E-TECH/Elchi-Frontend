import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, message } from "antd";
import { FlaskConical, PlugZap, Save, Shuffle } from "lucide-react";
import { usePartnerActions, type WebhookTestResult } from "../../../entities/partners";
import { useUpdateIntegration } from "../../../entities/integrations";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { useTranslation } from "react-i18next";
import ConnectionFields, { buildChangedPayload, type FieldValues } from "../ConnectionFields";
import { TYPE_CHANGE_FIELDS, fieldsInGroup, type ConnectionField } from "../connections";
import { getPath } from "../fieldPath";
import type { Connection } from "../useConnections";

/**
 * SOZLAMALAR — umumiy forma, turga qarab boshqa maydonlar.
 *
 * Shakl PCS `ElchiSettingsTab` dan: `Card` sarlavhasi ikonka bilan,
 * `extra` da yonma-yon amal tugmasi, ichida `Form layout="vertical"` va
 * ikki ustunli to'r.
 *
 * Panel HECH QANDAY maydonni o'zi bilmaydi — u `connections.ts` dagi
 * ro'yxatni chizadi va o'zgarganini saqlaydi. Yangi ulanish turi qo'shilsa
 * bu fayl O'ZGARMAYDI.
 */

/** Asl yozuvdan forma qiymatlarini yasaydi. */
const initialValues = (c: Connection, fields: ConnectionField[]): FieldValues => {
  const raw = c.raw as Record<string, unknown>;
  const out: FieldValues = {};

  for (const f of fields) {
    if (f.writeOnly) {
      /**
       * ⚠️ Sirlar BO'SH boshlanadi — server ularni qaytarmaydi (faqat
       * shifrlangan holda saqlanadi). Bo'sh qoldirilsa `buildChangedPayload`
       * ularni YUBORMAYDI, ya'ni ishlab turgan kalit saqlanadi.
       */
      out[f.key] = "";
      continue;
    }
    if (f.type === "switch") {
      out[f.key] = Boolean(getPath(raw, f.key));
      continue;
    }
    /**
     * Xarita (obyekt) — asl yozuvdan o'qiladi. Busiz maydon bo'sh boshlanib,
     * saqlashda mavjud xaritani O'CHIRIB yuborardi.
     */
    if (f.type === "mapping") {
      const val = getPath(raw, f.key);
      out[f.key] =
        val && typeof val === "object" && !Array.isArray(val)
          ? (val as Record<string, string>)
          : {};
      continue;
    }
    if (f.type === "tags") {
      const arr = getPath(raw, f.key);
      out[f.key] = Array.isArray(arr) ? (arr as string[]) : [];
      continue;
    }
    // `base_url` eski yozuvlarda `api_url` da bo'lishi mumkin.
    // ⚠️ `getPath` — kalit nuqtali bo'lishi mumkin
    // (`dispatch_config.endpoint`). Tekis o'qish bo'sh qaytarardi va
    // saqlashda mavjud sozlama o'chib ketardi.
    const fallback = f.key === "base_url" ? raw.api_url : undefined;
    out[f.key] = String(getPath(raw, f.key) ?? fallback ?? "");
  }
  return out;
};

const ConnectionSettings = ({
  connection,
  fields: allFields,
  onSaved,
}: {
  connection: Connection;
  fields: ConnectionField[];
  onSaved: () => void;
}) => {
  const { t } = useTranslation("integrations");
  /**
   * Faqat `connection` guruhi — kirishni cheklaydigan qiymatlar (IP ro'yxati,
   * kalitlar) Xavfsizlik tabida. Sababi: bu yerdagi tahrir oddiy, o'sha
   * yerdagisi esa ulanishni butunlay to'sib qo'yishi mumkin.
   */
  const fields = useMemo(() => fieldsInGroup(allFields, "connection"), [allFields]);
  /**
   * SANDBOX MAYDONLARI ALOHIDA KARTADA.
   *
   * ⚠️ NEGA. Ilgari ular asosiy webhook maydonlari ostida turardi:
   * "Webhook sekreti" va "Sandbox sekreti" — ikki AYNI ko'rinishdagi parol
   * maydoni yonma-yon. Foydalanuvchi shikoyati aynan shu: "sandbox va real
   * rejim bir biriga aralashib ketgan". Xato maydonga prodakshn sekretini
   * yozib qo'yish juda oson edi.
   */
  const sandboxFields = useMemo(() => fieldsInGroup(allFields, "sandbox"), [allFields]);
  /**
   * Boshlang'ich qiymatlar IKKI guruhdan birga yig'iladi — forma holati
   * yagona, kartalar esa faqat ko'rinish.
   */
  const initial = useMemo(
    () => initialValues(connection, [...fields, ...sandboxFields]),
    [connection, fields, sandboxFields],
  );

  const [values, setValues] = useState<FieldValues>(initial);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  // Ulanish almashsa forma qayta to'ldiriladi — aks holda oldingi
  // ulanishning qiymatlari qolib, xato yozuvga saqlanardi.
  useEffect(() => {
    setValues(initial);
    setTestResult(null);
  }, [initial]);

  const { updatePartner, testWebhook } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const saving = updatePartner.isPending || updateIntegration.isPending;
  const isPartner = connection.kind === "partner";

  const save = async () => {
    const payload = buildChangedPayload([...fields, ...sandboxFields], values, initial);
    if (!Object.keys(payload).length) {
      message.info(t("setNoChange"));
      return;
    }

    try {
      if (isPartner) {
        await updatePartner.mutateAsync({
          id: connection.id,
          dto: payload as never,
        });
      } else {
        /**
         * `external_integrations` yangilashda `slug` va `type` ni ham
         * kutadi (backend `Object.assign` qiladi), shuning uchun
         * o'zgarmagan bo'lsa ham mavjud qiymat uzatiladi — aks holda
         * tekshiruvlar yiqilardi.
         */
        const raw = connection.raw as Record<string, unknown>;
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: {
            slug: String(raw.slug ?? ""),
            type: String(raw.type ?? "api"),
            ...payload,
          } as never,
        });
      }
      message.success(t("savedOk"));
      onSaved();
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("saveFailed"));
    }
  };

  const runTest = async () => {
    setTestResult(null);
    try {
      setTestResult(
        await testWebhook.mutateAsync({
          id: connection.id,
          url: String(values.webhook_url ?? "").trim() || undefined,
        }),
      );
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("setTestFailed"));
    }
  };

  return (
    <div className="space-y-4">
      <Form layout="vertical">
        <Card
          title={
            <span className="flex items-center gap-2">
              <PlugZap className="h-4 w-4" /> {t("setConnValues")}
            </span>
          }
          extra={
            /*
              Sinov tugmasi FAQAT inbound ulanishda: biz ularga webhook
              yuboramiz, ya'ni sinash mumkin. Outbound'da teskarisi —
              so'rovni biz yuboramiz va uni sinash boshqa mexanizm
              (Umumiy holat → healthcheck).
            */
            isPartner ? (
              <Button
                icon={<PlugZap className="h-4 w-4" />}
                loading={testWebhook.isPending}
                disabled={!String(values.webhook_url ?? "").trim()}
                onClick={runTest}
                title={t("setTestTip")}
              >
                {t("setTestBtn")}
              </Button>
            ) : undefined
          }
        >
          <ConnectionFields
            fields={fields}
            values={values}
            onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
            disabled={saving}
          />

          <Button
            type="primary"
            icon={<Save className="h-4 w-4" />}
            loading={saving}
            onClick={save}
          >
            {t("common:save")}
          </Button>
        </Card>
      </Form>

      {/* ═══════ SANDBOX — ALOHIDA KARTA ═══════ */}
      {sandboxFields.length > 0 && (
        <Form layout="vertical">
          <Card
            title={
              <span className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> {t("setSandboxCard")}
              </span>
            }
          >
            {/*
              Banner ATAYLAB: operator "sinov" nima qilishini bilishi kerak.
              Eng ko'p uchraydigan tushunmovchilik — sandbox yoqilsa
              hodisalar sinov muhitiga KO'CHADI deb o'ylash. Aslida NUSXA
              ketadi, asosiy oqim o'zgarmaydi.
            */}
            <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
              Yoqilsa har hodisaning NUSXASI sinov manziliga ham yuboriladi. Asosiy yetkazish
              o'zgarmaydi va sinov xatosi unga ta'sir qilmaydi. Nusxa faqat BIRINCHI urinishda
              ketadi.
              <br />
              {/*
                ⚠️ SHARTLAR AYTILADI. Kalitni yoqib, sekretni bo'sh
                qoldirish backend'dan 400 oladi. Shartni formada
                aytmasak, operator xatoni faqat saqlashda ko'rardi va
                sababini taxmin qilishga majbur bo'lardi.
              */}
              <span className="font-normal">
                Yoqish uchun manzil VA alohida sandbox sekreti shart — prodakshn sekreti sinov
                muhitiga yuborilmaydi.
              </span>
            </div>

            <ConnectionFields
              fields={sandboxFields}
              values={values}
              onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
              disabled={saving}
            />

            <Button
              type="primary"
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={save}
            >
              {t("common:save")}
            </Button>
          </Card>
        </Form>
      )}

      {/* ═══════ TURINI O'ZGARTIRISH ═══════ */}
      {connection.kind === "integration" && (
        <TypeChangeCard connection={connection} onSaved={onSaved} />
      )}

      {testResult && (
        <Alert
          type={testResult.ok ? "success" : "error"}
          showIcon
          message={
            testResult.ok
              ? `Yetdi — HTTP ${testResult.http_status} (${testResult.duration_ms} ms)`
              : `Yetmadi${testResult.http_status ? ` — HTTP ${testResult.http_status}` : ""}`
          }
          description={
            <div className="space-y-1 text-xs">
              {/* Sekret sozlanmagan bo'lsa qabul qiluvchi imzoni tekshira
                  olmaydi — eng ko'p uchraydigan sabab. */}
              {!testResult.secret_configured && (
                <p className="m-0">
                  ⚠️ Webhook sekreti sozlanmagan — qabul qiluvchi imzoni tekshira olmaydi
                </p>
              )}
              {testResult.error && <p className="m-0 break-all">{testResult.error}</p>}
              {/* Javob tanasi MUHIM: qabul qiluvchi 200 qaytarib ham "imzo
                  yaroqsiz" deyishi mumkin. */}
              {testResult.response_body && (
                <p className="m-0 break-all opacity-80">
                  Javob: {testResult.response_body.slice(0, 200)}
                </p>
              )}
            </div>
          }
        />
      )}
    </div>
  );
};

/**
 * TURINI O'ZGARTIRISH — alohida, ogohlantirishli amal.
 *
 * NEGA ALOHIDA. Ilgari `role`/`category` oddiy maydon bo'lib asosiy formada
 * turardi va katalog tanlovini ma'nosizlantirdi: "Marketplace" kartasini
 * tanlab, ichida turni "Yetkazuvchi" ga o'zgartirish mumkin bo'lardi
 * (audit FE-05).
 *
 * Lekin butunlay olib tashlash ham xato: migratsiya mavjud yozuvlarga
 * sukut `carrier` qo'ygan va noto'g'ri tasniflangan ulanishni (Donoxon)
 * tuzatish kerak.
 *
 * ⚠️ TUR O'ZGARSA FORMA MAYDONLARI HAM O'ZGARADI — shuning uchun
 * ogohlantirish beriladi: har tur boshqa sozlama so'raydi va eski
 * qiymatlar o'z joyida qoladi, lekin ko'rinmay qolishi mumkin.
 */
const TypeChangeCard = ({
  connection,
  onSaved,
}: {
  connection: Connection;
  onSaved: () => void;
}) => {
  const { t } = useTranslation("integrations");
  const initial = useMemo(
    () => ({
      role: String((connection.raw as Record<string, unknown>).role ?? connection.role),
      category: String((connection.raw as Record<string, unknown>).category ?? connection.category),
    }),
    [connection],
  );
  const [values, setValues] = useState<FieldValues>(initial);
  useEffect(() => setValues(initial), [initial]);

  const updateIntegration = useUpdateIntegration();
  const changed =
    String(values.role ?? "") !== initial.role ||
    String(values.category ?? "") !== initial.category;

  const save = async () => {
    try {
      const raw = connection.raw as Record<string, unknown>;
      await updateIntegration.mutateAsync({
        id: connection.id,
        payload: {
          slug: String(raw.slug ?? ""),
          type: String(raw.type ?? "api"),
          role: String(values.role ?? ""),
          category: String(values.category ?? ""),
        } as never,
      });
      message.success(t("setTypeChanged"));
      onSaved();
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("setTypeChangeFailed"));
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Shuffle className="h-4 w-4" /> {t("setTypeCard")}
        </span>
      }
    >
      <Alert
        className="mb-3"
        type="warning"
        showIcon
        message={t("setTypeWarn")}
        description={t("setTypeWarnDesc")}
      />
      <Form layout="vertical">
        <ConnectionFields
          fields={TYPE_CHANGE_FIELDS}
          values={values}
          onChange={(k, v) => setValues((st) => ({ ...st, [k]: v }))}
          disabled={updateIntegration.isPending}
        />
        {/*
          ⚠️ TUGMA MATNI AMALNI AYTADI, HOLATNI EMAS. Ilgari o'zgarish
          bo'lmasa matn "O'zgarish yo'q" ga aylanardi — ya'ni tugma
          nima qilishini emas, tizim holatini yozardi. Operator
          "bosilmaydigan tugma" va "boshqa tugma" ni farqlay olmasdi.
          Holat tugmaning O'CHIRILGANIDA ko'rinadi, izoh esa ostida.
        */}
        <Button danger disabled={!changed} loading={updateIntegration.isPending} onClick={save}>
          {t("setTypeCard")}
        </Button>
        {!changed && (
          <p className="m-0 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {t("setTypeChangeHint")}
          </p>
        )}
      </Form>
    </Card>
  );
};

export default ConnectionSettings;
