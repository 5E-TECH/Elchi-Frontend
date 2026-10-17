// dizayn-v2: superadmin-integrations-legacy-partners, admin-integrations-legacy-partners
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { FileText, Handshake, Info, KeyRound, Lock, Pencil, Plus, Power, RefreshCw, Send, TriangleAlert } from "lucide-react";
import type { RootState } from "../../app/config/store";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { cx } from "../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  SkeletonTable,
  StatusBadge,
  TextInput,
  TONE_SOFT,
  useConfirm,
  type DataTableColumn,
  type SelectOption,
  type Tone,
} from "../../shared/ui/primitives";
import {
  usePartnerActions,
  usePartnerWebhooks,
  usePartners,
  type Partner,
  type PartnerWebhookRow,
  type WebhookTestResult,
} from "../../entities/partners";

/** Bu ekranga kimlar kira oladi — gateway guardi bilan bir xil. */
const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

/** Hodisa holati → badge (yorliqlar `integrations` dagi yetkazish holatlari bilan bir xil). */
const STATUS_TAG: Record<string, { tone: Tone; labelKey: string }> = {
  completed: { tone: "success", labelKey: "deliveryDelivered" },
  pending: { tone: "warning", labelKey: "deliveryQueued" },
  processing: { tone: "warning", labelKey: "deliverySending" },
  /**
   * `webhook_url` sozlanmagan — hodisa KUTIB turadi, yo'qolmaydi. Ko'k (info) ataylab: bu XATO emas,
   * sozlama kutilayotgan holat.
   */
  awaiting_config: { tone: "info", labelKey: "deliveryAwaitingConfig" },
  permanently_failed: { tone: "danger", labelKey: "deliveryFailed" },
};

const STATUS_FILTERS = ["pending", "processing", "completed", "awaiting_config", "permanently_failed"] as const;

const ORDER_STATUS_KEY: Record<string, string> = {
  created: "statusCreated",
  new: "statusNew",
  received: "statusReceived",
  "on the road": "statusOnTheRoad",
  waiting: "statusWaiting",
  sold: "statusSold",
  cancelled: "statusCancelled",
  "cancelled (sent)": "statusCancelledSent",
  paid: "statusPaid",
  partly_paid: "statusPartlyPaid",
  closed: "statusClosed",
};

const PAGE_SIZE = 20;

/**
 * API HAMKORLARI (eski sahifa, zaxira) — maket `*-integrations-legacy-partners`.
 *
 * Nima uchun kerak: `admin/partners` da 4 endpoint bor edi, lekin SAHIFA yo'q edi — BeePost'ni ro'yxatga
 * olish faqat Swagger orqali bajarilardi. Ikkinchi yarmi — WEBHOOK OUTBOX MONITORI: `permanently_failed`
 * bo'lgan webhook hech kimga ko'rinmasdi.
 *
 * ⚠️ API KALIT BIR MARTA. Bazada faqat sha256 hash saqlanadi, shu bois kalit yaratish/rotatsiya javobida
 * BIR MARTA ko'rsatiladi va qayta ko'rsatilmaydi.
 */
const PartnersPage = () => {
  const { t, i18n } = useTranslation(["integrations", "common", "orders"]);
  const language = i18n.language;
  const tc = (key: string, options?: Record<string, unknown>) => t(key, { ns: "common", ...options });
  const num = (value: number) => formatNumberLocalized(value, { language });
  const role = useSelector((state: RootState) => state.role.role);
  const allowed = Boolean(role && ALLOWED_ROLES.has(role));

  const confirm = useConfirm();
  const partnersQuery = usePartners();
  const { createPartner, updatePartner, rotateKey, setActive, retryWebhook, testWebhook } = usePartnerActions();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", webhook_url: "", webhook_secret: "", ip_allowlist: "" });
  const [formTouched, setFormTouched] = useState(false);
  /**
   * Tahrirlanayotgan hamkor. Sekret maydoni ATAYLAB bo'sh keladi: mavjud qiymat bizga qaytarilmaydi.
   * Bo'sh qoldirilsa tegilmaydi.
   */
  const [editing, setEditing] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState({ name: "", webhook_url: "", webhook_secret: "" });
  /** Sinov webhooki natijasi — oyna ichida ko'rsatiladi. */
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  /** Bir martalik kalit — oyna yopilgach BUTUNLAY yo'qoladi. */
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null);

  const [webhookPartner, setWebhookPartner] = useState<string>("");
  const [webhookStatus, setWebhookStatus] = useState<string>("all");
  const [webhookPage, setWebhookPage] = useState(1);
  const [openPayload, setOpenPayload] = useState<string | null>(null);

  const webhooksQuery = usePartnerWebhooks({
    partner_id: webhookPartner || undefined,
    status: webhookStatus,
    page: webhookPage,
    limit: PAGE_SIZE,
  });

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const webhooks = webhooksQuery.data?.data ?? [];
  const partnerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of partners) map.set(String(p.id), p.name);
    return map;
  }, [partners]);

  /** Backend aniq sababni aytadi — umumiy xabar operatorni ko'r qoldirardi. */
  const fail = (error: unknown, fallback: string) => notify.error(getBackendErrorMessage(error) ?? fallback);

  const closeCreate = () => {
    setCreateOpen(false);
    setFormTouched(false);
    setForm({ name: "", webhook_url: "", webhook_secret: "", ip_allowlist: "" });
  };

  const handleCreate = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormTouched(true);
    const name = form.name.trim();
    if (!name || createPartner.isPending) return;
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
      closeCreate();
      if (res?.api_key) setRevealedKey({ name, key: res.api_key });
      notify.success(tc("partnerCreated"));
    } catch (error) {
      fail(error, tc("partnerCreateFailed"));
    }
  };

  const openEdit = (partner: Partner) => {
    setEditing(partner);
    setTestResult(null);
    setEditForm({ name: partner.name ?? "", webhook_url: partner.webhook_url ?? "", webhook_secret: "" });
  };

  const handleEdit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editing || updatePartner.isPending) return;
    /**
     * FAQAT O'ZGARGAN maydonlar yuboriladi. Aks holda tegilmagan maydon ham jo'natilib, backendning
     * «berilmasa tegilmaydi» qoidasi ma'nosini yo'qotardi — masalan sekret bo'sh yuborilib, imzo o'chib ketardi.
     */
    const dto: Record<string, string> = {};
    if (editForm.name.trim() !== (editing.name ?? "")) dto.name = editForm.name.trim();
    if (editForm.webhook_url.trim() !== (editing.webhook_url ?? "")) dto.webhook_url = editForm.webhook_url.trim();
    if (editForm.webhook_secret.trim()) dto.webhook_secret = editForm.webhook_secret.trim();

    if (!Object.keys(dto).length) {
      setEditing(null);
      return;
    }

    try {
      const res = await updatePartner.mutateAsync({ id: String(editing.id), dto });
      /**
       * `webhook_url` qo'yilganda backend kutib turgan hodisalarni navbatga qaytaradi — bu son JIM o'tmasin.
       */
      const requeued = Number((res as { data?: { requeued_webhooks?: number } })?.data?.requeued_webhooks ?? 0);
      notify.success(requeued ? t("legacyPartners.updatedRequeued", { count: requeued }) : tc("partnerUpdated"));
      setEditing(null);
    } catch (error) {
      fail(error, tc("partnerUpdateFailed"));
    }
  };

  /**
   * SINOV WEBHOOKI. Formadagi manzil bilan sinaydi — ya'ni SAQLASHDAN OLDIN tekshirish mumkin. Natija oyna
   * ichida qoladi: operator uni manzil bilan yonma-yon ko'rishi kerak.
   */
  const handleTestWebhook = async () => {
    if (!editing) return;
    setTestResult(null);
    try {
      const res = await testWebhook.mutateAsync({ id: String(editing.id), url: editForm.webhook_url.trim() || undefined });
      setTestResult(res);
    } catch (error) {
      fail(error, t("legacyPartners.testFailed"));
    }
  };

  // Kirish huquqini o'zgartiradi (eski kalit darhol ishlamay qoladi) — tasdiqlash oynasi orqali.
  const handleRotate = async (partner: Partner) => {
    const ok = await confirm({
      tone: "danger",
      title: tc("partnerRotateKey"),
      description: tc("partnerRotateText"),
      details: partner.name,
      note: tc("partnerRotateNote"),
      // Maket `superadmin-integrations-rotate-key-dialog`: «Ha, yangilash».
      confirmLabel: tc("partnerRotateOk"),
      icon: KeyRound,
      confirmIcon: KeyRound,
    });
    if (!ok) return;
    try {
      const res = await rotateKey.mutateAsync(String(partner.id));
      if (res?.api_key) setRevealedKey({ name: partner.name, key: res.api_key });
      notify.success(tc("partnerKeyRotated"));
    } catch (error) {
      fail(error, tc("partnerRotateFailed"));
    }
  };

  // Hamkorni to'xtatish kirish huquqini oladi — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8).
  // Yoqish — darhol (§8: faollashtirish ataylab tasdiqsiz; «Ish rejimi» panelidagi kalit ham shunday).
  const handleToggle = async (partner: Partner) => {
    if (partner.is_active) {
      const ok = await confirm({
        tone: "danger",
        title: tc("partnerDisableTitle"),
        description: tc("partnerDisableText"),
        details: partner.name,
        confirmLabel: t("legacyPartners.stop"),
        icon: Power,
        confirmIcon: Power,
      });
      if (!ok) return;
    }
    try {
      await setActive.mutateAsync({ id: String(partner.id), is_active: !partner.is_active });
      notify.success(partner.is_active ? tc("partnerDisabled") : tc("partnerEnabled"));
    } catch (error) {
      fail(error, tc("partnerStatusChangeFailed"));
    }
  };

  const handleRetry = (row: PartnerWebhookRow) => {
    void (async () => {
      try {
        await retryWebhook.mutateAsync(String(row.id));
        notify.success(tc("partnerWebhookRetried"));
      } catch (error) {
        fail(error, tc("partnerWebhookRetryFailed"));
      }
    })();
  };

  const copyKey = (key: string) => {
    void copyToClipboard(key).then((copied) =>
      copied ? notify.success(tc("partnerKeyCopied")) : notify.error(tc("partnerKeyCopyFailed")),
    );
  };

  if (!allowed) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader back="/integrations" backLabel={t("pageTitle")} title={t("legacyPartners.title")} />
        <Card padding="none">
          <EmptyState icon={Lock} title={tc("partnerNoAccess")} />
        </Card>
      </div>
    );
  }

  /* ─── Hamkorlar jadvali ─── */
  const webhookSummary = (partner: Partner) => {
    const pending = partner.webhooks?.pending ?? 0;
    const failed = partner.webhooks?.failed ?? 0;
    if (!pending && !failed) return null;
    return (
      <span className="flex flex-col items-start text-[13px]">
        {pending ? <span className="text-warning-fg">{t("legacyPartners.queued", { count: num(pending) })}</span> : null}
        {failed ? <span className="text-danger-fg">{t("legacyPartners.failed", { count: num(failed) })}</span> : null}
      </span>
    );
  };
  const lastDelivery = (partner: Partner) => formatDateTimeLocalized(partner.webhooks?.last_delivered_at, { language });
  const toggleButton = (partner: Partner) =>
    partner.is_active ? (
      <Button variant="danger-soft" size="sm" leftIcon={Power} disabled={setActive.isPending} onClick={() => void handleToggle(partner)} className="max-md:min-h-11">
        {t("legacyPartners.stop")}
      </Button>
    ) : (
      <Button variant="secondary" size="sm" leftIcon={Power} disabled={setActive.isPending} onClick={() => void handleToggle(partner)} className="max-md:min-h-11">
        {tc("partnerEnable")}
      </Button>
    );

  const partnerColumns: DataTableColumn<Partner>[] = [
    {
      id: "name",
      header: t("legacyPartners.colPartner"),
      cell: (p) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{p.name}</span>
          <span className={cx("max-w-[360px] truncate text-xs", p.webhook_url ? "text-text-muted" : "text-warning-fg")}>
            {p.webhook_url || tc("partnerNoWebhookUrl")}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (p) => <StatusBadge tone={p.is_active ? "success" : "neutral"} label={p.is_active ? tc("partnerActive") : tc("partnerDisabledTag")} />,
    },
    { id: "webhooks", header: t("legacyPartners.colWebhooks"), cell: (p) => webhookSummary(p) ?? <span className="text-text-muted">—</span> },
    { id: "last", header: tc("partnerLastDelivery"), hideBelow: "lg", cell: (p) => <span className="whitespace-nowrap">{lastDelivery(p)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{t("console.colActions")}</span>,
      align: "end",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton size="sm" icon={Pencil} label={t("legacyPartners.editAria", { name: p.name })} onClick={() => openEdit(p)} />
          <IconButton
            size="sm"
            icon={KeyRound}
            label={t("legacyPartners.rotateAria", { name: p.name })}
            disabled={rotateKey.isPending}
            onClick={() => void handleRotate(p)}
          />
          {toggleButton(p)}
        </div>
      ),
    },
  ];

  /* ─── Webhook jurnali ─── */
  const eventLabel = (row: PartnerWebhookRow) => {
    const key = row.new_status ? ORDER_STATUS_KEY[row.new_status] : undefined;
    return key ? t(key, { ns: "orders" }) : (row.new_status ?? row.event_type ?? "—");
  };
  const statusBadge = (row: PartnerWebhookRow) => {
    const tag = STATUS_TAG[row.status];
    // Xom kalit («awaiting_config») chalkashtiradi — o'zbekcha yorliq ko'rsatiladi.
    return <StatusBadge tone={tag?.tone ?? "neutral"} label={tag ? t(tag.labelKey) : row.status} />;
  };
  const attemptsText = (row: PartnerWebhookRow) => `${num(row.attempts ?? 0)}/${num(row.max_attempts ?? 0)}`;
  const payloadToggle = (row: PartnerWebhookRow, asButton: boolean) => {
    const open = openPayload === String(row.id);
    const panelId = `partner-payload-${row.id}`;
    return asButton ? (
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpenPayload(open ? null : String(row.id))}
        className="max-md:min-h-11"
      >
        {t("legacyPartners.payloadShort")}
      </Button>
    ) : (
      <IconButton
        size="sm"
        icon={FileText}
        label={t("legacyPartners.payloadAria", { ref: row.external_order_id })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpenPayload(open ? null : String(row.id))}
      />
    );
  };
  const retryControl = (row: PartnerWebhookRow, asButton: boolean) => {
    const done = row.status === "completed";
    if (asButton) {
      return done ? null : (
        <Button variant="secondary" size="sm" disabled={retryWebhook.isPending} onClick={() => handleRetry(row)} className="max-md:min-h-11">
          {tc("partnerWebhookRetry")}
        </Button>
      );
    }
    return (
      <IconButton
        size="sm"
        icon={RefreshCw}
        label={t(done ? "legacyPartners.retryNotNeededAria" : "legacyPartners.retryAria", { ref: row.external_order_id })}
        disabled={done || retryWebhook.isPending}
        onClick={() => handleRetry(row)}
      />
    );
  };

  const journalColumns: DataTableColumn<PartnerWebhookRow>[] = [
    {
      id: "event",
      header: t("colEvent"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{eventLabel(row)}</span>
          <span className="font-mono text-xs text-text-muted">
            {row.external_order_id}
            <span className="lg:hidden"> · {partnerNames.get(String(row.partner_id)) ?? row.partner_id}</span>
          </span>
        </div>
      ),
    },
    { id: "partner", header: t("legacyPartners.colPartner"), hideBelow: "lg", cell: (row) => partnerNames.get(String(row.partner_id)) ?? row.partner_id },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          {statusBadge(row)}
          {row.last_error ? <span className="line-clamp-2 max-w-[260px] [overflow-wrap:anywhere] text-xs text-danger-fg lg:hidden">{row.last_error}</span> : null}
        </div>
      ),
    },
    { id: "attempts", header: t("colAttempt"), align: "end", cell: (row) => <span className="tabular-nums">{attemptsText(row)}</span> },
    {
      id: "error",
      header: t("colError"),
      hideBelow: "lg",
      cell: (row) =>
        row.last_error ? (
          <span title={row.last_error} className="line-clamp-2 max-w-[280px] [overflow-wrap:anywhere] text-[13px] text-danger-fg">
            {row.last_error}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: "time",
      header: t("colTime"),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTimeLocalized(row.delivered_at ?? row.created_at, { language })}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("console.colActions")}</span>,
      align: "end",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {payloadToggle(row, false)}
          {retryControl(row, false)}
        </div>
      ),
    },
  ];

  const payloadPanel = (row: PartnerWebhookRow) => (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">{t("legacyPartners.payloadTitle")}</span>
        <span className="text-xs text-text-muted">
          {row.status === "permanently_failed"
            ? t("legacyPartners.stoppedAfter", { count: num(row.attempts ?? 0) })
            : t("legacyPartners.createdAt", { at: formatDateTimeLocalized(row.created_at, { language }) })}
        </span>
      </div>
      <pre className="max-h-72 overflow-auto rounded-[10px] border border-border bg-surface p-3 font-mono text-xs leading-5 text-text">
        {JSON.stringify(row.payload ?? {}, null, 2)}
      </pre>
    </div>
  );

  const statusOptions: SelectOption[] = [
    { value: "all", label: tc("partnerAllStatuses") },
    ...STATUS_FILTERS.map((s) => ({ value: s, label: t(STATUS_TAG[s].labelKey) })),
  ];
  const partnerOptions: SelectOption[] = [
    { value: "", label: tc("partnerAllPartners") },
    ...partners.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const total = webhooksQuery.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/integrations"
        backLabel={t("pageTitle")}
        title={t("legacyPartners.title")}
        meta={
          <Badge title={t("legacyPartners.legacyHint")}>{t("legacyPartners.legacyBadge")}</Badge>
        }
        description={tc("partnersSubtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={RefreshCw}
              loading={partnersQuery.isFetching && !partnersQuery.isLoading}
              onClick={() => void partnersQuery.refetch()}
            >
              {t("refresh")}
            </Button>
            <Button leftIcon={Plus} onClick={() => setCreateOpen(true)}>
              {t("scPartnerNew")}
            </Button>
          </>
        }
      />

      {/* ═══ Hamkorlar ro'yxati ═══ */}
      <Card
        padding="none"
        title={t("navPartners")}
        titleAddon={!partnersQuery.isLoading && !partnersQuery.isError ? <Badge>{t("console.countTa", { count: num(partners.length) })}</Badge> : null}
      >
        <QueryBoundary
          query={{
            data: partnersQuery.data ? partners : undefined,
            isLoading: partnersQuery.isLoading,
            isError: partnersQuery.isError,
            error: partnersQuery.error,
            refetch: partnersQuery.refetch,
          }}
          loading={<SkeletonTable framed={false} rows={3} columns={[t("legacyPartners.colPartner"), t("colStatus"), t("legacyPartners.colWebhooks")]} />}
          empty={
            <EmptyState
              icon={Handshake}
              title={tc("partnersEmpty")}
              description={t("legacyPartners.emptyHint")}
              action={
                <Button variant="secondary" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
                  {t("scPartnerNew")}
                </Button>
              }
            />
          }
          // Xato «hamkor yo'q» bilan bir xil ko'rinmasligi kerak.
          error={(error, retry) => <ErrorState error={error} description={getBackendErrorMessage(error)} onRetry={retry} />}
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={partnerColumns}
              getRowKey={(p) => String(p.id)}
              label={t("navPartners")}
              density="tablet-tight"
              busy={isRefetching}
              renderCard={(p) => (
                <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <StatusBadge tone={p.is_active ? "success" : "neutral"} label={p.is_active ? tc("partnerActive") : tc("partnerDisabledTag")} />
                  </span>
                  <span className={cx("text-xs [overflow-wrap:anywhere]", p.webhook_url ? "text-text-muted" : "text-warning-fg")}>
                    {p.webhook_url || tc("partnerNoWebhookUrl")}
                  </span>
                  <span className="text-xs text-text-muted">
                    {[
                      `${tc("partnerLastDelivery")}: ${lastDelivery(p)}`,
                      p.webhooks?.pending ? t("legacyPartners.queued", { count: num(p.webhooks.pending) }) : null,
                      p.webhooks?.failed ? t("legacyPartners.failed", { count: num(p.webhooks.failed) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <IconButton variant="secondary" icon={Pencil} label={t("legacyPartners.editAria", { name: p.name })} onClick={() => openEdit(p)} />
                    <Button variant="danger-soft" size="sm" leftIcon={KeyRound} disabled={rotateKey.isPending} onClick={() => void handleRotate(p)} className="min-h-11">
                      {tc("partnerRotateKey")}
                    </Button>
                    {toggleButton(p)}
                  </span>
                </div>
              )}
            />
          )}
        </QueryBoundary>
      </Card>

      {/* ═══ Webhook yetkazish jurnali ═══ */}
      <Card
        padding="none"
        title={tc("partnerWebhookLog")}
        description={t("legacyPartners.journalSub")}
        footer={
          total > 0 ? (
            <Pagination
              page={webhooksQuery.data?.page ?? webhookPage}
              pageSize={webhooksQuery.data?.limit || PAGE_SIZE}
              total={total}
              onPageChange={setWebhookPage}
              summary={(range) => t("legacyPartners.journalRange", range)}
              label={t("legacyPartners.journalPagesAria")}
            />
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
          <Field label={t("legacyPartners.filterPartnerAria")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_200px] max-md:basis-full">
            <Select
              options={partnerOptions}
              value={webhookPartner || null}
              onChange={(v) => {
                setWebhookPartner(v ?? "");
                setWebhookPage(1);
              }}
              placeholder={tc("partnerAllPartners")}
            />
          </Field>
          <Field label={t("legacyPartners.filterStatusAria")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_200px] max-md:basis-full">
            <Select
              options={statusOptions}
              value={webhookStatus}
              onChange={(v) => {
                setWebhookStatus(v ?? "all");
                setWebhookPage(1);
              }}
              placeholder={tc("partnerAllStatuses")}
            />
          </Field>
          <IconButton
            variant="secondary"
            icon={RefreshCw}
            label={t("legacyPartners.refreshJournal")}
            loading={webhooksQuery.isFetching && !webhooksQuery.isLoading}
            onClick={() => void webhooksQuery.refetch()}
          />
        </div>
        <QueryBoundary
          query={{
            data: webhooksQuery.data ? webhooks : undefined,
            isLoading: webhooksQuery.isLoading,
            isError: webhooksQuery.isError,
            error: webhooksQuery.error,
            refetch: webhooksQuery.refetch,
          }}
          loading={<SkeletonTable framed={false} rows={4} columns={[t("colEvent"), t("colStatus"), t("colAttempt"), t("colTime")]} />}
          empty={<EmptyState icon={FileText} title={tc("partnerWebhookEmpty")} />}
          // Jurnal — yetkazilmagan hodisalarni ko'radigan yagona ekran: xato «Yozuv topilmadi» deb ko'rsatilmasin.
          error={(error, retry) => <ErrorState error={error} description={getBackendErrorMessage(error)} onRetry={retry} />}
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={journalColumns}
              getRowKey={(row) => String(row.id)}
              label={tc("partnerWebhookLog")}
              density="tight"
              busy={isRefetching}
              expandable={{
                toggle: "none",
                isExpanded: (row) => openPayload === String(row.id),
                onToggle: (row, next) => setOpenPayload(next ? String(row.id) : null),
                render: payloadPanel,
                panelId: (row) => `partner-payload-${row.id}`,
                expandedClassName: "bg-row-hover",
              }}
              renderCard={(row) => (
                <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
                  <span className="font-semibold">
                    {eventLabel(row)} · <span className="font-mono">{row.external_order_id}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {statusBadge(row)}
                    <span className="text-xs text-text-muted">
                      {partnerNames.get(String(row.partner_id)) ?? row.partner_id} · {formatDateTimeLocalized(row.delivered_at ?? row.created_at, { language })} ·{" "}
                      {t("legacyPartners.attemptShort", { value: attemptsText(row) })}
                    </span>
                  </span>
                  {row.last_error ? <span className="[overflow-wrap:anywhere] text-xs text-danger-fg">{row.last_error}</span> : null}
                  <span className="flex flex-wrap gap-2">
                    {payloadToggle(row, true)}
                    {retryControl(row, true)}
                  </span>
                </div>
              )}
            />
          )}
        </QueryBoundary>
      </Card>

      {/* ═══ Yaratish oynasi ═══ */}
      <Dialog
        open={createOpen}
        onClose={closeCreate}
        busy={createPartner.isPending}
        title={t("scPartnerNew")}
        icon={Handshake}
        onSubmit={(event) => void handleCreate(event)}
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={createPartner.isPending}>
              {t("npCancel")}
            </Button>
            <Button type="submit" loading={createPartner.isPending}>
              {t("console.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={tc("partnerName")} required error={formTouched && !form.name.trim() ? tc("partnerNameRequired") : undefined}>
            <TextInput value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="BeePost" />
          </Field>
          <Field label={tc("partnerWebhookUrl")}>
            <TextInput
              type="url"
              inputMode="url"
              value={form.webhook_url}
              onValueChange={(v) => setForm((f) => ({ ...f, webhook_url: v }))}
              placeholder="https://..."
            />
          </Field>
          <Field label={tc("partnerWebhookSecret")}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={form.webhook_secret}
              onValueChange={(v) => setForm((f) => ({ ...f, webhook_secret: v }))}
              placeholder="HMAC-SHA256"
            />
          </Field>
          <Field label={tc("partnerIpAllowlist")}>
            <TextInput value={form.ip_allowlist} onValueChange={(v) => setForm((f) => ({ ...f, ip_allowlist: v }))} placeholder="1.2.3.4, 5.6.7.8" />
          </Field>
        </div>
      </Dialog>

      {/* ═══ Tahrirlash oynasi ═══ */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        busy={updatePartner.isPending}
        title={t("legacyPartners.editTitle", { name: editing?.name ?? "" })}
        icon={Pencil}
        onSubmit={(event) => void handleEdit(event)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={updatePartner.isPending}>
              {t("npCancel")}
            </Button>
            <Button type="submit" loading={updatePartner.isPending}>
              {t("console.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={tc("partnerName")}>
            <TextInput value={editForm.name} onValueChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
          </Field>
          <Field label={tc("partnerWebhookUrl")} hint={t("legacyPartners.webhookUrlHint")}>
            <TextInput
              type="url"
              inputMode="url"
              value={editForm.webhook_url}
              onValueChange={(v) => setEditForm((f) => ({ ...f, webhook_url: v }))}
              placeholder="https://..."
            />
          </Field>
          <Field label={tc("partnerWebhookSecret")} hint={tc("partnerSecretHint")}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={editForm.webhook_secret}
              onValueChange={(v) => setEditForm((f) => ({ ...f, webhook_secret: v }))}
              placeholder="HMAC-SHA256"
            />
          </Field>

          {/*
            SINOV WEBHOOKI — ilgari sozlamani tekshirishning yagona yo'li HAQIQIY sotuvni kutish edi. Tugma
            yuqoridagi manzil bilan sinaydi, ya'ni SAQLASHDAN OLDIN tekshirish mumkin.
          */}
          <div className="flex flex-col gap-3 rounded-xl bg-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-text">{t("legacyPartners.testTitle")}</h3>
                <p className="text-[13px] text-text-muted">{t("legacyPartners.testHint")}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={Send}
                loading={testWebhook.isPending}
                disabled={!editForm.webhook_url.trim()}
                onClick={() => void handleTestWebhook()}
                className="max-md:min-h-11"
              >
                {t("legacyPartners.testSend")}
              </Button>
            </div>
            {testResult ? (
              <div className={cx("flex flex-col gap-1 rounded-[10px] px-3 py-2.5 text-[13px]", TONE_SOFT[testResult.ok ? "success" : "danger"])}>
                <p className="font-semibold">
                  {testResult.ok
                    ? t("console.testReached", { status: testResult.http_status ?? "—", ms: testResult.duration_ms })
                    : testResult.http_status
                      ? t("console.testNotReachedStatus", { status: testResult.http_status })
                      : t("console.testNotReached")}
                </p>
                {/* Sekret sozlanmagan bo'lsa qabul qiluvchi imzoni tekshira olmaydi — eng ko'p uchraydigan sabab. */}
                {!testResult.secret_configured ? (
                  <p className="flex items-start gap-1.5 text-text">
                    <TriangleAlert size={16} aria-hidden="true" className="mt-px shrink-0" />
                    {t("console.testNoSecret")}
                  </p>
                ) : null}
                {testResult.error ? <p className="[overflow-wrap:anywhere] text-text">{testResult.error}</p> : null}
                {/* Javob tanasi MUHIM: qabul qiluvchi 200 qaytarib ham «imzo yaroqsiz» deyishi mumkin. */}
                {testResult.response_body ? (
                  <p className="break-all text-text-muted">{t("wzResponse", { body: testResult.response_body.slice(0, 200) })}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/*
            ⚠️ SINOV REJIMI BU YERDA TAHRIRLANMAYDI — ikki haqiqat bo'lmasin: kalit, manzil va alohida sekret
            yagona joyda (konsol → Sozlamalar) sozlanadi; asosiy sekret sinov muhitiga yuborilmaydi.
          */}
          <p className="flex items-start gap-2 text-[13px] text-text-muted">
            <Info size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span>
              {t("legacyPartners.sandboxNoteA")}{" "}
              <Link to="/integrations/connections" className="font-semibold text-action-fg hover:underline">
                {t("legacyPartners.sandboxNoteLink")}
              </Link>{" "}
              {t("legacyPartners.sandboxNoteB")}
            </span>
          </p>
        </div>
      </Dialog>

      {/* ═══ BIR MARTALIK kalit ═══ */}
      <Dialog
        open={Boolean(revealedKey)}
        onClose={() => setRevealedKey(null)}
        closeOnOverlay={false}
        title={t("legacyPartners.keyTitle", { name: revealedKey?.name ?? "" })}
        icon={KeyRound}
        iconTone="warning"
        footer={<Button onClick={() => setRevealedKey(null)}>{tc("partnerKeySaved")}</Button>}
      >
        <div className="flex flex-col gap-4">
          <div role="status" className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}>
            <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
            <span className="text-text">{t("legacyPartners.keyOnce")}</span>
          </div>
          {revealedKey ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[10px] border border-border bg-sunken px-3 py-2">
              <code className="min-w-0 flex-[1_1_200px] break-all font-mono text-[13px] text-text">{revealedKey.key}</code>
              <Button variant="secondary" size="sm" onClick={() => copyKey(revealedKey.key)} className="max-md:min-h-11">
                {tc("partnerCopy")}
              </Button>
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
};

export default PartnersPage;
