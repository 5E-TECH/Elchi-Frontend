import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Power,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { usePartnerActions } from '../../../entities/partners';
import { useUpdateIntegration } from '../../../entities/integrations';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import ConnectionFields, {
  buildChangedPayload,
  type FieldValues,
} from '../ConnectionFields';
import { fieldsInGroup, type ConnectionField } from '../connections';
import type { Connection } from '../useConnections';

/**
 * XAVFSIZLIK — kirishni CHEKLAYDIGAN qiymatlar va TA'SIRI KATTA amallar.
 *
 * NEGA SOZLAMALARDAN AJRATILDI. Bir tabda "webhook manzilini o'zgartirish"
 * bilan "API kalitni yangilash" yonma-yon turardi. Ikkinchisi hamkorning
 * ulanishini DARHOL uzadi, birinchisi esa oddiy tahrir. Bir xil ko'rinishda
 * turgani xato bosishga olib keladi.
 *
 * Bu yerda uch narsa bor:
 *   1. Kirish cheklovlari — registrdagi `group: 'security'` maydonlari
 *   2. API kalit rotatsiyasi — faqat hamkorda (kalit BIZDAN chiqadi)
 *   3. Kill-switch — ulanishni butunlay to'xtatish
 */

type Msg = { tone: 'ok' | 'err'; text: string } | null;

const initialValues = (
  c: Connection,
  fields: ConnectionField[],
): FieldValues => {
  const raw = c.raw as Record<string, unknown>;
  const out: FieldValues = {};
  for (const f of fields) {
    // Sirlar bo'sh boshlanadi — server ularni qaytarmaydi.
    if (f.writeOnly) {
      out[f.key] = '';
      continue;
    }
    if (f.type === 'tags') {
      out[f.key] = Array.isArray(raw[f.key]) ? (raw[f.key] as string[]) : [];
      continue;
    }
    out[f.key] = String(raw[f.key] ?? '');
  }
  return out;
};

const ConnectionSecurity = ({
  connection,
  fields: allFields,
  onSaved,
}: {
  connection: Connection;
  fields: ConnectionField[];
  onSaved: () => void;
}) => {
  const fields = useMemo(
    () => fieldsInGroup(allFields, 'security'),
    [allFields],
  );
  const initial = useMemo(
    () => initialValues(connection, fields),
    [connection, fields],
  );

  const [values, setValues] = useState<FieldValues>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  /** Rotatsiya tasdig'i — ta'siri katta amal bir bosishda bajarilmaydi. */
  const [confirmRotate, setConfirmRotate] = useState(false);
  /** Yangi kalit — FAQAT bir marta ko'rsatiladi, keyin boshqa olinmaydi. */
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setValues(initial);
    setMsg(null);
    setConfirmRotate(false);
    setFreshKey(null);
  }, [initial]);

  const { updatePartner, rotateKey, setActive } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const isPartner = connection.kind === 'partner';
  const saving = updatePartner.isPending || updateIntegration.isPending;

  const save = async () => {
    const payload = buildChangedPayload(fields, values, initial);
    if (!Object.keys(payload).length) {
      setMsg({ tone: 'ok', text: "O'zgarish yo'q" });
      return;
    }
    try {
      if (isPartner) {
        await updatePartner.mutateAsync({
          id: connection.id,
          dto: payload as never,
        });
      } else {
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

  const doRotate = async () => {
    try {
      const res = await rotateKey.mutateAsync(connection.id);
      setFreshKey(res.api_key || null);
      setConfirmRotate(false);
      setMsg(null);
      onSaved();
    } catch (error) {
      setMsg({
        tone: 'err',
        text: getBackendErrorMessage(error) || "Kalitni yangilab bo'lmadi",
      });
    }
  };

  /**
   * KILL-SWITCH.
   *
   * ⚠️ Ikki xil yo'l, va bu tasodif emas: hamkorda alohida endpoint bor
   * (`POST partners/:id/status`), integratsiyada esa PATCH'ning o'zi
   * `is_active` ni oladi. Ilgari ikkisi ham umumiy formaning `switch`
   * maydoni orqali ketardi va HAMKOR uchun qiymat gateway'da jimgina
   * tashlanardi (`whitelist: true`, DTO'da maydon yo'q) — forma "Saqlandi"
   * deb yozardi, ulanish esa ishlab turardi.
   */
  const toggleActive = async () => {
    const next = !connection.is_active;
    try {
      if (isPartner) {
        await setActive.mutateAsync({ id: connection.id, is_active: next });
      } else {
        const raw = connection.raw as Record<string, unknown>;
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: {
            slug: String(raw.slug ?? ''),
            type: String(raw.type ?? 'api'),
            is_active: next,
          } as never,
        });
      }
      setMsg({
        tone: 'ok',
        text: next ? 'Ulanish yoqildi' : "Ulanish o'chirildi",
      });
      onSaved();
    } catch (error) {
      setMsg({
        tone: 'err',
        text: getBackendErrorMessage(error) || "Holatni o'zgartirib bo'lmadi",
      });
    }
  };

  const togglePending = setActive.isPending || updateIntegration.isPending;

  return (
    <div className="space-y-4">
      {/* ═══ 1. Kirish cheklovlari ═══ */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-4 dark:bg-gray-800/50">
        <header className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="m-0 text-sm font-extrabold text-gray-800 dark:text-white">
            Kirish cheklovlari
          </h3>
        </header>

        {fields.length === 0 ? (
          <p className="m-0 text-xs text-gray-500 dark:text-gray-400">
            Bu ulanish turida cheklov sozlamasi yo'q.
          </p>
        ) : (
          <>
            <ConnectionFields
              fields={fields}
              values={values}
              onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
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
          </>
        )}
      </section>

      {/* ═══ 2. API kalit — faqat hamkorda ═══ */}
      {isPartner && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-4 dark:bg-gray-800/50">
          <header className="mb-2 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="m-0 text-sm font-extrabold text-gray-800 dark:text-white">
              API kalit
            </h3>
          </header>
          <p className="m-0 text-xs text-gray-500 dark:text-gray-400">
            Kalit bizda ochiq saqlanmaydi — faqat xeshi. Shu sababli uni qayta
            ko'rsatib bo'lmaydi; yo'qolsa yangisini yaratish kerak.
          </p>

          {/* Yangi kalit — BIR MARTA. Sahifadan chiqilsa boshqa olinmaydi. */}
          {freshKey && (
            <div className="mt-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-3">
              <p className="m-0 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                Yangi kalit — HOZIR ko'chirib oling, boshqa ko'rsatilmaydi
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-gray-800 dark:bg-gray-900/60 dark:text-white">
                  {freshKey}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(freshKey);
                    setCopied(true);
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-600 px-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Ko'chirildi" : "Ko'chirish"}
                </button>
              </div>
            </div>
          )}

          {!confirmRotate ? (
            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-amber-600 px-4 text-sm font-bold text-amber-700 dark:text-amber-300"
            >
              <KeyRound className="h-4 w-4" />
              Kalitni yangilash
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="m-0 flex items-start gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Eski kalit DARHOL ishlamay qoladi. Hamkor yangi kalitni
                qo'ymaguncha ularning so'rovlari rad etiladi.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={doRotate}
                  disabled={rotateKey.isPending}
                  className="flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-3.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {rotateKey.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Ha, yangilash
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRotate(false)}
                  className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 px-3.5 text-xs font-bold text-gray-800 dark:text-white"
                >
                  Bekor
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ 3. Kill-switch ═══ */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-4 dark:bg-gray-800/50">
        <header className="mb-2 flex items-center gap-2">
          <Power className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="m-0 text-sm font-extrabold text-gray-800 dark:text-white">
            Ulanish holati
          </h3>
        </header>
        <p className="m-0 text-xs text-gray-500 dark:text-gray-400">
          {connection.is_active
            ? "Ulanish FAOL. O'chirilsa hamkor so'rovlari rad etiladi va hodisalar yuborilmaydi."
            : "Ulanish O'CHIQ. Hech qanday so'rov qabul qilinmaydi va hodisa yuborilmaydi."}
        </p>
        <button
          type="button"
          onClick={toggleActive}
          disabled={togglePending}
          className={`mt-3 flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${
            connection.is_active
              ? 'border border-red-600 text-red-700 dark:text-red-300'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {togglePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {connection.is_active ? "Ulanishni o'chirish" : 'Ulanishni yoqish'}
        </button>
      </section>
    </div>
  );
};

export default ConnectionSecurity;
