// dizayn-v2: superadmin-integrations-panel-settings, superadmin-integrations-marketplace-console, admin-integrations-conn-settings
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Send } from "lucide-react";
import { usePartnerActions, type WebhookTestResult } from "../../../entities/partners";
import { useUpdateIntegration } from "../../../entities/integrations";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button } from "../../../shared/ui/primitives";
import ConnectionFields, { buildChangedPayload, type FieldValues } from "../ConnectionFields";
import { TYPE_CHANGE_FIELDS, fieldsInGroup, type ConnectionField } from "../connections";
import { getPath } from "../fieldPath";
import { FormSection, InlineAlert, Switch } from "../ui";
import type { Connection } from "../useConnections";

/**
 * SOZLAMALAR — umumiy forma, turga qarab boshqa maydonlar (maket `*-panel-settings`,
 * `*-marketplace-console`). Bo'limlar: «Ulanish qiymatlari» (oddiy maydonlar), har xarita alohida
 * bo'lim («Maydon xaritasi», status xaritalari), «Sinov rejimi» (faqat hamkor), oxirida bitta «Saqlash».
 * «Turini o'zgartirish» — alohida bo'lim, o'z tugmasi bilan.
 *
 * Panel HECH QANDAY maydonni o'zi bilmaydi — u `connections.ts` dagi ro'yxatni chizadi va o'zgarganini
 * saqlaydi. Yangi ulanish turi qo'shilsa bu fayl O'ZGARMAYDI.
 */

/** Asl yozuvdan forma qiymatlarini yasaydi. */
const initialValues = (c: Connection, fields: ConnectionField[]): FieldValues => {
  const raw = c.raw as Record<string, unknown>;
  const out: FieldValues = {};

  for (const f of fields) {
    if (f.writeOnly) {
      /**
       * ⚠️ Sirlar BO'SH boshlanadi — server ularni qaytarmaydi (faqat shifrlangan holda saqlanadi).
       * Bo'sh qoldirilsa `buildChangedPayload` ularni YUBORMAYDI, ya'ni ishlab turgan kalit saqlanadi.
       */
      out[f.key] = "";
      continue;
    }
    if (f.type === "switch") {
      out[f.key] = Boolean(getPath(raw, f.key));
      continue;
    }
    /**
     * Xarita (obyekt) — asl yozuvdan o'qiladi. ⚠️ `status-map` ham OBYEKT (JnHK6bgV): ilgari
     * `String(obj)` → «[object Object]» bo'lib, bitta katak saqlansa qolgan xarita o'chib ketardi.
     */
    if (f.type === "mapping" || f.type === "status-map") {
      const val = getPath(raw, f.key);
      out[f.key] = val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, string>) : {};
      continue;
    }
    if (f.type === "tags") {
      const arr = getPath(raw, f.key);
      out[f.key] = Array.isArray(arr) ? (arr as string[]) : [];
      continue;
    }
    // `base_url` eski yozuvlarda `api_url` da bo'lishi mumkin. ⚠️ `getPath` — kalit nuqtali bo'lishi
    // mumkin (`dispatch_config.endpoint`); tekis o'qish bo'sh qaytarib, saqlashda sozlamani o'chirardi.
    const fallback = f.key === "base_url" ? raw.api_url : undefined;
    out[f.key] = String(getPath(raw, f.key) ?? fallback ?? "");
  }
  return out;
};

/** Xarita turidagi maydon — o'z bo'limida (maket: «Maydon xaritasi», «Chiquvchi holat xaritasi»). */
const isMap = (f: ConnectionField) => f.type === "mapping" || f.type === "status-map";

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
  const baseId = useId();
  /**
   * Faqat `connection` guruhi — kirishni cheklaydigan qiymatlar (IP ro'yxati, kalitlar) Xavfsizlik
   * tabida: bu yerdagi tahrir oddiy, o'sha yerdagisi esa ulanishni butunlay to'sib qo'yishi mumkin.
   */
  const fields = useMemo(() => fieldsInGroup(allFields, "connection"), [allFields]);
  /**
   * SINOV MAYDONLARI ALOHIDA BO'LIMDA. ⚠️ Ilgari «Webhook sekreti» va «Sandbox sekreti» yonma-yon turardi
   * — xato maydonga asosiy sekretni yozib qo'yish juda oson edi.
   */
  const sandboxFields = useMemo(() => fieldsInGroup(allFields, "sandbox"), [allFields]);
  const plainFields = useMemo(() => fields.filter((f) => !isMap(f)), [fields]);
  const mapFields = useMemo(() => fields.filter(isMap), [fields]);
  /** Sinov kaliti — bo'lim sarlavhasi yonida (maket); qolgan sinov maydonlari ostida. */
  const sandboxSwitch = sandboxFields.find((f) => f.type === "switch");
  const sandboxRest = sandboxFields.filter((f) => f !== sandboxSwitch);

  /** Boshlang'ich qiymatlar IKKI guruhdan birga yig'iladi — forma holati yagona, bo'limlar faqat ko'rinish. */
  const initial = useMemo(() => initialValues(connection, [...fields, ...sandboxFields]), [connection, fields, sandboxFields]);

  const [values, setValues] = useState<FieldValues>(initial);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  // Ulanish almashsa forma qayta to'ldiriladi — aks holda oldingi ulanishning qiymatlari xato yozuvga saqlanardi.
  useEffect(() => {
    setValues(initial);
    setTestResult(null);
  }, [initial]);

  const { updatePartner, testWebhook } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const saving = updatePartner.isPending || updateIntegration.isPending;
  const isPartner = connection.kind === "partner";
  const change = (k: string, v: FieldValues[string]) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const payload = buildChangedPayload([...fields, ...sandboxFields], values, initial);
    if (!Object.keys(payload).length) {
      notify.info(t("setNoChange"));
      return;
    }

    try {
      if (isPartner) {
        await updatePartner.mutateAsync({ id: connection.id, dto: payload as never });
      } else {
        /**
         * `external_integrations` yangilashda `slug` va `type` ni ham kutadi (backend `Object.assign`
         * qiladi), shuning uchun o'zgarmagan bo'lsa ham mavjud qiymat uzatiladi.
         */
        const raw = connection.raw as Record<string, unknown>;
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: { slug: String(raw.slug ?? ""), type: String(raw.type ?? "api"), ...payload } as never,
        });
      }
      notify.success(t("savedOk"));
      onSaved();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("saveFailed"));
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
      notify.error(getBackendErrorMessage(error) || t("setTestFailed"));
    }
  };

  /**
   * Sinov tugmasi FAQAT inbound ulanishda: biz ularga webhook yuboramiz, ya'ni sinash mumkin. Outbound'da
   * so'rovni biz yuboramiz va uni sinash boshqa mexanizm (Umumiy holat → «Aloqani sinash»).
   */
  const renderAddon = (field: ConnectionField) =>
    isPartner && field.key === "webhook_url" ? (
      <Button
        variant="secondary"
        leftIcon={Send}
        loading={testWebhook.isPending}
        disabled={!String(values.webhook_url ?? "").trim()}
        onClick={() => void runTest()}
        title={t("setTestTip")}
        className="flex-none max-md:min-h-11"
      >
        {t("setTestBtn")}
      </Button>
    ) : null;

  const renderAfter = (field: ConnectionField) =>
    isPartner && field.key === "webhook_url" && testResult ? (
      <InlineAlert
        tone={testResult.ok ? "success" : "danger"}
        role="status"
        title={
          testResult.ok
            ? t("console.testReached", { status: testResult.http_status ?? "—", ms: testResult.duration_ms ?? "—" })
            : testResult.http_status
              ? t("console.testNotReachedStatus", { status: testResult.http_status })
              : t("console.testNotReached")
        }
      >
        {/* Sekret sozlanmagan bo'lsa qabul qiluvchi imzoni tekshira olmaydi — eng ko'p uchraydigan sabab. */}
        {!testResult.secret_configured ? <span className="block">{t("console.testNoSecret")}</span> : null}
        {testResult.error ? <span className="block break-all">{testResult.error}</span> : null}
        {/* Javob tanasi MUHIM: qabul qiluvchi 200 qaytarib ham «imzo yaroqsiz» deyishi mumkin. */}
        {testResult.response_body ? (
          <span className="block break-all text-text-muted">
            {t("wzResponse", { body: testResult.response_body.slice(0, 200) })}
          </span>
        ) : null}
      </InlineAlert>
    ) : null;

  const sandboxOn = sandboxSwitch ? Boolean(values[sandboxSwitch.key]) : false;

  return (
    <div className="flex min-w-0 flex-col border-t border-border">
      <FormSection
        id={`${baseId}-conn`}
        title={t("setConnValues")}
        description={t(isPartner ? "console.setConnHintPartner" : "console.setConnHintIntegration", { name: connection.name })}
      >
        <ConnectionFields
          fields={plainFields}
          values={values}
          onChange={change}
          disabled={saving}
          renderAddon={renderAddon}
          renderAfter={renderAfter}
        />
      </FormSection>

      {mapFields.map((field) => (
        // Xarita o'z sarlavhasini (yorliq + izoh, status xaritasida «N / M moslangan») o'zi chizadi.
        <section key={field.key} className="min-w-0 border-t border-border p-5 max-md:p-4">
          <ConnectionFields fields={[field]} values={values} onChange={change} disabled={saving} columns={1} />
        </section>
      ))}

      {/* ═══ SINOV REJIMI — ALOHIDA BO'LIM ═══ */}
      {sandboxFields.length > 0 ? (
        <FormSection id={`${baseId}-sandbox`} title={t("setSandboxCard")} description={t("console.sandboxIntro")}>
          {sandboxSwitch ? (
            <Switch
              checked={sandboxOn}
              disabled={saving}
              onChange={(next) => change(sandboxSwitch.key, next)}
              label={t(sandboxOn ? "console.sandboxOn" : "console.sandboxOff")}
              description={t("console.sandboxRule")}
            />
          ) : null}
          <ConnectionFields fields={sandboxRest} values={values} onChange={change} disabled={saving} />
        </FormSection>
      ) : null}

      <div className="flex justify-end border-t border-border px-5 py-3 max-md:px-4">
        <Button loading={saving} onClick={() => void save()} className="max-md:w-full">
          {t("console.save")}
        </Button>
      </div>

      {/* ═══ TURINI O'ZGARTIRISH ═══ */}
      {connection.kind === "integration" ? <TypeChangeSection connection={connection} onSaved={onSaved} /> : null}
    </div>
  );
};

/**
 * TURINI O'ZGARTIRISH — alohida, ogohlantirishli amal.
 *
 * NEGA ALOHIDA. Ilgari `role`/`category` oddiy maydon bo'lib asosiy formada turardi va katalog
 * tanlovini ma'nosizlantirdi (audit FE-05). Lekin butunlay olib tashlash ham xato: noto'g'ri
 * tasniflangan ulanishni (Donoxon) tuzatish kerak. ⚠️ TUR O'ZGARSA FORMA MAYDONLARI HAM O'ZGARADI.
 */
const TypeChangeSection = ({ connection, onSaved }: { connection: Connection; onSaved: () => void }) => {
  const { t } = useTranslation("integrations");
  const baseId = useId();
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
  const changed = String(values.role ?? "") !== initial.role || String(values.category ?? "") !== initial.category;

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
      notify.success(t("setTypeChanged"));
      onSaved();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("setTypeChangeFailed"));
    }
  };

  return (
    <FormSection id={`${baseId}-type`} title={t("setTypeCard")} description={t("console.typeChangeHint")}>
      <InlineAlert tone="warning" title={t("setTypeWarn")}>
        {t("setTypeWarnDesc")}
      </InlineAlert>
      <ConnectionFields
        fields={TYPE_CHANGE_FIELDS}
        values={values}
        onChange={(k, v) => setValues((st) => ({ ...st, [k]: v }))}
        disabled={updateIntegration.isPending}
      />
      {/*
        ⚠️ TUGMA MATNI AMALNI AYTADI, HOLATNI EMAS: o'zgarish bo'lmasa tugma o'chiriladi, izoh esa yonida.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="danger-soft"
          rightIcon={ChevronRight}
          disabled={!changed}
          loading={updateIntegration.isPending}
          onClick={() => void save()}
          className="max-md:w-full"
        >
          {t("setTypeCard")}
        </Button>
        {!changed ? <span className="text-xs text-text-muted">{t("setTypeChangeHint")}</span> : null}
      </div>
    </FormSection>
  );
};

export default ConnectionSettings;
