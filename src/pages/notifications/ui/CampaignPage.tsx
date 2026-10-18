// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-sms-campaign-confirm-dialog
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Clock, History, Info, MessageSquareText, Send } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { NoticeAlert } from "../../../entities/notification";
import {
  previewSmsCampaign,
  useSendSmsCampaign,
  useSmsCampaigns,
  useSmsStatus,
  useSmsTariffs,
  useSmsTemplates,
  type SmsCampaignHistoryItem,
  type SmsCampaignInput,
  type SmsCampaignPreview,
} from "../../../entities/sms";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { fillTemplate, OPT_OUT_SAMPLE, templateVars } from "../../../shared/lib/smsSegments";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  QueryBoundary,
  SegmentedControl,
  Select,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import SmsMeter from "../../../shared/ui/SmsMeter";
import { useIsBelowLg } from "../lib/useIsPhoneViewport";
import { CardList } from "./sms/CardList";

type Audience = "phones" | "segment";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * O'zgaruvchi maydoni (maket: `{{promo}}` | «To'ldirilmagan») — `TextInput` qutisi bilan bir xil klasslar, chapda
 * o'zgaruvchi nomi va ajratkich. To'ldirilmagani — qizil chegara (`aria-invalid`).
 */
const VarInput = ({
  name,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const invalid = !value.trim();
  return (
    <label
      className={cx(
        "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[10px] border bg-input px-3 text-text max-md:h-11",
        "transition-[border-color,box-shadow] duration-150 focus-within:ring-3 motion-reduce:transition-none",
        invalid
          ? "border-danger focus-within:ring-danger-soft"
          : "border-border-strong focus-within:border-action focus-within:ring-focus",
      )}
    >
      <span className="shrink-0 text-sm whitespace-nowrap text-text-muted">{`{{${name}}}`}</span>
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-strong" />
      <input
        type="text"
        aria-label={name}
        aria-invalid={invalid || undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="-my-px min-w-0 flex-1 self-stretch bg-transparent p-0 text-base text-inherit outline-none! placeholder:text-text-subtle md:text-sm"
      />
    </label>
  );
};

/** Jadvaldagi son: 0 — xira; ton berilsa va > 0 — qalin, rangli (maket: «Xato» qizil, «Kutilmoqda» sariq). */
const Num = ({
  value,
  tone,
  strong,
  language,
}: {
  value: number;
  tone?: "danger" | "warning";
  strong?: boolean;
  language: string;
}) => {
  const text = formatNumberLocalized(value, { language });
  if (!value) return <span className="text-text-subtle">{text}</span>;
  return (
    <span
      className={cx(
        (strong || tone) && "font-semibold",
        tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : "text-text",
      )}
    >
      {text}
    </span>
  );
};

/**
 * SMS KAMPANIYASI (sVByLMnt #6/#7), dizayn v2 — maketlar `superadmin-notifications-sms-campaign`,
 * `-campaign-confirm-dialog`.
 *
 * «Yangi kampaniya»: shablon yoki o'z matni → turi (Reklama | Xizmat xabari) → hisoblagich → o'zgaruvchilar → kimga
 * (raqamlar | mijozlar segmenti) → «Ko'rib chiqish». Ko'rib chiqish `POST …/campaigns/preview` (hech narsa
 * yuborilmaydi) va YANGI `Idempotency-Key` → tasdiq oynasi (aniq qabul qiluvchilar, roziligi yo'qlar, noto'g'ri
 * raqamlar, prognoz narx, bo'laklar, rejalashtirilgan vaqt, to'liq matn) → «Yuborish» shu kalit bilan
 * (`POST …/campaigns`, takror — 409, ikki marta ketmaydi). Chegaradan ko'p / 0 qabul qiluvchi — «Yuborish» o'chiq.
 * `{{var}}` to'ldirilmasa ko'rib chiqish bloklanadi. Pastda «Kampaniyalar tarixi».
 */
const CampaignPage = () => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tariffs = useSmsTariffs();
  const templates = useSmsTemplates();
  const history = useSmsCampaigns({ silentError: true });
  const status = useSmsStatus();
  const sendCampaign = useSendSmsCampaign();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isBelowLg = useIsBelowLg();

  const [messageClass, setMessageClass] = useState<"promo" | "transactional">("promo");
  const [templateCode, setTemplateCode] = useState<string>("");
  const [text, setText] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience>("phones");
  const [phones, setPhones] = useState("");
  const [segment, setSegment] = useState<{
    market_id?: string;
    region_id?: string;
    district_id?: string;
    last_order_from?: string;
    last_order_to?: string;
    min_orders?: number;
  }>({});

  const [preview, setPreview] = useState<SmsCampaignPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Javob massiv bo'lmasa (kutilmagan konvert) — sahifa yiqilmasin.
  const templateList = useMemo(
    () => (Array.isArray(templates.data) ? templates.data : []),
    [templates.data],
  );
  const historyQuery = {
    ...history,
    data: history.data === undefined ? undefined : Array.isArray(history.data) ? history.data : [],
  };
  const template =
    templateList.find((item) => item.code === templateCode && item.lang === "uz") ??
    templateList.find((item) => item.code === templateCode);
  const sourceText = template ? template.text : text;
  const effectiveClass = template
    ? template.message_class === "promo"
      ? "promo"
      : "transactional"
    : messageClass;
  const variables = useMemo(() => templateVars(sourceText), [sourceText]);
  const missing = variables.filter((name) => !vars[name]?.trim());
  const filled = fillTemplate(sourceText, vars);
  const finalText = effectiveClass === "promo" && filled ? `${filled}${OPT_OUT_SAMPLE}` : filled;
  const phoneList = phones
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const recipientsGuess = audience === "phones" ? phoneList.length : 1;

  const input = (): SmsCampaignInput => ({
    ...(template
      ? { template_code: template.code, lang: template.lang }
      : { message_class: messageClass, text: text.trim() }),
    ...(variables.length ? { vars } : {}),
    segment:
      audience === "phones"
        ? { phones: phoneList }
        : Object.fromEntries(
            Object.entries(segment).filter(([, value]) => value !== undefined && value !== ""),
          ),
  });

  const canPreview =
    Boolean(sourceText.trim()) &&
    missing.length === 0 &&
    (audience === "segment" || phoneList.length > 0);

  const footerHint = !sourceText.trim()
    ? t("campaign.hintText")
    : missing.length
      ? t("campaign.hintVars")
      : audience === "phones" && !phoneList.length
        ? t("campaign.hintPhones")
        : t("campaign.hintReady");

  const openPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setResult(null);
    try {
      const data = await previewSmsCampaign(input());
      setPreview(data);
      // Bir tasdiq oynasi — bitta kalit: 504 dan keyin qayta bosilsa ham ikki marta ketmaydi.
      setIdempotencyKey(newKey());
    } catch (error) {
      setPreviewError(getBackendErrorMessage(error) ?? t("campaign.failed"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmSend = async () => {
    if (!idempotencyKey || sendCampaign.isPending) return;
    try {
      const res = await sendCampaign.mutateAsync({ input: input(), idempotencyKey });
      setResult({
        type: "success",
        message: t("campaign.sent", {
          queued: res.queued,
          blocked: res.blocked_no_consent,
          skipped: res.skipped_invalid_phone,
        }),
      });
      setPreview(null);
      setIdempotencyKey(null);
    } catch (error) {
      setResult({ type: "error", message: getBackendErrorMessage(error) ?? t("campaign.failed") });
      setPreview(null);
    }
  };

  const tariff =
    effectiveClass === "promo"
      ? (tariffs.data?.promo ?? null)
      : (tariffs.data?.transactional ?? null);
  const scheduledLater = preview && new Date(preview.scheduled_for).getTime() - Date.now() > 60_000;
  const blockedSend = !preview || preview.recipients === 0 || preview.fanout_exceeded;
  const count = useCallback(
    (value: number) => t("count", { value: formatNumberLocalized(value, { language }) }),
    [language, t],
  );

  const templateOptions = useMemo(
    () => [
      { value: "", label: t("campaign.templateNone") },
      ...[
        ...new Map(
          templateList
            .filter((item) => item.message_class !== "security")
            .map((item) => [item.code, item]),
        ).values(),
      ].map((item) => ({
        value: item.code,
        label: t("campaign.templateOption", {
          code: item.code,
          class: t(`class.${item.message_class}`),
        }),
      })),
    ],
    [t, templateList],
  );

  const classBadge = useCallback(
    (item: SmsCampaignHistoryItem) => <Badge>{t(`class.${item.message_class}`)}</Badge>,
    [t],
  );

  const historyColumns = useMemo<DataTableColumn<SmsCampaignHistoryItem>[]>(
    () => [
      {
        id: "date",
        header: t("campaign.col.date"),
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (item) => formatDateTimeLocalized(item.created_at, { language }),
      },
      { id: "class", header: t("campaign.col.class"), cell: classBadge },
      {
        id: "text",
        header: t("campaign.col.text"),
        cell: (item) => (
          <span className="line-clamp-2 block max-w-[340px] min-w-[220px]">{item.text}</span>
        ),
      },
      {
        id: "queued",
        header: t("campaign.col.queued"),
        align: "end",
        cell: (item) => <Num value={item.queued} strong language={language} />,
      },
      {
        id: "delivered",
        header: t("campaign.col.delivered"),
        align: "end",
        cell: (item) => <Num value={item.delivered} language={language} />,
      },
      {
        id: "failed",
        header: t("campaign.col.failed"),
        align: "end",
        cell: (item) => <Num value={item.failed} tone="danger" language={language} />,
      },
      {
        id: "blocked",
        header: t("campaign.col.blocked"),
        align: "end",
        cell: (item) => <Num value={item.blocked} language={language} />,
      },
      {
        id: "pending",
        header: t("campaign.col.pending"),
        align: "end",
        cell: (item) => <Num value={item.pending} tone="warning" language={language} />,
      },
    ],
    [classBadge, language, t],
  );

  const renderHistoryCard = useCallback(
    (item: SmsCampaignHistoryItem) => {
      const stats: Array<[string, number, "danger" | "warning" | undefined, boolean]> = [
        [t("campaign.col.queued"), item.queued, undefined, true],
        [t("campaign.col.delivered"), item.delivered, undefined, false],
        [t("campaign.col.failed"), item.failed, "danger", false],
        [t("campaign.col.blocked"), item.blocked, undefined, false],
        [t("campaign.col.pending"), item.pending, "warning", false],
      ];
      return (
        <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            {classBadge(item)}
            <span className="text-[13px] whitespace-nowrap text-text-muted tabular-nums">
              {formatDateTimeLocalized(item.created_at, { language })}
            </span>
          </div>
          <span className="text-sm text-text [overflow-wrap:anywhere]">{item.text}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            {stats.map(([label, value, tone, strong]) => (
              <span
                key={label}
                className={cx(
                  strong && "font-semibold text-text",
                  value > 0 && tone === "danger" && "text-danger-fg",
                  value > 0 && tone === "warning" && "text-warning-fg",
                )}
              >
                {label} {formatNumberLocalized(value, { language })}
              </span>
            ))}
          </span>
        </div>
      );
    },
    [classBadge, language, t],
  );

  const confirmRows: Array<{ label: ReactNode; value: ReactNode }> = preview
    ? [
        { label: t("campaign.confirmBlocked"), value: count(preview.blocked_no_consent) },
        { label: t("campaign.confirmInvalid"), value: count(preview.skipped_invalid_phone) },
        {
          label: t("campaign.confirmCost"),
          value:
            preview.estimated_cost === null
              ? t("campaign.confirmCostUnknown")
              : formatMoneyLocalized(preview.estimated_cost, { language }),
        },
        {
          label: t("campaign.confirmParts"),
          value: t("campaign.confirmPartsValue", {
            encoding: preview.encoding,
            parts: preview.parts,
          }),
        },
      ]
    : [];

  const quiet = status.data?.quiet_hours;

  return (
    <>
      <Card
        title={t("campaign.newTitle")}
        bodyClassName="flex flex-wrap gap-x-8 gap-y-6"
        footer={
          <>
            <span className="inline-flex min-w-0 flex-[1_1_260px] items-start gap-2 text-[13px] text-text-muted">
              <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0">{footerHint}</span>
            </span>
            <Button
              disabled={!canPreview}
              loading={previewLoading}
              onClick={() => void openPreview()}
              className="ml-auto max-md:w-full"
            >
              {t("campaign.preview")}
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-[3_1_400px] flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
            <Field label={t("campaign.template")} labelAs="span">
              <Select
                options={templateOptions}
                value={templateCode}
                onChange={(value) => setTemplateCode(value ?? "")}
                loading={templates.isLoading}
              />
            </Field>
            {!template ? (
              <Field label={t("campaign.messageClass")} labelAs="span">
                <SegmentedControl
                  ariaLabel={t("campaign.messageClass")}
                  value={messageClass}
                  onValueChange={setMessageClass}
                  fullWidth
                  options={[
                    { value: "promo", label: t("class.promo") },
                    { value: "transactional", label: t("class.transactional") },
                  ]}
                />
              </Field>
            ) : null}
          </div>

          <Field label={t("campaign.text")} required={!template} readOnly={Boolean(template)}>
            <TextInput
              multiline
              rows={3}
              maxLength={1000}
              value={template ? template.text : text}
              placeholder={t("campaign.textPlaceholder")}
              onValueChange={template ? undefined : setText}
              readOnly={Boolean(template)}
            />
          </Field>
          <SmsMeter
            text={finalText}
            recipients={recipientsGuess}
            tariff={tariff}
            className="-mt-2"
          />

          {effectiveClass === "promo" ? (
            <NoticeAlert tone="neutral" role="note" icon={Clock}>
              {t("campaign.promoHint")}
            </NoticeAlert>
          ) : null}

          {variables.length ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-text">{t("campaign.vars")}</span>
              {variables.map((name) => (
                <VarInput
                  key={name}
                  name={name}
                  value={vars[name] ?? ""}
                  placeholder={t("campaign.varMissing")}
                  onChange={(value) => setVars((current) => ({ ...current, [name]: value }))}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-4">
          <Field label={t("campaign.audience")} labelAs="span">
            <SegmentedControl
              ariaLabel={t("campaign.audience")}
              value={audience}
              onValueChange={setAudience}
              fullWidth
              options={[
                { value: "phones", label: t("campaign.audiencePhones") },
                { value: "segment", label: t("campaign.audienceSegment") },
              ]}
            />
          </Field>
          {audience === "phones" ? (
            <Field label={t("campaign.phones")} required className="flex-1">
              <TextInput
                multiline
                rows={9}
                value={phones}
                placeholder="+998901234567"
                onValueChange={setPhones}
                className="min-h-[232px] flex-1 tabular-nums"
              />
            </Field>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
              {(
                [
                  ["market_id", "marketId"],
                  ["region_id", "regionId"],
                  ["district_id", "districtId"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={t(`campaign.${label}`)}>
                  <TextInput
                    mode="number"
                    value={segment[key] ?? ""}
                    onValueChange={(value) =>
                      setSegment((current) => ({ ...current, [key]: value }))
                    }
                  />
                </Field>
              ))}
              <Field label={t("campaign.minOrders")}>
                <TextInput
                  mode="number"
                  value={segment.min_orders ? String(segment.min_orders) : ""}
                  onValueChange={(value) =>
                    setSegment((current) => ({
                      ...current,
                      min_orders: value ? Math.max(1, Number(value)) : undefined,
                    }))
                  }
                />
              </Field>
              <Field label={t("campaign.lastOrderFrom")} labelAs="span">
                <DateInput
                  value={segment.last_order_from ?? ""}
                  max={segment.last_order_to || undefined}
                  onChange={(value) =>
                    setSegment((current) => ({ ...current, last_order_from: value }))
                  }
                />
              </Field>
              <Field label={t("campaign.lastOrderTo")} labelAs="span">
                <DateInput
                  value={segment.last_order_to ?? ""}
                  min={segment.last_order_from || undefined}
                  onChange={(value) =>
                    setSegment((current) => ({ ...current, last_order_to: value }))
                  }
                />
              </Field>
            </div>
          )}
        </div>

        {previewError || result ? (
          <div className="flex w-full min-w-0 flex-col gap-3">
            {previewError ? <NoticeAlert tone="danger">{previewError}</NoticeAlert> : null}
            {result ? (
              <NoticeAlert tone={result.type === "success" ? "success" : "danger"}>
                {result.message}
              </NoticeAlert>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card
        title={t("campaign.history")}
        padding="none"
        actions={historyQuery.data ? <Badge>{count(historyQuery.data.length)}</Badge> : null}
      >
        <QueryBoundary
          query={historyQuery}
          loadingLabel={t("campaign.historyLoading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("campaign.col.date"),
                t("campaign.col.class"),
                t("campaign.col.text"),
                t("campaign.col.queued"),
              ]}
              rows={4}
            />
          }
          empty={
            <EmptyState
              icon={History}
              title={t("campaign.historyEmpty")}
              description={t("campaign.historyEmptyHint")}
            />
          }
          error={(error, retry) => (
            <ErrorState error={error} title={t("campaign.historyLoadError")} onRetry={retry} />
          )}
        >
          {(items, { isRefetching }) =>
            isBelowLg ? (
              <CardList
                rows={items}
                getRowKey={(item) => item.id}
                label={t("campaign.historyLabel")}
                renderCard={renderHistoryCard}
                busy={isRefetching}
              />
            ) : (
              <DataTable
                rows={items}
                columns={historyColumns}
                getRowKey={(item) => item.id}
                label={t("campaign.historyLabel")}
                renderCard={renderHistoryCard}
                busy={isRefetching}
              />
            )
          }
        </QueryBoundary>
      </Card>

      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          if (!sendCampaign.isPending) setPreview(null);
        }}
        role="alertdialog"
        title={t("campaign.confirmTitle")}
        description={
          preview ? (
            <span>
              <Trans
                t={t}
                i18nKey="campaign.confirmRecipients"
                values={{ value: formatNumberLocalized(preview.recipients, { language }) }}
                components={{ b: <span className="font-semibold text-text" /> }}
              />
            </span>
          ) : null
        }
        icon={MessageSquareText}
        size="lg"
        busy={sendCampaign.isPending}
        initialFocus={cancelRef}
        footer={
          <>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={sendCampaign.isPending}
              onClick={() => setPreview(null)}
            >
              {t("campaign.cancel")}
            </Button>
            <Button
              leftIcon={Send}
              disabled={blockedSend}
              loading={sendCampaign.isPending}
              loadingText={t("campaign.sending")}
              onClick={() => void confirmSend()}
            >
              {t("campaign.send")}
            </Button>
          </>
        }
      >
        {preview ? (
          <div data-testid="campaign-confirm" className="flex min-w-0 flex-col gap-4 text-sm">
            <dl className="m-0 flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1">
              {confirmRows.map((row, index) => (
                <div
                  key={index}
                  className={cx(
                    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <dt className="min-w-0 text-text-muted">{row.label}</dt>
                  <dd className="m-0 ml-auto text-right font-semibold whitespace-nowrap text-text">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {scheduledLater ? (
              <NoticeAlert
                tone="info"
                icon={Clock}
                title={t("campaign.confirmScheduled", {
                  time: formatDateTimeLocalized(preview.scheduled_for, { language }),
                })}
              >
                {preview.message_class === "promo" && quiet
                  ? t("campaign.confirmQuietHours", {
                      from: hhmm(quiet.start),
                      to: hhmm(quiet.end),
                    })
                  : null}
              </NoticeAlert>
            ) : null}
            {preview.fanout_exceeded ? (
              <NoticeAlert tone="danger">
                {t("campaign.fanoutExceeded", { max: preview.max_fanout })}
              </NoticeAlert>
            ) : null}
            {!preview.sms_enabled ? (
              <NoticeAlert tone="warning">{t("campaign.smsDisabled")}</NoticeAlert>
            ) : null}

            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[13px] font-semibold text-text">
                {t("campaign.confirmFullText")}
              </span>
              <p className="m-0 max-h-48 overflow-y-auto rounded-xl bg-sunken px-4 py-3 text-[13px] whitespace-pre-wrap text-text [overflow-wrap:anywhere]">
                {preview.sample_text}
              </p>
            </div>

            <p className="m-0 text-[13px] font-semibold text-text">
              {t("campaign.confirmIrreversible")}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};

export default CampaignPage;
