// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-sms-campaign-confirm-dialog, superadmin-notifications-sms-campaign-segment
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarClock, CircleX, Clock, History, Info, MessageSquareText, Moon, Send } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { NoticeAlert } from "../../../entities/notification";
import {
  CustomerSegmentFilters,
  isFutureSlot,
  toCustomerSegmentPayload,
  toScheduledAt,
  useCampaignTime,
  type CustomerSegment,
} from "../../../entities/notification-campaign";
import {
  isRetryableSmsCampaignError,
  isSmsScheduleTooFar,
  previewSmsCampaign,
  smsCampaignErrorKind,
  smsCampaignStatus,
  smsDailyQuota,
  smsScheduleErrorKey,
  SMS_MAX_SCHEDULE_DAYS,
  useCancelSmsCampaign,
  useSendSmsCampaign,
  useSmsCampaignAudience,
  useSmsCampaigns,
  useSmsStatus,
  useSmsTariffs,
  useSmsTemplates,
  type SmsCampaignHistoryItem,
  type SmsCampaignInput,
  type SmsCampaignPreview,
  type SmsCampaignStatus,
} from "../../../entities/sms";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { notify } from "../../../shared/lib/notify";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { fillTemplate, OPT_OUT_SAMPLE, templateVars } from "../../../shared/lib/smsSegments";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  QueryBoundary,
  SegmentedControl,
  Select,
  SkeletonTable,
  StatusBadge,
  TextInput,
  useConfirm,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import SmsMeter from "../../../shared/ui/SmsMeter";
import { useIsBelowLg } from "../lib/useIsPhoneViewport";
import { CampaignAudienceSummary, type CampaignAudienceState } from "./sms/CampaignAudienceSummary";
import { CampaignSendTime } from "./sms/CampaignSendTime";
import { createSmsSendTime, type SmsSendTimeErrors, type SmsSendTimeValue } from "./sms/sendTime";
import { CardList } from "./sms/CardList";

type Audience = "phones" | "segment";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** KM-6: kampaniya holati → ton (bildirishnoma kampaniyasi `CAMPAIGN_STATUS_META` bilan bir xil ma'no). */
const SMS_STATUS_META: Record<SmsCampaignStatus, { tone: Tone; variant: "soft" | "outline" }> = {
  scheduled: { tone: "info", variant: "soft" },
  queued: { tone: "success", variant: "soft" },
  failed: { tone: "danger", variant: "soft" },
  cancelled: { tone: "danger", variant: "outline" },
};

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
      {/* eslint-disable-next-line design-v2/raw-control -- TextInput'da matn prefiksi («{{nom}}» + ajratkich) slot'i yo'q; quti TextInput klasslarida — prefiks slot'i qo'shilganda TextInput ga o'tadi (5-bosqich B, follow-up) */}
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
 * «Yangi kampaniya» (KM-1, maket `-campaign-segment`): shablon yoki o'z matni → turi FAQAT «Reklama» (backend
 * boshqasini 400 `campaign_promo_only` bilan rad etadi; xizmat xabari — tizim hodisalaridan) → hisoblagich →
 * o'zgaruvchilar → kimga: raqamlar | mijozlar segmenti (`CustomerSegmentFilters`: Viloyat / Tuman / Market
 * `Select`, «Oxirgi buyurtma» `DateRange`, «Buyurtmalar soni» — minimum) + jonli auditoriya va bugungi SMS limiti
 * (KM-S4; oshsa «Ko'rib chiqish» o'chiq) → «Yuborish vaqti» (Darhol; tungi taqiqda — qachon ketishi) →
 * «Ko'rib chiqish». Ko'rib chiqish `POST …/campaigns/preview` (hech narsa
 * yuborilmaydi) va YANGI `Idempotency-Key` → tasdiq oynasi (aniq qabul qiluvchilar, roziligi yo'qlar, noto'g'ri
 * raqamlar, prognoz narx, bo'laklar, rejalashtirilgan vaqt, to'liq matn) → «Yuborish» shu kalit bilan
 * (`POST …/campaigns`, takror — 409, ikki marta ketmaydi). Chegaradan ko'p / 0 qabul qiluvchi — «Yuborish» o'chiq.
 * `{{var}}` to'ldirilmasa ko'rib chiqish bloklanadi. Xato — faqat i18n matn (HTTP holati bo'yicha), xom backend
 * matni ko'rsatilmaydi. Pastda «Kampaniyalar tarixi».
 */
const CampaignPage = () => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tariffs = useSmsTariffs();
  const templates = useSmsTemplates();
  const history = useSmsCampaigns({ silentError: true });
  // Kvota noma'lum bo'lsa limit qatori chizilmaydi — global xabar (xom backend matni) kerak emas.
  const status = useSmsStatus({ silentError: true });
  const sendCampaign = useSendSmsCampaign();
  const cancelCampaign = useCancelSmsCampaign();
  const confirm = useConfirm();
  const campaignTime = useCampaignTime();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isBelowLg = useIsBelowLg();

  const [templateCode, setTemplateCode] = useState<string>("");
  const [text, setText] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience>("phones");
  const [phones, setPhones] = useState("");
  const [segment, setSegment] = useState<CustomerSegment>({});
  // KM-6: «Yuborish vaqti» — darhol yoki tanlangan Toshkent vaqti; xato «Ko'rib chiqish» bosilgach ko'rinadi.
  const [sendTime, setSendTime] = useState<SmsSendTimeValue>(createSmsSendTime);
  const [scheduleTouched, setScheduleTouched] = useState(false);

  const [preview, setPreview] = useState<SmsCampaignPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Javob massiv bo'lmasa (kutilmagan konvert) — sahifa yiqilmasin. Kampaniya faqat reklama — xizmat va OTP
  // shablonlari ro'yxatga chiqmaydi (tanlansa backend 400 `campaign_promo_only`).
  const templateList = useMemo(
    () =>
      (Array.isArray(templates.data) ? templates.data : []).filter(
        (item) => item.message_class === "promo",
      ),
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
  const variables = useMemo(() => templateVars(sourceText), [sourceText]);
  const missing = variables.filter((name) => !vars[name]?.trim());
  const filled = fillTemplate(sourceText, vars);
  const finalText = filled ? `${filled}${OPT_OUT_SAMPLE}` : filled;
  const phoneList = phones
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const segmentPayload = useMemo(() => toCustomerSegmentPayload(segment), [segment]);

  // Jonli auditoriya (faqat «Mijozlar segmenti»): debounce bilan preview, natija + bugungi limit.
  const audienceQuery = useSmsCampaignAudience(audience === "segment" ? segmentPayload : null);
  const quota = smsDailyQuota(status.data);
  const audienceData = audienceQuery.data;
  const audienceFresh =
    audienceQuery.settled &&
    !audienceQuery.isFetching &&
    !audienceQuery.isPlaceholderData &&
    !audienceQuery.isError &&
    audienceData !== undefined;
  const audienceState: CampaignAudienceState =
    audienceQuery.settled && !audienceQuery.isFetching && audienceQuery.isError
      ? "error"
      : !audienceFresh || !audienceData
        ? "loading"
        : audienceData.fanout_exceeded
          ? "fanout"
          : audienceData.recipients === 0
            ? "empty"
            : quota && audienceData.recipients > quota.remaining
              ? "limit"
              : "ready";

  const audienceErrorKind = audienceQuery.isError ? smsCampaignErrorKind(audienceQuery.error) : undefined;

  const recipientsGuess =
    audience === "phones" ? phoneList.length : (audienceData?.recipients ?? 1);

  const scheduled = sendTime.when === "scheduled";
  /** Sana/soat xatosi: «Tanlang» — faqat bosilgach; o'tib ketgan va 90 kundan uzoq — darhol. */
  const validateSendTime = (value: SmsSendTimeValue, touched: boolean, at: number): SmsSendTimeErrors => {
    if (value.when !== "scheduled") return {};
    if (!value.day) return touched ? { day: t("campaign.scheduleErrors.day") } : {};
    if (!value.time) return touched ? { time: t("campaign.scheduleErrors.time") } : {};
    if (!isFutureSlot(value.day, value.time, at)) return { time: t("campaign.scheduleErrors.past") };
    if (isSmsScheduleTooFar(Date.parse(toScheduledAt(value.day, value.time)), at)) {
      return { day: t("campaign.scheduleErrors.tooFar", { days: SMS_MAX_SCHEDULE_DAYS }) };
    }
    return {};
  };
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const sendTimeErrors = validateSendTime(sendTime, scheduleTouched, checkedAt);
  const sendTimeReady = !scheduled || (Boolean(sendTime.day && sendTime.time) && !Object.keys(sendTimeErrors).length);

  const input = (): SmsCampaignInput => ({
    ...(template
      ? { template_code: template.code, lang: template.lang }
      : { message_class: "promo" as const, text: text.trim() }),
    ...(variables.length ? { vars } : {}),
    segment: audience === "phones" ? { phones: phoneList } : segmentPayload,
    ...(scheduled && sendTime.day && sendTime.time ? { scheduled_at: toScheduledAt(sendTime.day, sendTime.time) } : {}),
  });

  const canPreview =
    Boolean(sourceText.trim()) &&
    missing.length === 0 &&
    (audience === "segment" ? audienceState === "ready" : phoneList.length > 0);

  const audienceHint: Record<Exclude<CampaignAudienceState, "ready">, string> = {
    loading: t("campaign.hintAudienceWait"),
    error: isRetryableSmsCampaignError(audienceErrorKind)
      ? t("campaign.hintAudienceError")
      : t("campaign.hintAudienceBlocked"),
    fanout: t("campaign.hintFanout"),
    empty: t("campaign.hintAudienceEmpty"),
    limit: t("campaign.hintLimit"),
  };
  const footerHint = !sourceText.trim()
    ? t("campaign.hintText")
    : missing.length
      ? t("campaign.hintVars")
      : audience === "phones" && !phoneList.length
        ? t("campaign.hintPhones")
        : audience === "segment" && audienceState !== "ready"
          ? audienceHint[audienceState]
          : !sendTimeReady
            ? t("campaign.hintSchedule")
            : t("campaign.hintReady");

  const errorText = (error: unknown, fallback: string) => {
    const scheduleKey = smsScheduleErrorKey(error);
    if (scheduleKey) return t(`campaign.errors.${scheduleKey}`, { days: SMS_MAX_SCHEDULE_DAYS });
    const kind = smsCampaignErrorKind(error);
    return kind === "unknown" ? fallback : t(`campaign.errors.${kind}`);
  };

  const openPreview = async () => {
    const at = Date.now();
    setScheduleTouched(true);
    setCheckedAt(at);
    if (Object.keys(validateSendTime(sendTime, true, at)).length) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setResult(null);
    try {
      const data = await previewSmsCampaign(input());
      setPreview(data);
      // Bir tasdiq oynasi — bitta kalit: 504 dan keyin qayta bosilsa ham ikki marta ketmaydi.
      setIdempotencyKey(newKey());
    } catch (error) {
      setPreviewError(errorText(error, t("campaign.previewFailed")));
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmSend = async () => {
    if (!idempotencyKey || sendCampaign.isPending) return;
    // Tasdiq oynasi ochiq turganda tanlangan vaqt o'tib ketsa — backend uni «darhol» deb oladi; yubormaymiz.
    if (scheduled && !isFutureSlot(sendTime.day, sendTime.time, Date.now())) {
      setPreview(null);
      setCheckedAt(Date.now());
      setResult({ type: "error", message: t("campaign.scheduleErrors.expired") });
      return;
    }
    try {
      const res = await sendCampaign.mutateAsync({ input: input(), idempotencyKey });
      const when = campaignTime.inline(res.scheduled_for_tashkent ?? res.scheduled_for);
      setResult({
        type: "success",
        message:
          res.status === "scheduled"
            ? t(res.quiet_hours_shifted ? "campaign.scheduledShifted" : "campaign.scheduledResult", {
                when: when ?? "",
                recipients: formatNumberLocalized(res.recipients ?? 0, { language }),
              })
            : t("campaign.sent", {
                queued: res.queued,
                blocked: res.blocked_no_consent,
                skipped: res.skipped_invalid_phone,
              }),
      });
      setPreview(null);
      setIdempotencyKey(null);
    } catch (error) {
      setResult({ type: "error", message: errorText(error, t("campaign.failed")) });
      setPreview(null);
    }
  };

  const tariff = tariffs.data?.promo ?? null;
  const scheduledLater = preview && new Date(preview.scheduled_for).getTime() - Date.now() > 60_000;
  /** KM-6: tasdiq «Belgilangan vaqtda» uchun — kampaniya `scheduled` bo'lib yaratiladi («Bekor qilish» mumkin). */
  const previewScheduled = Boolean(preview && scheduled);
  /** Yuboriladigan vaqt Toshkent vaqtida («Ertaga, 10:00») — sahifadagi «Toshkent vaqti» belgisi bilan bir xil. */
  const confirmWhen = preview
    ? campaignTime.format(preview.scheduled_for_tashkent ?? preview.scheduled_for)
    : null;
  // KM-S4: aniq qabul qiluvchilar bugungi qoldiqdan ko'p bo'lsa — backend 409 (kvota) qaytaradi; oldindan to'xtatiladi.
  const overQuota = Boolean(preview && quota && preview.recipients > quota.remaining);
  const blockedSend =
    !preview || preview.recipients === 0 || preview.fanout_exceeded || overQuota;
  const count = useCallback(
    (value: number) => t("count", { value: formatNumberLocalized(value, { language }) }),
    [language, t],
  );

  const templateOptions = useMemo(
    () => [
      { value: "", label: t("campaign.templateNone") },
      ...[
        ...new Map(templateList.map((item) => [item.code, item])).values(),
      ].map((item) => ({ value: item.code, label: item.code })),
    ],
    [t, templateList],
  );

  const classBadge = useCallback(
    (item: SmsCampaignHistoryItem) => <Badge>{t(`class.${item.message_class}`)}</Badge>,
    [t],
  );

  /** KM-6: holat belgisi (noma'lum yangi holat — belgisiz). */
  const statusBadge = useCallback(
    (item: SmsCampaignHistoryItem) => {
      const status = smsCampaignStatus(item);
      if (!status) return null;
      const meta = SMS_STATUS_META[status];
      return <StatusBadge tone={meta.tone} variant={meta.variant} label={t(`campaign.status.${status}`)} />;
    },
    [t],
  );

  /**
   * KM-6: rejalashtirilgan vaqt (Toshkent), tungi taqiq siljishi va rad etilish sababi — sana ostida.
   */
  const scheduleNote = useCallback(
    (item: SmsCampaignHistoryItem) => {
      const status = smsCampaignStatus(item);
      const when = campaignTime.format(item.scheduled_for_tashkent ?? item.scheduled_for ?? item.scheduled_at);
      const lines: ReactNode[] = [];
      if (when && (status === "scheduled" || status === "cancelled" || item.quiet_hours_shifted)) {
        lines.push(
          <span key="when" className="inline-flex items-center gap-1 text-xs text-text-muted">
            <CalendarClock aria-hidden="true" size={14} className="shrink-0" />
            {t(status === "scheduled" ? "campaign.scheduledFor" : "campaign.scheduledWas", { when })}
          </span>,
        );
      }
      if (item.quiet_hours_shifted) {
        const requested = campaignTime.format(item.requested_at);
        lines.push(
          <span key="shift" className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Moon aria-hidden="true" size={14} className="shrink-0" />
            {requested ? t("campaign.shiftedFrom", { requested }) : t("campaign.shiftedShort")}
          </span>,
        );
      }
      if (status === "failed" && item.last_error) {
        lines.push(
          <span key="error" className="text-xs text-danger-fg [overflow-wrap:anywhere]">
            {t("campaign.failedReason", { reason: item.last_error })}
          </span>,
        );
      }
      return lines.length ? <span className="flex min-w-0 flex-col gap-0.5">{lines}</span> : null;
    },
    [campaignTime, t],
  );

  /**
   * KM-6: «Bekor qilish» (faqat `can_cancel`) — xavfli tasdiq; 409 — allaqachon boshlangan / rejalashtirilmagan
   * (xabar, tarix yangilanadi).
   */
  const askCancel = useCallback(
    (item: SmsCampaignHistoryItem) => {
      const when = campaignTime.format(item.scheduled_for_tashkent ?? item.scheduled_for ?? item.scheduled_at);
      void confirm({
        title: t("campaign.cancelTitle"),
        description: when ? t("campaign.cancelText", { when }) : t("campaign.cancelTextNoTime"),
        confirmLabel: t("campaign.cancelConfirm"),
        cancelLabel: t("campaign.cancelClose"),
        tone: "danger",
        icon: CircleX,
        confirmIcon: CircleX,
        details: (
          <span className="line-clamp-3 text-[13px] text-text [overflow-wrap:anywhere]">{item.text}</span>
        ),
        onConfirm: async () => {
          try {
            await cancelCampaign.mutateAsync(item.id);
            notify.success(t("campaign.cancelDone"));
          } catch (error) {
            if (getErrorStatus(error) !== 409) throw error;
            notify.error(t("campaign.cancelConflict"));
          }
        },
        errorMessage: () => t("campaign.cancelFailed"),
      });
    },
    [campaignTime, cancelCampaign, confirm, t],
  );

  const cancelButton = useCallback(
    (item: SmsCampaignHistoryItem, full?: boolean) =>
      item.can_cancel ? (
        <Button
          variant="danger-soft"
          size="sm"
          leftIcon={CircleX}
          onClick={() => askCancel(item)}
          className={full ? "max-md:w-full" : undefined}
        >
          {t("campaign.cancelAction")}
        </Button>
      ) : null,
    [askCancel, t],
  );

  const historyColumns = useMemo<DataTableColumn<SmsCampaignHistoryItem>[]>(
    () => [
      {
        id: "date",
        header: t("campaign.col.date"),
        cellClassName: "tabular-nums",
        cell: (item) => (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="whitespace-nowrap">{formatDateTimeLocalized(item.created_at, { language })}</span>
            {scheduleNote(item)}
          </span>
        ),
      },
      { id: "status", header: t("campaign.col.status"), cell: statusBadge },
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
      {
        id: "actions",
        header: <span className="sr-only">{t("campaign.col.actions")}</span>,
        align: "end",
        cell: (item) => cancelButton(item),
      },
    ],
    [cancelButton, classBadge, language, scheduleNote, statusBadge, t],
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
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {classBadge(item)}
              {statusBadge(item)}
            </span>
            <span className="text-[13px] whitespace-nowrap text-text-muted tabular-nums">
              {formatDateTimeLocalized(item.created_at, { language })}
            </span>
          </div>
          {scheduleNote(item)}
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
          {cancelButton(item, true)}
        </div>
      );
    },
    [cancelButton, classBadge, language, scheduleNote, statusBadge, t],
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
        padding="none"
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
        <div className="flex flex-wrap gap-x-8 gap-y-6 p-5">
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
              <Field label={t("campaign.messageClass")} hint={t("campaign.promoOnlyHint")} readOnly>
                <TextInput
                  value={t("class.promo")}
                  readOnly
                  suffix={<Badge>{t("campaign.promoOnly")}</Badge>}
                />
              </Field>
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

            <NoticeAlert tone="neutral" role="note" icon={Clock}>
              {t("campaign.promoHint")}
            </NoticeAlert>

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

          <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
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
              <>
                <CustomerSegmentFilters value={segment} onChange={setSegment} />
                <CampaignAudienceSummary
                  state={audienceState}
                  data={audienceData}
                  quota={quota}
                  errorKind={audienceErrorKind}
                  onRetry={() => void audienceQuery.refetch()}
                />
              </>
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
        </div>

        <CampaignSendTime
          quietHours={quiet}
          value={sendTime}
          onChange={(value) => {
            setSendTime(value);
            setCheckedAt(Date.now());
          }}
          errors={sendTimeErrors}
        />
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
              {previewScheduled ? t("campaign.schedule") : t("campaign.send")}
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

            {preview.quiet_hours_shifted ? (
              <NoticeAlert
                tone="warning"
                icon={Moon}
                data-testid="campaign-confirm-shifted"
                title={t("campaign.confirmShifted", {
                  when: campaignTime.inline(preview.scheduled_for_tashkent ?? preview.scheduled_for) ?? "",
                })}
              >
                {t("campaign.confirmShiftedText", {
                  requested: campaignTime.format(preview.requested_at) ?? "",
                  ...(quiet ? { from: hhmm(quiet.start), to: hhmm(quiet.end) } : { from: "18:00", to: "09:00" }),
                })}
              </NoticeAlert>
            ) : scheduledLater ? (
              <NoticeAlert
                tone="info"
                icon={previewScheduled ? CalendarClock : Clock}
                title={t("campaign.confirmScheduled", { time: confirmWhen ?? "" })}
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
            {overQuota && quota ? (
              <NoticeAlert tone="danger">
                {t("audience.quotaExceeded", {
                  need: formatNumberLocalized(preview.recipients, { language }),
                  left: formatNumberLocalized(quota.remaining, { language }),
                })}
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
              {previewScheduled ? t("campaign.confirmCancellable") : t("campaign.confirmIrreversible")}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};

export default CampaignPage;
