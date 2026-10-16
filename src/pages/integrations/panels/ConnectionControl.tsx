// dizayn-v2: superadmin-integrations-panel-control, admin-integrations-conn-control
import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import {
  Activity,
  GitCompareArrows,
  History,
  Info,
  LoaderCircle,
  Plug,
  Power,
  RefreshCw,
  Send,
  Webhook,
} from "lucide-react";
import { usePartnerActions } from "../../../entities/partners";
import { useGetIntegrationById, useReconcileNow, useUpdateIntegration } from "../../../entities/integrations";
import { useIntegrationHealthcheck } from "../../../entities/integrations/healthcheck";
import { useProcessQueue, useRetryFailed } from "../../../entities/integrations/shipments";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { useFocusTrap } from "../../../shared/lib/useFocusTrap";
import type { Connection } from "../useConnections";
import { notify } from "../../../shared/lib/notify";

/**
 * ISH REJIMI — kalitlar va qo'lda ishga tushirish.
 *
 * Kalitlar QATOR-RO'YXAT (fG48Xv5X): Master, Kiruvchi webhook, Solishtiruvchi
 * (CRON). Master o'chiq bo'lsa quyi kalitlar ta'sir qilmaydi. Hamkorda faqat
 * Master bor — unda jarayon yo'q.
 *
 * NEGA KERAK BO'LDI. Bu amallar backendda bor edi, lekin UI'da HECH
 * QAYERDA yo'q: navbatni qo'lda yurgizish, yiqilganlarni qayta urinish,
 * aloqani tekshirish, solishtiruvni hoziroq yurgizish. Ya'ni CRON
 * kechikkanda yoki tashqi tizim tuzalganda operator kutishdan boshqa hech
 * nima qila olmasdi.
 *
 * ⚠️ MASTER IKKI JOYDA KO'RINADI (bu yerda va Xavfsizlikda) — lekin YOZUV
 * bitta joyda: ikkisi ham ayni `setActive`/`PATCH` ni chaqiradi.
 *
 * Master'ni O'CHIRISH (kalit yoki «To'xtatish») — faqat tasdiqlash oynasi
 * orqali (dizayn v2: nofaol qilish tasdiq bilan). Yoqish — darhol.
 *
 * Maket: `superadmin-integrations-panel-control`. Quyi kalitlar va
 * «Hoziroq tenglashtirish» maketda yo'q — Master qatori va «Qo'lda ishga
 * tushirish» qatorlari naqshida. Tasdiqlash oynasi —
 * `superadmin-integrations-rotate-key-dialog` naqshida.
 */

type SwitchKey = "master" | "webhook" | "reconcile";

// CODE-MAP `BTN` retsepti; chegara rangi har variantda alohida (ikki `border-*` rangi to'qnashmasin).
const BTN =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11 max-md:w-full";
const BTN_SECONDARY = `${BTN} border-border-strong bg-surface text-text hover:bg-sunken`;
const BTN_DANGER_SOFT = `${BTN} border-transparent bg-danger-soft text-danger-fg hover:bg-danger hover:text-on-solid`;
const BADGE =
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold leading-none before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']";

const StateBadge = ({ on, label }: { on: boolean; label: string }) => (
  <span className={`${BADGE} ${on ? "bg-success-soft text-success-fg" : "bg-sunken text-text-muted ring-1 ring-inset ring-border"}`}>
    {label}
  </span>
);

/** Kalit qatori: nom + holat tegi + oqibat izohi, o'ngda kalit (telefonda to'liq kenglik). */
const SwitchRow = ({
  id,
  icon,
  title,
  description,
  checked,
  busy,
  disabled,
  onLabel,
  offLabel,
  onToggle,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  busy: boolean;
  disabled: boolean;
  onLabel: string;
  offLabel: string;
  onToggle: (next: boolean) => void;
}) => (
  <div
    role="listitem"
    data-testid={`ctl-row-${id}`}
    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border p-5 first:border-t-0 max-md:p-4"
  >
    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`ctl-${id}`} className="flex items-center gap-2 text-sm font-semibold text-text">
          <span className="inline-flex text-text-muted">{icon}</span>
          {title}
        </h3>
        <StateBadge on={checked} label={checked ? onLabel : offLabel} />
      </div>
      <p id={`ctl-${id}-desc`} className="text-[13px] text-text-muted">
        {description}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      aria-describedby={`ctl-${id}-desc`}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className="group flex min-h-11 items-center justify-between gap-2.5 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed max-md:w-full"
    >
      <span className="text-[13px] font-semibold text-text">{checked ? onLabel : offLabel}</span>
      <span
        aria-hidden="true"
        className="relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 group-aria-checked:bg-action group-disabled:opacity-45"
      >
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4" />
      </span>
    </button>
  </div>
);

/** «Qo'lda ishga tushirish» qatori: izoh chapda, tugma o'ngda (telefonda ostida, to'liq kenglik). */
const ActionRow = ({
  description,
  label,
  icon,
  pending,
  onClick,
}: {
  description: string;
  label: string;
  icon: ReactNode;
  pending: boolean;
  onClick: () => void;
}) => (
  <div
    role="listitem"
    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border py-3"
  >
    <p className="min-w-0 flex-[1_1_280px] text-[13px] text-text-muted">{description}</p>
    <button
      type="button"
      title={description}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={onClick}
      className={`${BTN_SECONDARY} flex-none`}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {label}
    </button>
  </div>
);

/**
 * Master'ni o'chirishni tasdiqlash (CODE-MAP 2.8: overlay + `.el-dialog`,
 * telefonda pastki varaqa). Fokus avval «Bekor qilish» da, Escape — bekor.
 * Xavfli tugma `danger-soft`: to'liq `bg-danger` tungi mavzuda AA dan past (CODE-MAP 0.4).
 */
const ConfirmStopDialog = ({
  open,
  pending,
  connection,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  connection: Connection;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation("integrations");
  const titleId = useId();
  const textId = useId();
  const cancel = () => {
    if (!pending) onCancel();
  };
  const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: cancel, inertAppRoot: true });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-overlay p-6 max-md:items-end max-md:p-0">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={cancel}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        data-testid="ctl-confirm"
        className="relative flex w-full max-w-[460px] flex-col gap-4 rounded-[20px] border border-border bg-raised p-6 shadow-xl outline-none max-md:max-h-[92dvh] max-md:max-w-full max-md:overflow-auto max-md:rounded-b-none max-md:px-4 max-md:pb-6 max-md:pt-5"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-danger-soft text-danger-fg">
            <Power className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-text">
              {t("ctlConfirmTitle")}
            </h2>
            <p id={textId} className="text-[13px] text-text-muted">
              <span className="font-semibold text-text">{t("ctlConfirmLead")}</span>{" "}
              {connection.kind === "partner" ? t("ctlMasterPartner") : t("ctlMasterOutbound")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5">
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-surface text-text-muted">
            <Plug className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold text-text">{connection.name}</span>
            <span className="truncate text-[13px] text-text-muted">{connection.subtitle}</span>
          </span>
        </div>
        <p className="flex items-start gap-2 text-[13px] text-text-muted">
          <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          <span>{t("ctlStopDesc")}</span>
        </p>
        <div className="flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
          <button type="button" disabled={pending} onClick={cancel} className={BTN_SECONDARY}>
            {t("cancel", { ns: "common" })}
          </button>
          <button
            type="button"
            aria-busy={pending || undefined}
            disabled={pending}
            onClick={onConfirm}
            className={BTN_DANGER_SOFT}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t("ctlConfirmBtn")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const Note = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2.5 text-[13px] text-text-muted">
    <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const ConnectionControl = ({
  connection,
  onChanged,
}: {
  connection: Connection;
  onChanged: () => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const { setActive } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const healthcheck = useIntegrationHealthcheck();
  const processQueue = useProcessQueue();
  const retryFailed = useRetryFailed();
  const reconcileNow = useReconcileNow();
  const [pendingSwitch, setPendingSwitch] = useState<SwitchKey | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const isPartner = connection.kind === "partner";
  const raw = connection.raw as Record<string, unknown>;
  // Quyi kalitlar va oxirgi solishtiruv faqat `GET /integrations/:id` da.
  const detail = useGetIntegrationById(isPartner ? undefined : connection.id);
  const integration = detail.data?.data;

  /** PATCH — master yoki quyi kalit; javobdan keyin ro'yxat qayta o'qiladi. `true` — saqlandi. */
  const toggle = async (key: SwitchKey, next: boolean): Promise<boolean> => {
    setPendingSwitch(key);
    try {
      if (isPartner) {
        await setActive.mutateAsync({ id: connection.id, is_active: next });
      } else {
        const flag =
          key === "master" ? { is_active: next } : key === "webhook" ? { webhook_enabled: next } : { reconcile_enabled: next };
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: { slug: String(raw.slug ?? ""), type: String(raw.type ?? "api"), ...flag },
        });
      }
      notify.success(next ? t("ctlEnabled") : t("ctlDisabled"));
      onChanged();
      return true;
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("toggleFailed"));
      return false;
    } finally {
      setPendingSwitch(null);
    }
  };

  /** Master'ni o'chirish — avval tasdiq; yoqish darhol. */
  const requestMaster = (next: boolean) => {
    if (next) void toggle("master", true);
    else setConfirmStop(true);
  };

  // Xato bo'lsa oyna ochiq qoladi — operator qayta urinadi yoki bekor qiladi.
  const confirmMasterOff = async () => {
    if (await toggle("master", false)) setConfirmStop(false);
  };

  /** Amalni ishga tushirib, natijasini bir xil shaklda xabar qiladi. */
  const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
      notify.success(t("ctlDone", { label }));
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("ctlFailed", { label }));
    }
  };

  const runReconcile = async () => {
    const count = (value: number) => formatNumberLocalized(value, { language: i18n.language });
    try {
      const result = await reconcileNow.mutateAsync(connection.id);
      notify.success(
        t("ctlReconcileResult", {
          checked: count(result.checked),
          applied: count(result.applied),
          failed: count(result.failed),
        }),
      );
    } catch (error) {
      // 409 / 400 — sabab operatorga tushunarli tilda (backend matni inglizcha bo'lishi mumkin).
      const status = isAxiosError(error) ? error.response?.status : undefined;
      notify.error(
        status === 409
          ? t("ctlReconcileConflict")
          : status === 400
            ? t("ctlReconcileNoQuery")
            : getBackendErrorMessage(error) || t("ctlReconcileFailed"),
      );
    }
  };

  const switching = pendingSwitch !== null;
  const onLabel = t("ctlSwitchOn");
  const offLabel = t("ctlSwitchOff");
  const lastReconcile = integration?.last_reconcile_at;

  return (
    <section aria-label={t("tabControl")} className="min-w-0 rounded-[14px] border border-border bg-surface">
      {/* ═══════ KALITLAR ═══════ */}
      <div role="list" aria-label={t("tabControl")}>
        <SwitchRow
          id="master"
          icon={<Power className="size-[18px]" aria-hidden="true" />}
          title={t("ctlMasterKey")}
          description={isPartner ? t("ctlMasterPartner") : t("ctlMasterOutbound")}
          checked={connection.is_active}
          busy={pendingSwitch === "master"}
          disabled={switching}
          onLabel={onLabel}
          offLabel={offLabel}
          onToggle={requestMaster}
        />
        {!isPartner && typeof integration?.webhook_enabled === "boolean" && (
          <SwitchRow
            id="webhook"
            icon={<Webhook className="size-[18px]" aria-hidden="true" />}
            title={t("ctlWebhookKey")}
            description={t("ctlWebhookDesc")}
            checked={integration.webhook_enabled}
            busy={pendingSwitch === "webhook"}
            disabled={switching}
            onLabel={onLabel}
            offLabel={offLabel}
            onToggle={(next) => void toggle("webhook", next)}
          />
        )}
        {!isPartner && typeof integration?.reconcile_enabled === "boolean" && (
          <SwitchRow
            id="reconcile"
            icon={<GitCompareArrows className="size-[18px]" aria-hidden="true" />}
            title={t("ctlReconcileKey")}
            description={t("ctlReconcileDesc")}
            checked={integration.reconcile_enabled}
            busy={pendingSwitch === "reconcile"}
            disabled={switching}
            onLabel={onLabel}
            offLabel={offLabel}
            onToggle={(next) => void toggle("reconcile", next)}
          />
        )}
      </div>
      {!isPartner && (
        <div className="px-5 pb-5 max-md:px-4 max-md:pb-4">
          <Note>{t("ctlSubKeysNote")}</Note>
        </div>
      )}

      {/* ═══════ QO'LDA ISHGA TUSHIRISH ═══════ */}
      <div className="flex flex-col gap-4 border-t border-border p-5 max-md:p-4">
        <h3 className="text-sm font-semibold text-text">{t("ctlManualTitle")}</h3>
        {isPartner ? (
          /*
            Hamkorda jarayon YO'Q: hodisalar outbox orqali o'zi ketadi va
            har birini alohida "Hodisalar" bo'limidan qayta urinish mumkin.
            Soxta tugma qo'yishdan ko'ra shuni aytish to'g'ri.
          */
          <div role="note" className="flex items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-fg">
            <Info className="mt-0.5 size-[18px] flex-none" aria-hidden="true" />
            <div className="min-w-0 text-text">
              <div className="font-bold">{t("ctlNoManual")}</div>
              {t("ctlNoManualDesc")}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
              <div
                data-testid="ctl-last-reconcile"
                className="flex min-w-0 items-center gap-3 rounded-[10px] bg-sunken px-3.5 py-3"
              >
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-surface text-text-muted">
                  <History className="size-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="whitespace-nowrap text-base font-bold text-text">
                    {lastReconcile ? formatDateTimeLocalized(lastReconcile, { language: i18n.language }) : t("ctlNeverReconciled")}
                  </span>
                  <span className="truncate text-xs text-text-muted">{t("ctlLastReconcile")}</span>
                </span>
              </div>
            </div>

            <div role="list" className="flex flex-col">
              <ActionRow
                description={t("ctlQueueTip")}
                label={t("ctlQueueBtn")}
                icon={<Send className="size-4" aria-hidden="true" />}
                pending={processQueue.isPending}
                onClick={() => void run(t("ctlQueueAction"), () => processQueue.mutateAsync(connection.id))}
              />
              <ActionRow
                description={t("ctlRetryTip")}
                label={t("ctlRetryBtn")}
                icon={<RefreshCw className="size-4" aria-hidden="true" />}
                pending={retryFailed.isPending}
                onClick={() => void run(t("ctlRetryBtn"), () => retryFailed.mutateAsync(connection.id))}
              />
              <ActionRow
                description={t("ctlPingTip")}
                label={t("ctlPingBtn")}
                icon={<Activity className="size-4" aria-hidden="true" />}
                pending={healthcheck.isPending}
                onClick={() =>
                  void run(t("ctlPingBtn"), async () => {
                    const res = await healthcheck.mutateAsync(connection.id);
                    // ⚠️ Backend yiqilganda HTTP xato BERMAYDI — natijani
                    // `ok` bo'yicha o'qish kerak, aks holda "bajarildi"
                    // deb yolg'on xabar chiqardi.
                    if (!res.ok) {
                      throw new Error(res.message ?? `HTTP ${res.status ?? "—"}`);
                    }
                  })
                }
              />
              <ActionRow
                description={t("ctlReconcileNowDesc")}
                label={t("ctlReconcileNowBtn")}
                icon={<GitCompareArrows className="size-4" aria-hidden="true" />}
                pending={reconcileNow.isPending}
                onClick={() => void runReconcile()}
              />
            </div>

            <Note>
              {t("ctlQueueNoteA")} <b className="font-semibold text-text">{t("ctlQueueNoteBold")}</b>{" "}
              {t("ctlQueueNoteB")}
            </Note>
          </>
        )}
      </div>

      {/* ═══════ TO'XTATISH ═══════ — ulanish o'chiq bo'lsa yashiriladi (maket). */}
      {connection.is_active && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border p-5 max-md:p-4">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
            <h3 className="text-sm font-semibold text-danger-fg">{t("ctlStopTitle")}</h3>
            <p className="text-[13px] text-text-muted">{t("ctlStopDesc")}</p>
          </div>
          <button
            type="button"
            aria-busy={pendingSwitch === "master" || undefined}
            disabled={switching}
            onClick={() => setConfirmStop(true)}
            className={BTN_DANGER_SOFT}
          >
            {pendingSwitch === "master" ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Power className="size-4" aria-hidden="true" />
            )}
            {t("ctlStopBtn")}
          </button>
        </div>
      )}

      <ConfirmStopDialog
        open={confirmStop}
        pending={pendingSwitch === "master"}
        connection={connection}
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => void confirmMasterOff()}
      />
    </section>
  );
};

export default ConnectionControl;
