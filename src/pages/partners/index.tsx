import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Pencil,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { RootState } from "../../app/config/store";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import {
  usePartnerActions,
  usePartnerWebhooks,
  usePartners,
  type Partner,
  type PartnerWebhookRow,
} from "../../entities/partners";

/** Bu ekranga kimlar kira oladi — gateway guardi bilan bir xil. */
const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

type Message = { tone: "success" | "error" | "warn"; text: string };

const when = (value?: string | null) =>
  value ? new Date(value).toLocaleString("uz-UZ") : "—";

const STATUS_TONE: Record<string, string> = {
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  processing: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  permanently_failed: "bg-red-500/12 text-red-700 dark:text-red-300",
};

/**
 * HAMKORLAR (Partner API) — admin paneli.
 *
 * Nima uchun kerak: `admin/partners` da 4 endpoint bor edi, lekin SAHIFA yo'q
 * edi — ya'ni BeePost'ni ro'yxatga olish faqat Swagger orqali bajarilardi.
 *
 * Ikkinchi yarmi — WEBHOOK OUTBOX MONITORI. `partner_webhook_outbox` jadvalida
 * qatorlar bor edi, lekin UI yo'q edi: `permanently_failed` bo'lgan webhook
 * hech kimga ko'rinmasdi va hamkor tomondagi buyurtma jimgina eskirgan holatda
 * qolardi.
 *
 * ⚠️ API KALIT BIR MARTA. Bazada faqat sha256 hash saqlanadi, shu bois kalit
 * yaratish/rotatsiya javobida BIR MARTA ko'rsatiladi va qayta ko'rsatilmaydi.
 */
const PartnersPage = () => {
  const { t } = useTranslation("common");
  const role = useSelector((state: RootState) => state.role.role);
  const allowed = Boolean(role && ALLOWED_ROLES.has(role));

  const partnersQuery = usePartners();
  const { createPartner, updatePartner, rotateKey, setActive, retryWebhook } =
    usePartnerActions();

  const [message, setMessage] = useState<Message | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    webhook_url: "",
    webhook_secret: "",
    ip_allowlist: "",
  });
  /**
   * Tahrirlanayotgan hamkor.
   *
   * Sekret maydoni ATAYLAB bo'sh keladi: mavjud qiymat bizga qaytarilmaydi
   * (faqat shifrlangan holda saqlanadi). Bo'sh qoldirilsa tegilmaydi.
   */
  const [editing, setEditing] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    webhook_url: "",
    webhook_secret: "",
  });

  /** Bir martalik kalit — modal yopilgach BUTUNLAY yo'qoladi. */
  const [revealedKey, setRevealedKey] = useState<{
    name: string;
    key: string;
  } | null>(null);

  const [webhookPartner, setWebhookPartner] = useState<string>("");
  const [webhookStatus, setWebhookStatus] = useState<string>("all");
  const [webhookPage, setWebhookPage] = useState(1);
  const [payloadRow, setPayloadRow] = useState<PartnerWebhookRow | null>(null);

  const webhooksQuery = usePartnerWebhooks({
    partner_id: webhookPartner || undefined,
    status: webhookStatus,
    page: webhookPage,
    limit: 20,
  });

  const partners = useMemo(
    () => partnersQuery.data ?? [],
    [partnersQuery.data],
  );
  const webhooks = webhooksQuery.data?.data ?? [];
  const partnerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of partners) map.set(String(p.id), p.name);
    return map;
  }, [partners]);

  /** Backend aniq sababni aytadi — umumiy xabar operatorni ko'r qoldirardi. */
  const fail = (error: unknown, fallback: string) =>
    setMessage({
      tone: "error",
      text: getBackendErrorMessage(error) ?? fallback,
    });

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      setMessage({ tone: "warn", text: t("partnerNameRequired") });
      return;
    }
    try {
      const res = await createPartner.mutateAsync({
        name,
        webhook_url: form.webhook_url.trim() || undefined,
        webhook_secret: form.webhook_secret.trim() || undefined,
        ip_allowlist: form.ip_allowlist
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setCreateOpen(false);
      setForm({ name: "", webhook_url: "", webhook_secret: "", ip_allowlist: "" });
      if (res?.api_key) setRevealedKey({ name, key: res.api_key });
      setMessage({ tone: "success", text: t("partnerCreated") });
    } catch (error) {
      fail(error, t("partnerCreateFailed"));
    }
  };

  const openEdit = (partner: Partner) => {
    setEditing(partner);
    setEditForm({
      name: partner.name ?? "",
      webhook_url: partner.webhook_url ?? "",
      webhook_secret: "",
    });
  };

  const handleEdit = async () => {
    if (!editing) return;
    /**
     * FAQAT O'ZGARGAN maydonlar yuboriladi. Aks holda tegilmagan maydon ham
     * jo'natilib, backendning "berilmasa tegilmaydi" qoidasi ma'nosini
     * yo'qotardi — masalan sekret bo'sh yuborilib, ishlab turgan imzo
     * o'chib ketardi.
     */
    const dto: Record<string, string> = {};
    if (editForm.name.trim() !== (editing.name ?? "")) {
      dto.name = editForm.name.trim();
    }
    if (editForm.webhook_url.trim() !== (editing.webhook_url ?? "")) {
      dto.webhook_url = editForm.webhook_url.trim();
    }
    if (editForm.webhook_secret.trim()) {
      dto.webhook_secret = editForm.webhook_secret.trim();
    }

    if (!Object.keys(dto).length) {
      setEditing(null);
      return;
    }

    try {
      await updatePartner.mutateAsync({ id: String(editing.id), dto });
      setMessage({ tone: "success", text: t("partnerUpdated") });
      setEditing(null);
    } catch (error) {
      fail(error, t("partnerUpdateFailed"));
    }
  };

  const handleRotate = (partner: Partner) => {
    if (!window.confirm(t("partnerRotateConfirm"))) return;
    void (async () => {
      try {
        const res = await rotateKey.mutateAsync(String(partner.id));
        if (res?.api_key)
          setRevealedKey({ name: partner.name, key: res.api_key });
        setMessage({ tone: "success", text: t("partnerKeyRotated") });
      } catch (error) {
        fail(error, t("partnerRotateFailed"));
      }
    })();
  };

  const handleToggle = (partner: Partner) => {
    void (async () => {
      try {
        await setActive.mutateAsync({
          id: String(partner.id),
          is_active: !partner.is_active,
        });
        setMessage({
          tone: "success",
          text: partner.is_active
            ? t("partnerDisabled")
            : t("partnerEnabled"),
        });
      } catch (error) {
        fail(error, t("partnerStatusChangeFailed"));
      }
    })();
  };

  const handleRetry = (row: PartnerWebhookRow) => {
    void (async () => {
      try {
        await retryWebhook.mutateAsync(String(row.id));
        setMessage({ tone: "success", text: t("partnerWebhookRetried") });
      } catch (error) {
        fail(error, t("partnerWebhookRetryFailed"));
      }
    })();
  };

  const copyKey = (key: string) => {
    void navigator.clipboard?.writeText(key);
    setMessage({ tone: "success", text: t("partnerKeyCopied") });
  };

  if (!allowed) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="m-0 text-sm font-semibold text-[color:var(--color-text-muted)]">
          {t("partnerNoAccess")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ═══════ Sarlavha ═══════ */}
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-main/10 text-main">
              <Plug size={20} />
            </span>
            <div>
              <h1 className="m-0 text-lg font-extrabold text-maindark dark:text-white">
                {t("partnersTitle")}
              </h1>
              <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("partnersSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-main px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              <Plus size={16} />
              {t("partnerCreate")}
            </button>
            <button
              type="button"
              onClick={() => void partnersQuery.refetch()}
              disabled={partnersQuery.isFetching}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] text-maindark transition hover:bg-main/5 disabled:opacity-50 dark:text-white"
              title={t("refresh")}
            >
              <RefreshCw
                size={18}
                className={partnersQuery.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {message ? (
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              message.tone === "success"
                ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                : message.tone === "warn"
                  ? "border-amber-400/30 bg-amber-500/12 text-amber-700 dark:text-amber-200"
                  : "border-red-400/30 bg-red-500/12 text-red-700 dark:text-red-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {message.tone === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              )}
              <span className="[overflow-wrap:anywhere]">{message.text}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ═══════ Hamkorlar ro'yxati ═══════ */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-primary shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        {partnersQuery.isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="animate-spin text-main" size={28} />
          </div>
        ) : partners.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
            <Plug size={32} className="text-[color:var(--color-text-muted)]" />
            <p className="m-0 text-sm font-semibold text-[color:var(--color-text-muted)]">
              {t("partnersEmpty")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border-soft)] dark:divide-white/10">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="m-0 text-sm font-extrabold text-maindark dark:text-white">
                    {partner.name}
                  </p>
                  <p className="m-0 text-xs text-[color:var(--color-text-muted)] [overflow-wrap:anywhere]">
                    {partner.webhook_url || t("partnerNoWebhookUrl")}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    partner.is_active
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/12 text-red-700 dark:text-red-300"
                  }`}
                >
                  {partner.is_active ? t("partnerActive") : t("partnerDisabledTag")}
                </span>

                {/* Webhook xulosasi — hamkor "tirikmi" degan savolga javob. */}
                <div className="w-44 shrink-0 text-xs">
                  <p className="m-0 text-[color:var(--color-text-muted)]">
                    {t("partnerLastDelivery")}:{" "}
                    {when(partner.webhooks?.last_delivered_at)}
                  </p>
                  <p className="m-0 mt-0.5 flex gap-2 font-bold">
                    <span className="text-amber-600 dark:text-amber-400">
                      ⏳ {partner.webhooks?.pending ?? 0}
                    </span>
                    <span
                      className={
                        (partner.webhooks?.failed ?? 0) > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-[color:var(--color-text-muted)]"
                      }
                    >
                      ✕ {partner.webhooks?.failed ?? 0}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(partner)}
                    title={t("partnerEdit")}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark transition hover:bg-main/5 dark:text-white"
                  >
                    <Pencil size={14} />
                    {t("partnerEdit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotate(partner)}
                    disabled={rotateKey.isPending}
                    title={t("partnerRotateKey")}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark transition hover:bg-main/5 disabled:opacity-50 dark:text-white"
                  >
                    <KeyRound size={14} />
                    {t("partnerRotateKey")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(partner)}
                    disabled={setActive.isPending}
                    className={`flex h-9 items-center rounded-xl px-3 text-xs font-bold text-white transition disabled:opacity-50 ${
                      partner.is_active
                        ? "bg-red-600 hover:bg-red-500"
                        : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                  >
                    {partner.is_active ? t("partnerDisable") : t("partnerEnable")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ Webhook outbox monitori ═══════ */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-primary shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3 dark:border-white/10">
          <h2 className="m-0 text-sm font-extrabold uppercase tracking-[0.14em] text-maindark dark:text-white">
            {t("partnerWebhookLog")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={webhookPartner}
              onChange={(e) => {
                setWebhookPartner(e.target.value);
                setWebhookPage(1);
              }}
              className="h-9 rounded-xl border border-[color:var(--color-border-soft)] bg-white px-3 text-xs font-semibold text-maindark dark:bg-white/[0.04] dark:text-white"
            >
              <option value="">{t("partnerAllPartners")}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={webhookStatus}
              onChange={(e) => {
                setWebhookStatus(e.target.value);
                setWebhookPage(1);
              }}
              className="h-9 rounded-xl border border-[color:var(--color-border-soft)] bg-white px-3 text-xs font-semibold text-maindark dark:bg-white/[0.04] dark:text-white"
            >
              <option value="all">{t("partnerAllStatuses")}</option>
              <option value="pending">{t("partnerStatusPending")}</option>
              <option value="processing">{t("partnerStatusProcessing")}</option>
              <option value="completed">{t("partnerStatusCompleted")}</option>
              <option value="permanently_failed">
                {t("partnerStatusFailed")}
              </option>
            </select>
            <button
              type="button"
              onClick={() => void webhooksQuery.refetch()}
              disabled={webhooksQuery.isFetching}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-border-soft)] text-maindark transition hover:bg-main/5 disabled:opacity-50 dark:text-white"
              title={t("refresh")}
            >
              <RefreshCw
                size={15}
                className={webhooksQuery.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {webhooksQuery.isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Loader2 className="animate-spin text-main" size={24} />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <p className="m-0 text-sm font-semibold text-[color:var(--color-text-muted)]">
              {t("partnerWebhookEmpty")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border-soft)] dark:divide-white/10">
            {webhooks.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    STATUS_TONE[row.status] ??
                    "bg-white/10 text-[color:var(--color-text-muted)]"
                  }`}
                >
                  {row.status}
                </span>
                <p className="m-0 w-32 shrink-0 text-xs font-semibold text-maindark dark:text-white">
                  {partnerNames.get(String(row.partner_id)) ?? row.partner_id}
                </p>
                <p className="m-0 w-28 shrink-0 font-mono text-xs text-[color:var(--color-text-muted)]">
                  {row.new_status ?? row.event_type}
                </p>
                <p className="m-0 w-40 shrink-0 font-mono text-xs text-[color:var(--color-text-muted)] [overflow-wrap:anywhere]">
                  {row.external_order_id}
                </p>
                <p className="m-0 w-20 shrink-0 text-xs text-[color:var(--color-text-muted)]">
                  {row.attempts}/{row.max_attempts}
                </p>
                <p className="m-0 min-w-[8rem] flex-1 text-xs text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">
                  {row.last_error ?? ""}
                </p>
                <p className="m-0 w-40 shrink-0 text-xs text-[color:var(--color-text-muted)]">
                  {when(row.delivered_at ?? row.created_at)}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayloadRow(row)}
                    className="h-8 rounded-lg border border-[color:var(--color-border-soft)] px-2.5 text-xs font-bold text-maindark transition hover:bg-main/5 dark:text-white"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetry(row)}
                    disabled={
                      row.status === "completed" || retryWebhook.isPending
                    }
                    title={t("partnerWebhookRetry")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-main text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(webhooksQuery.data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-[color:var(--color-border-soft)] px-4 py-3 dark:border-white/10">
            <button
              type="button"
              disabled={webhookPage <= 1}
              onClick={() => setWebhookPage((p) => Math.max(1, p - 1))}
              className="h-9 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark disabled:opacity-40 dark:text-white"
            >
              ‹
            </button>
            <span className="text-xs font-bold text-[color:var(--color-text-muted)]">
              {webhookPage} / {webhooksQuery.data?.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={webhookPage >= (webhooksQuery.data?.totalPages ?? 1)}
              onClick={() => setWebhookPage((p) => p + 1)}
              className="h-9 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark disabled:opacity-40 dark:text-white"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ═══════ Yaratish modali ═══════ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-primary p-5 shadow-2xl dark:bg-primarydark">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base font-extrabold text-maindark dark:text-white">
                {t("partnerCreate")}
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-[color:var(--color-text-muted)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {(
                [
                  ["name", t("partnerName"), "BeePost"],
                  ["webhook_url", t("partnerWebhookUrl"), "https://..."],
                  ["webhook_secret", t("partnerWebhookSecret"), "HMAC-SHA256"],
                  ["ip_allowlist", t("partnerIpAllowlist"), "1.2.3.4, 5.6.7.8"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                    {label}
                  </span>
                  <input
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-11 rounded-2xl border border-[color:var(--color-border-soft)] px-4 text-sm font-bold text-maindark dark:text-white"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createPartner.isPending}
                className="flex h-11 items-center gap-2 rounded-2xl bg-main px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                {createPartner.isPending && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Tahrirlash modali ═══════ */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-primary p-5 shadow-2xl dark:bg-primarydark">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base font-extrabold text-maindark dark:text-white">
                {editing.name} — {t("partnerEdit")}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-[color:var(--color-text-muted)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                  {t("partnerName")}
                </span>
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                  {t("partnerWebhookUrl")}
                </span>
                <input
                  value={editForm.webhook_url}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, webhook_url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white"
                />
                <span className="text-[11px] text-[color:var(--color-text-muted)]">
                  {t("partnerWebhookUrlHint")}
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                  {t("partnerWebhookSecret")}
                </span>
                <input
                  type="password"
                  value={editForm.webhook_secret}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      webhook_secret: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white"
                />
                <span className="text-[11px] text-[color:var(--color-text-muted)]">
                  {t("partnerSecretHint")}
                </span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-11 rounded-2xl border border-[color:var(--color-border-soft)] px-4 text-sm font-bold text-maindark dark:text-white"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={updatePartner.isPending}
                className="flex h-11 items-center gap-2 rounded-2xl bg-main px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                {updatePartner.isPending && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ BIR MARTALIK kalit ═══════ */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-primary p-5 shadow-2xl dark:bg-primarydark">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600">
                <ShieldAlert size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-base font-extrabold text-maindark dark:text-white">
                  {revealedKey.name} — {t("partnerApiKey")}
                </h3>
                <p className="m-0 mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {t("partnerKeyOnceWarning")}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 dark:bg-white/[0.04]">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-maindark dark:text-white">
                {revealedKey.key}
              </code>
              <button
                type="button"
                onClick={() => copyKey(revealedKey.key)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-main px-3 text-xs font-bold text-white"
              >
                <Copy size={14} />
                {t("partnerCopy")}
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="h-11 rounded-2xl bg-maindark px-5 text-sm font-bold text-white dark:bg-white dark:text-maindark"
              >
                {t("partnerKeySaved")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Payload ko'rish ═══════ */}
      {payloadRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-[24px] bg-primary p-5 shadow-2xl dark:bg-primarydark">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base font-extrabold text-maindark dark:text-white">
                {t("partnerWebhookPayload")}
              </h3>
              <button
                type="button"
                onClick={() => setPayloadRow(null)}
                className="text-[color:var(--color-text-muted)]"
              >
                <X size={20} />
              </button>
            </div>
            <pre className="mt-3 max-h-[60vh] overflow-auto rounded-2xl bg-black/5 p-3 text-xs text-maindark dark:bg-white/5 dark:text-white">
              {JSON.stringify(payloadRow.payload ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnersPage;
