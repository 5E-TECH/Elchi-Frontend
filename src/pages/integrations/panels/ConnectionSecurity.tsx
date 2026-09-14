import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Form, Popconfirm, Tag, Typography, message } from "antd";
import { KeyRound, Power, Save, ShieldCheck } from "lucide-react";
import { usePartnerActions } from "../../../entities/partners";
import { useUpdateIntegration } from "../../../entities/integrations";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import ConnectionFields, { buildChangedPayload, type FieldValues } from "../ConnectionFields";
import { fieldsInGroup, type ConnectionField } from "../connections";
import { getPath } from "../fieldPath";
import type { Connection } from "../useConnections";

/**
 * XAVFSIZLIK — kirishni CHEKLAYDIGAN qiymatlar va TA'SIRI KATTA amallar.
 *
 * Shakl PCS `ElchiControlTab` dan: har bir amal o'z `Card`ida, xavfli
 * amallar `Popconfirm` bilan, tushuntirish `Alert` bilan.
 *
 * NEGA SOZLAMALARDAN AJRATILDI. Bir tabda "webhook manzilini o'zgartirish"
 * bilan "API kalitni yangilash" yonma-yon turardi. Ikkinchisi hamkorning
 * ulanishini DARHOL uzadi, birinchisi esa oddiy tahrir. Bir xil
 * ko'rinishda turgani xato bosishga olib keladi.
 */

const initialValues = (c: Connection, fields: ConnectionField[]): FieldValues => {
  const raw = c.raw as Record<string, unknown>;
  const out: FieldValues = {};
  for (const f of fields) {
    // Sirlar bo'sh boshlanadi — server ularni qaytarmaydi.
    if (f.writeOnly) {
      out[f.key] = "";
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
    out[f.key] = String(getPath(raw, f.key) ?? "");
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
  const { t } = useTranslation("integrations");
  const fields = useMemo(() => fieldsInGroup(allFields, "security"), [allFields]);
  const initial = useMemo(() => initialValues(connection, fields), [connection, fields]);

  const [values, setValues] = useState<FieldValues>(initial);
  /** Yangi kalit — FAQAT bir marta ko'rsatiladi, keyin boshqa olinmaydi. */
  const [freshKey, setFreshKey] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial);
    setFreshKey(null);
  }, [initial]);

  const { updatePartner, rotateKey, setActive } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const isPartner = connection.kind === "partner";
  const saving = updatePartner.isPending || updateIntegration.isPending;

  const save = async () => {
    const payload = buildChangedPayload(fields, values, initial);
    if (!Object.keys(payload).length) {
      message.info("O'zgarish yo'q");
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

  const doRotate = async () => {
    try {
      const res = await rotateKey.mutateAsync(connection.id);
      setFreshKey(res.api_key || null);
      message.success(t("secKeyCreated"));
      onSaved();
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("secKeyRotateFailed"));
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
            slug: String(raw.slug ?? ""),
            type: String(raw.type ?? "api"),
            is_active: next,
          } as never,
        });
      }
      message.success(next ? t("secEnabled") : t("secDisabled"));
      onSaved();
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("toggleFailed"));
    }
  };

  const togglePending = setActive.isPending || updateIntegration.isPending;

  return (
    <div className="space-y-4">
      {/* ═══ Kirish cheklovlari ═══ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> {t("secAccessLimits")}
          </span>
        }
      >
        {fields.length === 0 ? (
          <Alert type="info" showIcon message={t("secNoLimitFields")} />
        ) : (
          <Form layout="vertical">
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
          </Form>
        )}
      </Card>

      {/* ═══ API kalit — faqat hamkorda ═══ */}
      {isPartner && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> {t("secApiKey")}
            </span>
          }
          extra={
            <Popconfirm
              title={t("secRotateTitle")}
              description={<span className="block max-w-xs">{t("secRotateWarning")}</span>}
              okText={t("secRotateOk")}
              okButtonProps={{ danger: true, loading: rotateKey.isPending }}
              cancelText={t("common:cancel")}
              onConfirm={doRotate}
            >
              <Button danger icon={<KeyRound className="h-4 w-4" />}>
                {t("secRotateTitle")}
              </Button>
            </Popconfirm>
          }
        >
          <p className="m-0 text-sm text-gray-500 dark:text-gray-400">{t("secKeyHashNote")}</p>

          {/* Yangi kalit — BIR MARTA. Sahifadan chiqilsa boshqa olinmaydi. */}
          {freshKey && (
            <Alert
              className="mt-3"
              type="success"
              showIcon
              message={t("secFreshKeyTitle")}
              description={
                <Typography.Paragraph
                  copyable={{ text: freshKey }}
                  className="!mb-0 !mt-1 break-all font-mono text-xs"
                >
                  {freshKey}
                </Typography.Paragraph>
              }
            />
          )}
        </Card>
      )}

      {/* ═══ Kill-switch ═══ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Power className="h-4 w-4" /> {t("secConnState")}
          </span>
        }
        extra={
          <Tag color={connection.is_active ? "green" : "red"}>
            {connection.is_active ? t("secTagActive") : t("secTagOff")}
          </Tag>
        }
      >
        <Alert
          type={connection.is_active ? "info" : "warning"}
          showIcon
          message={connection.is_active ? t("secStateActive") : t("secStateOff")}
          description={connection.is_active ? t("secStateActiveDesc") : t("secStateOffDesc")}
        />

        <Popconfirm
          title={connection.is_active ? t("secDisableTitle") : t("secEnableTitle")}
          description={connection.is_active ? t("secDisableDesc") : t("secEnableDesc")}
          okText={t("common:yes")}
          cancelText={t("common:cancel")}
          okButtonProps={{
            danger: connection.is_active,
            loading: togglePending,
          }}
          onConfirm={toggleActive}
        >
          <Button
            className="mt-3"
            danger={connection.is_active}
            type={connection.is_active ? "default" : "primary"}
            icon={<Power className="h-4 w-4" />}
            loading={togglePending}
          >
            {connection.is_active ? t("secBtnOff") : t("secBtnOn")}
          </Button>
        </Popconfirm>
      </Card>
    </div>
  );
};

export default ConnectionSecurity;
