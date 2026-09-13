import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Send } from 'lucide-react';
import {
  usePartnerActions,
  type WebhookTestResult,
} from '../../../entities/partners';
import { useUpdateIntegration } from '../../../entities/integrations';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import ConnectionFields, {
  buildChangedPayload,
  type FieldValues,
} from '../ConnectionFields';
import { fieldsInGroup, type ConnectionField } from '../connections';
import type { Connection } from '../useConnections';

/**
 * SOZLAMALAR — umumiy forma, turga qarab boshqa maydonlar.
 *
 * Foydalanuvchi talabi shunday edi: "deyarli bir xil UI, faqat so'raydigan va
 * ulaydigan qiymatlari farqli bo'lsa faqat shular boshqa bo'lsin". Shu bois
 * bu panel HECH QANDAY maydonni o'zi bilmaydi — u `connections.ts` dagi
 * ro'yxatni chizadi va o'zgarganini saqlaydi.
 *
 * Yangi ulanish turi qo'shilsa bu fayl O'ZGARMAYDI.
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
      out[f.key] = '';
      continue;
    }
    if (f.type === 'switch') {
      out[f.key] = Boolean(raw[f.key]);
      continue;
    }
    if (f.type === 'tags') {
      out[f.key] = Array.isArray(raw[f.key]) ? (raw[f.key] as string[]) : [];
      continue;
    }
    // `base_url` eski yozuvlarda `api_url` da bo'lishi mumkin.
    const fallback = f.key === 'base_url' ? raw.api_url : undefined;
    out[f.key] = String(raw[f.key] ?? fallback ?? '');
  }
  return out;
};

type Msg = { tone: 'ok' | 'err'; text: string } | null;

const ConnectionSettings = ({
  connection,
  fields: allFields,
  onSaved,
}: {
  connection: Connection;
  fields: ConnectionField[];
  onSaved: () => void;
}) => {
  /**
   * Faqat `connection` guruhi — kirishni cheklaydigan qiymatlar (IP ro'yxati,
   * kalitlar) Xavfsizlik tabida. Sababi: bu yerdagi tahrir oddiy, o'sha
   * yerdagisi esa ulanishni butunlay to'sib qo'yishi mumkin.
   */
  const fields = useMemo(
    () => fieldsInGroup(allFields, 'connection'),
    [allFields],
  );
  const initial = useMemo(
    () => initialValues(connection, fields),
    [connection, fields],
  );

  const [values, setValues] = useState<FieldValues>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  // Ulanish almashsa forma qayta to'ldiriladi — aks holda oldingi
  // ulanishning qiymatlari qolib, xato yozuvga saqlanardi.
  useEffect(() => {
    setValues(initial);
    setMsg(null);
    setTestResult(null);
  }, [initial]);

  const { updatePartner, testWebhook } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const saving = updatePartner.isPending || updateIntegration.isPending;

  const change = (key: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const save = async () => {
    const payload = buildChangedPayload(fields, values, initial);
    if (!Object.keys(payload).length) {
      setMsg({ tone: 'ok', text: "O'zgarish yo'q" });
      return;
    }

    try {
      if (connection.kind === 'partner') {
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
            slug: String(raw.slug ?? ''),
            type: String(raw.type ?? 'api'),
            ...payload,
          } as never,
        });
      }
      setMsg({ tone: 'ok', text: 'Saqlandi' });
      onSaved();
    } catch (error) {
      setMsg({
        tone: 'err',
        text: getBackendErrorMessage(error) || "Saqlab bo'lmadi",
      });
    }
  };

  const runTest = async () => {
    setTestResult(null);
    try {
      const res = await testWebhook.mutateAsync({
        id: connection.id,
        url: String(values.webhook_url ?? '').trim() || undefined,
      });
      setTestResult(res);
    } catch (error) {
      setMsg({
        tone: 'err',
        text: getBackendErrorMessage(error) || "Sinov yuborib bo'lmadi",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-4 dark:bg-gray-800/50">
        <ConnectionFields
          fields={fields}
          values={values}
          onChange={change}
          disabled={saving}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Saqlash
          </button>

          {/*
            Sinov tugmasi FAQAT inbound ulanishda: biz ularga webhook
            yuboramiz, ya'ni sinash mumkin. Outbound'da teskarisi — so'rovni
            biz yuboramiz va uni sinash boshqa mexanizm (healthcheck).
          */}
          {connection.kind === 'partner' && (
            <button
              type="button"
              onClick={runTest}
              disabled={
                testWebhook.isPending ||
                !String(values.webhook_url ?? '').trim()
              }
              title="Sinov hodisasi yuboriladi — buyurtmaga ta'sir qilmaydi"
              className="flex h-10 items-center gap-2 rounded-xl border border-indigo-500 px-4 text-sm font-bold text-indigo-700 dark:text-indigo-300 disabled:opacity-40"
            >
              {testWebhook.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Ulanishni sinash
            </button>
          )}

          {msg && (
            <span
              className={`text-xs font-bold ${
                msg.tone === 'ok'
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-red-600 dark:text-red-300'
              }`}
            >
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {testResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            testResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300'
          }`}
        >
          <p className="m-0 font-bold">
            {testResult.ok
              ? `✓ Yetdi — HTTP ${testResult.http_status} (${testResult.duration_ms} ms)`
              : `✗ Yetmadi${
                  testResult.http_status
                    ? ` — HTTP ${testResult.http_status}`
                    : ''
                }`}
          </p>
          {/* Sekret sozlanmagan bo'lsa qabul qiluvchi imzoni tekshira
              olmaydi — eng ko'p uchraydigan sabab. */}
          {!testResult.secret_configured && (
            <p className="m-0 mt-1">
              ⚠️ Webhook sekreti sozlanmagan — qabul qiluvchi imzoni tekshira
              olmaydi
            </p>
          )}
          {testResult.error && (
            <p className="m-0 mt-1 break-all">{testResult.error}</p>
          )}
          {/* Javob tanasi MUHIM: qabul qiluvchi 200 qaytarib ham "imzo
              yaroqsiz" deyishi mumkin. */}
          {testResult.response_body && (
            <p className="m-0 mt-1 break-all opacity-80">
              Javob: {testResult.response_body.slice(0, 200)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionSettings;
