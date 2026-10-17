// dizayn-v2: superadmin-integrations-panel-security, superadmin-integrations-rotate-key-dialog, admin-integrations-conn-security
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, Plug, Power, ShieldCheck } from "lucide-react";
import { usePartnerActions } from "../../../entities/partners";
import { useUpdateIntegration } from "../../../entities/integrations";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, StatusBadge, useConfirm } from "../../../shared/ui/primitives";
import ConnectionFields, { buildChangedPayload, type FieldValues } from "../ConnectionFields";
import { fieldsInGroup, type ConnectionField } from "../connections";
import { getPath } from "../fieldPath";
import { ColumnGrid, CopyValue, InlineAlert, PanelSection, SectionHead } from "../ui";
import type { Connection } from "../useConnections";

/**
 * XAVFSIZLIK — kirishni CHEKLAYDIGAN qiymatlar va TA'SIRI KATTA amallar (maket `*-panel-security`).
 *
 *   «Kirish cheklovlari» (IP chiplari yoki tashqi tizimda kalit/imzo maydonlari) + «Saqlash»
 *   «API kalit» (faqat hamkor) + «Kalitni yangilash» → tasdiq (`*-rotate-key-dialog`) → yangi kalit BIR MARTA
 *   «Ulanish holati» + «To'xtatish» / «Yoqish» → tasdiq
 *
 * NEGA SOZLAMALARDAN AJRATILDI. «Webhook manzilini o'zgartirish» oddiy tahrir, «API kalitni yangilash»
 * esa hamkorning ulanishini DARHOL uzadi — bir xil ko'rinishda turgani xato bosishga olib keladi.
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
    /** Xarita (obyekt) — asl yozuvdan o'qiladi; busiz saqlashda mavjud xarita O'CHIB ketardi. */
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
  const confirm = useConfirm();
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
      notify.info(t("setNoChange"));
      return;
    }
    try {
      if (isPartner) {
        await updatePartner.mutateAsync({ id: connection.id, dto: payload as never });
      } else {
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

  const doRotate = async () => {
    try {
      const res = await rotateKey.mutateAsync(connection.id);
      setFreshKey(res.api_key || null);
      notify.success(t("secKeyCreated"));
      onSaved();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("secKeyRotateFailed"));
    }
  };

  /**
   * KILL-SWITCH. ⚠️ Ikki xil yo'l, va bu tasodif emas: hamkorda alohida endpoint bor
   * (`POST partners/:id/status`), integratsiyada esa PATCH'ning o'zi `is_active` ni oladi. Ilgari
   * HAMKOR uchun qiymat gateway'da jimgina tashlanardi — forma «Saqlandi» deb yozardi, ulanish ishlab turardi.
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
          payload: { slug: String(raw.slug ?? ""), type: String(raw.type ?? "api"), is_active: next } as never,
        });
      }
      notify.success(next ? t("secEnabled") : t("secDisabled"));
      onSaved();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("toggleFailed"));
    }
  };

  const togglePending = setActive.isPending || updateIntegration.isPending;

  // Kirish huquqini o'zgartiradigan amallar — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8).
  // `doRotate` / `toggleActive` xatoni o'zi xabar qiladi; oyna amal tugaguncha yuklanishda turadi.
  const confirmRotate = () =>
    void confirm({
      tone: "danger",
      title: t("secRotateTitle"),
      description: t("secRotateWarning"),
      // Maket `superadmin-integrations-rotate-key-dialog`: hamkor nomi + kalit turi, «Ha, yangilash».
      details: (
        <span className="flex items-center gap-3">
          <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface text-text-muted">
            <Plug size={18} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold text-text">{connection.name}</span>
            <span className="text-[13px] text-text-muted">{t("secRotateKind")}</span>
          </span>
        </span>
      ),
      note: t("secRotateNote"),
      confirmLabel: t("secRotateOk"),
      cancelLabel: t("npCancel"),
      icon: KeyRound,
      confirmIcon: KeyRound,
      onConfirm: doRotate,
    });

  const confirmToggle = () =>
    void confirm({
      tone: connection.is_active ? "danger" : "primary",
      title: connection.is_active ? t("secDisableTitle") : t("secEnableTitle"),
      description: connection.is_active ? t("secDisableDesc") : t("secEnableDesc"),
      confirmLabel: connection.is_active ? t("secBtnOff") : t("secBtnOn"),
      cancelLabel: t("npCancel"),
      icon: Power,
      confirmIcon: Power,
      onConfirm: toggleActive,
    });

  /* ═══ Kirish cheklovlari ═══ */
  const access = (
    <PanelSection aria-label={t("secAccessLimits")} bordered={!isPartner}>
      <SectionHead title={t("secAccessLimits")} icon={ShieldCheck} />
      {fields.length === 0 ? (
        <InlineAlert tone="info">{t("secNoLimitFields")}</InlineAlert>
      ) : (
        <>
          <ConnectionFields
            fields={fields}
            values={values}
            onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
            disabled={saving}
          />
          <div>
            <Button variant="secondary" loading={saving} onClick={() => void save()} className="max-md:w-full">
              {t("console.save")}
            </Button>
          </div>
        </>
      )}
    </PanelSection>
  );

  /* ═══ API kalit — faqat hamkorda ═══ */
  const apiKey = isPartner ? (
    <PanelSection aria-label={t("secApiKey")} bordered={false}>
      <SectionHead
        title={t("secApiKey")}
        icon={KeyRound}
        description={t("secKeyHashNote")}
        actions={
          <Button
            variant="danger-soft"
            size="sm"
            leftIcon={KeyRound}
            loading={rotateKey.isPending}
            onClick={confirmRotate}
            className="max-md:min-h-11"
          >
            {t("secRotateTitle")}
          </Button>
        }
      />
      {/* Yangi kalit — BIR MARTA. Sahifadan chiqilsa boshqa olinmaydi. */}
      {freshKey ? (
        <InlineAlert tone="success" title={t("secFreshKeyTitle")}>
          <span className="mt-2 block">
            <CopyValue value={freshKey} />
          </span>
        </InlineAlert>
      ) : null}
    </PanelSection>
  ) : null;

  /* ═══ Ulanish holati (kill-switch) ═══ */
  const state = (
    <PanelSection aria-label={t("secConnState")}>
      <SectionHead
        title={t("secConnState")}
        icon={Power}
        actions={
          <StatusBadge
            tone={connection.is_active ? "success" : "neutral"}
            label={connection.is_active ? t("secTagActive") : t("secTagOff")}
          />
        }
      />
      {/* Maket: izoh va amal yonma-yon (tor ustunda — ustma-ust). */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1_1_240px]">
          <InlineAlert
            tone={connection.is_active ? "info" : "warning"}
            title={connection.is_active ? t("secStateActive") : t("secStateOff")}
          >
            {connection.is_active ? t("secStateActiveDesc") : t("secStateOffDesc")}
          </InlineAlert>
        </div>
        <Button
          variant={connection.is_active ? "danger-soft" : "secondary"}
          leftIcon={Power}
          loading={togglePending}
          onClick={confirmToggle}
          className="max-md:w-full"
        >
          {connection.is_active ? t("secBtnOff") : t("secBtnOn")}
        </Button>
      </div>
    </PanelSection>
  );

  /*
   * Hamkorda (maket): chapda «Kirish cheklovlari», o'ngda «API kalit» + «Ulanish holati» — ikki ustun
   * (tor ekranda ustma-ust). Tashqi tizimda kalit bo'limi yo'q, cheklov maydonlari ko'p — to'liq enli.
   */
  return isPartner ? (
    <ColumnGrid basis={420}>
      <div className="bg-surface">{access}</div>
      <div className="flex flex-col bg-surface">
        {apiKey}
        {state}
      </div>
    </ColumnGrid>
  ) : (
    <div className="flex min-w-0 flex-col">
      {access}
      {state}
    </div>
  );
};

export default ConnectionSecurity;
