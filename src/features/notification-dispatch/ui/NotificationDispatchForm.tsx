// dizayn-v2: superadmin-notifications-send, superadmin-notifications-send-confirm-dialog, superadmin-notifications-send-result, superadmin-notifications-send-unknown, superadmin-notifications-send-audience, superadmin-notifications-send-states, superadmin-notifications-send-schedule, superadmin-notifications-send-confirm-scheduled-dialog
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { CalendarClock, Clock, Lock, Send, TriangleAlert, Users, X } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type InboxNotification,
} from "../../../entities/notification-inbox";
import { useMarkets } from "../../../entities/markets";
import {
  AudienceBuilder,
  audienceGate,
  audiencePreviewErrorKind,
  audiencePreviewState,
  canSendAudience,
  createAudienceDraft,
  isFutureSlot,
  isQuietTime,
  quietReleaseMoment,
  tashkentNowIso,
  toAudienceTarget,
  useAudienceDescription,
  useAudiencePreview,
  useCreateCampaign,
  useCampaignTime,
  useClock,
  useRecountAudience,
  useSchedulePolicy,
  useSchedulePolicyInfo,
  type AudienceBuilderErrors,
  type AudienceDraft,
  type AudienceGate,
  type AudienceTarget,
  type CampaignCreated,
  type CampaignPayload,
} from "../../../entities/notification-campaign";
import { NoticeAlert } from "../../../entities/notification";
import {
  SentDetailDialog,
  deriveDispatchStatus,
  isDispatchHistoryStatus,
  type DispatchHistoryStatus,
} from "../../../entities/notification-dispatch";
import { cx } from "../../../shared/lib/cx";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { useDebounce } from "../../../shared/lib/useDebounce";
import {
  Button,
  Card,
  Dialog,
  Field,
  IconButton,
  SegmentedControl,
  Select,
  TextInput,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  useDispatchNotification,
  useRecipientSearch,
  type DispatchResult,
  type RecipientUser,
} from "../api/useDispatchNotification";
import { createDispatchAttempts, dispatchFingerprint } from "../model/clientRequestId";
import { classifyCampaignError } from "../model/campaignError";
import { classifyDispatchError } from "../model/dispatchError";
import {
  DISPATCH_LIMITS,
  RECIPIENT_MODES,
  buildCampaignPayload,
  buildDispatchPayload,
  createDefaultSchedule,
  createDefaultValues,
  createDispatchSchema,
  type CampaignScheduleValue,
  type DispatchFormValues,
  type DispatchPayload,
} from "../model/schema";
import { CampaignProgressCard } from "./CampaignProgressCard";
import { CampaignScheduleCard, type CampaignScheduleErrors } from "./CampaignScheduleCard";
import { CHOICE_CARD, CHOICE_INPUT } from "./choiceCard";
import { DispatchResultCard } from "./DispatchResultCard";
import { DispatchUnknownCard } from "./DispatchUnknownCard";

/** «Hamma» soni — backend o'zi sanaydi (`POST notifications/audience/preview`). */
const BROADCAST_TARGET = { broadcast: true as const };

/** Yuborilgan so'rov (`client_request_id` bilan) va uning barmoq izi — «Qayta urinish» aynan shuni yuboradi. */
type SentRequest = { request: DispatchPayload & { client_request_id: string }; fingerprint: string; sentAt: string };

/**
 * Yuborishdan keyingi holat (forma qulflanadi): `result` — javob keldi (natija kartasi); `unknown` — javob kelmadi
 * yoki backend «hali yuborilmoqda» dedi (natija noma'lum kartasi).
 */
/**
 * Kampaniya so'rovi (KM-2): `Idempotency-Key` mazmunga bog'langan (`attempts`), `preview` — tasdiq paytidagi son va
 * chegara. `target` — nishon: 400 bo'lsa son QAYTA sanaladi (backend yaratishda qayta sanaydi; tasdiq paytidagi son
 * chegarada bo'lgani uchun tushunarli matn faqat yangi sondan chiqadi).
 */
type CampaignRequest = {
  payload: CampaignPayload;
  target: AudienceTarget;
  key: string;
  fingerprint: string;
  preview: { total: number; campaignMax: number | null };
  sentAt: string;
};

type DispatchOutcome =
  | (SentRequest & { kind: "result"; result: DispatchResult; status: DispatchHistoryStatus })
  | (SentRequest & { kind: "unknown"; reason: "timeout" | "running" })
  | (CampaignRequest & { kind: "campaign"; created: CampaignCreated })
  | (CampaignRequest & { kind: "campaignUnknown" });

/**
 * Tasdiq oynasidagi kampaniya: so'rov, konstruktor holati va yuborish lahzasi — «Darhol» da hozir, «Belgilangan
 * vaqtda» — tanlangan vaqt (`scheduled_at`); reklamada tungi taqiq shu lahza bo'yicha tekshiriladi.
 */
type CampaignConfirm = {
  payload: CampaignPayload;
  target: AudienceTarget;
  draft: AudienceDraft;
  preview: CampaignRequest["preview"];
  requestedAt: string;
  /** «Belgilangan vaqtda» — tanlangan Toshkent kuni va soati. */
  scheduled: { day: string; time: string } | null;
};

const GATE_ERRORS: Partial<Record<AudienceGate, keyof AudienceBuilderErrors>> = {
  noKind: "kinds",
  noStaffRole: "staffRoles",
  needsCustomerFilter: "customer",
};
const GATE_ERROR_KEYS: Record<keyof AudienceBuilderErrors, string> = {
  kinds: "campaign.errors.kinds",
  staffRoles: "campaign.errors.staffRoles",
  customer: "campaign.errors.customerFilter",
};

const LOCKED_KEYS: Record<DispatchOutcome["kind"], string> = {
  result: "dispatch.lockedSent",
  unknown: "dispatch.lockedUnknown",
  campaign: "campaign.progress.locked",
  campaignUnknown: "campaign.progress.lockedUnknown",
};

type SendError = { title: string; text: string };

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "roleAdmin",
  manager: "roleManager",
  registrator: "roleRegistrator",
  courier: "roleCourier",
  market: "roleMarket",
  operator: "roleOperator",
  customer: "roleCustomer",
};

type MarketOption = { id?: string | number; name?: string };

const toMarkets = (value: unknown): MarketOption[] => {
  const record = (value ?? {}) as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | unknown[] | undefined;
  if (Array.isArray(value)) return value as MarketOption[];
  if (Array.isArray(data)) return data as MarketOption[];
  if (Array.isArray(record.items)) return record.items as MarketOption[];
  if (data && Array.isArray((data as Record<string, unknown>).items)) {
    return (data as Record<string, unknown>).items as MarketOption[];
  }
  return [];
};


type ChoiceCheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  /** Izohli kartada nom qalin emas (maket `-send-audience`: «Ochiq ekranga», «Push»). */
  plainLabel?: boolean;
  className?: string;
};

/** Belgilash katakchali karta (rol, kanal). */
const ChoiceCheckbox = ({
  checked,
  disabled,
  onChange,
  label,
  hint,
  hintId,
  plainLabel = false,
  className,
}: ChoiceCheckboxProps) => (
  <label className={cx(CHOICE_CARD, disabled && !checked && "text-text-subtle", className)}>
    <input
      type="checkbox"
      className={CHOICE_INPUT}
      checked={checked}
      disabled={disabled}
      // Izohli kartada nom — faqat sarlavha, izoh — tavsif (`aria-describedby`).
      aria-labelledby={hint && hintId ? `${hintId}-label` : undefined}
      aria-describedby={hintId}
      onChange={(event) => onChange?.(event.target.checked)}
    />
    {hint ? (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          id={hintId ? `${hintId}-label` : undefined}
          className={cx(!plainLabel && "font-semibold", !(disabled && !checked) && "text-text")}
        >
          {label}
        </span>
        <span id={hintId} className={cx("text-xs", !(disabled && !checked) && "text-text-muted")}>
          {hint}
        </span>
      </span>
    ) : (
      <span className="min-w-0">{label}</span>
    )}
  </label>
);

type NotificationDispatchFormProps = {
  /** Oldindan ko'rish kartasi (inbox'dagi haqiqiy ko'rinish) — sahifa beradi. */
  renderPreview: (notification: InboxNotification) => ReactNode;
};

/**
 * XABAR YUBORISH — `POST /notifications/dispatch` (superadmin/admin), dizayn v2 (maketlar
 * `superadmin-notifications-send`, `-send-confirm-dialog`).
 *
 * Chap ustun: «Kimga» (Bitta odam · Tanlangan ro'yxat · Auditoriya · Hamma; taxminiy son — «Hamma» da backend preview'dan),
 * «Kanal» (Ilova ichida doim yoqiq; Darhol, Telegram, SMS, Push; SMS — ogohlantirish, Telegram — market guruhi). O'ng ustun: «Mazmun» (Sarlavha*, Matn, Kategoriya, Muhimlik, Havola, Guruh kaliti*),
 * «Oldindan ko'rish» (inbox kartasi) + «Yuborish». Telefonda ustunlar ketma-ket.
 *
 * Tasdiq oynasi (`Dialog role="alertdialog"`): Kimga · Qabul qiluvchilar taxminan · Kanallar · to'liq xabar; «Hamma» da
 * qizil ogohlantirish va qizil tugma. Ikki marta yuborilmaydi (`submittingRef` + `isPending`).
 *
 * Natija (NS-1, maketlar `*-send-result`, `*-send-unknown`) — formadan YUQORIDA alohida karta, forma qulflanadi
 * («Yangi xabar» gacha): javob keldi — `DispatchResultCard` (kanal kesimi, «Yetkazilmaganlar» darhol); javobsiz /
 * 502–504 — `DispatchUnknownCard` («Tarixdan tekshirish», «Qayta urinish» o'sha `client_request_id` bilan, «Yangi
 * xabar»). Xato matni faqat i18n (`model/dispatchError.ts`), backend `message` ko'rsatilmaydi (ega S4).
 *
 * Takror himoyasi — `client_request_id` (`model/clientRequestId.ts`): har yuborish urinishiga bitta UUID, mazmunga
 * bog'langan. Xatodan keyin aynan shu mazmun qayta yuborilsa — o'sha id (backend ikkinchi marta yubormaydi); mazmun
 * o'zgarsa, muvaffaqiyatdan yoki «Yangi xabar» dan keyin — yangi id. Backend takrorni tarixdagi natija bilan qaytaradi
 * (`duplicate`): yuborilgan — natija kartasi + «Avval yuborilgan»; `running` — natija noma'lum («Hali yuborilmoqda»);
 * `failed` — avvalgi urinish xato bilan tugagan (forma ochiladi, keyingi «Yuborish» — yangi urinish).
 *
 * «AUDITORIYA» (KM-2, maketlar `-send-audience`, `-send-states`): «Rol» rejimi o'rnida — doim kampaniya (ega KM-S1).
 * Konstruktor (`AudienceBuilder`) → nishon → jonli son (`POST audience/preview`, debounce); segmentsiz mijozlar
 * so'ralmaydi. «Kanal» — Ilova ichida · Ochiq ekranga · Push (Telegram — «Kampaniyada yo'q», SMS — KM-5); guruh kaliti
 * yo'q. «Yuborish» son hisoblanmaguncha, 0 ta, xato yoki chegaradan katta bo'lsa o'chiq. Tasdiq — kampaniya xulosasi
 * (Kimga, aniq son, kanallar, kategoriya, «Darhol»; reklama tungi taqiqqa tushsa — `schedule-policy` bo'yicha qachon
 * ketishi). `POST /notifications/campaigns` + `Idempotency-Key` (mazmunga bog'langan, `attempts`): javobsiz / 502–504 —
 * «Javob kelmadi» va «Qayta urinish» AYNI kalit bilan; 400 — preview limitlaridan tushunarli matn. Natija —
 * `CampaignProgressCard` (har 3 s, «Bekor qilish»). Rejalashtirish va tarix — KM-3.
 */
const NotificationDispatchForm = ({ renderPreview }: NotificationDispatchFormProps) => {
  const { t, i18n } = useTranslation("notifications");
  const { t: tUsers } = useTranslation("users");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const schema = useMemo(() => createDispatchSchema(t), [t]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DispatchFormValues>({
    defaultValues: createDefaultValues(),
    resolver: yupResolver(schema) as unknown as Resolver<DispatchFormValues>,
  });
  const values = useWatch({ control }) as DispatchFormValues;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const updateSearch = useDebounce((value: string) => setDebouncedSearch(value.trim()), 350);
  /** Tanlangan foydalanuvchilar nomi — qidiruv o'zgarsa ham tanlov yorlig'i yo'qolmasin. */
  const [selectedUsers, setSelectedUsers] = useState<Record<string, RecipientUser>>({});

  const needsUserSearch = values.mode === "single" || values.mode === "list";
  const recipientsQuery = useRecipientSearch(debouncedSearch, needsUserSearch);

  // «Auditoriya» (KM-2): konstruktor → nishon → jonli son. «Hamma» ham shu so'rov bilan sanaladi.
  const isAudience = values.mode === "audience";
  const audienceDraft = values.audience ?? createAudienceDraft();
  const gate = audienceGate(audienceDraft);
  const audienceTarget = isAudience ? toAudienceTarget(audienceDraft) : null;
  const audiencePreview = useAudiencePreview(
    isAudience ? audienceTarget : values.mode === "all" ? BROADCAST_TARGET : null,
  );
  const previewState = isAudience ? audiencePreviewState(gate, audiencePreview) : "idle";
  const previewErrorKind =
    audiencePreview.error || audiencePreview.isPaused
      ? audiencePreviewErrorKind(audiencePreview.error, audiencePreview.isPaused)
      : undefined;
  /** Yuborishga urinilgach konstruktor xatolari ko'rinadi. */
  const [audienceTouched, setAudienceTouched] = useState(false);
  const gateError = GATE_ERRORS[gate];
  const audienceErrors: AudienceBuilderErrors =
    audienceTouched && gateError ? { [gateError]: t(GATE_ERROR_KEYS[gateError]) } : {};
  /** «Yangi xabar» — konstruktor ichki holati (tanlangan segment, market nomi) ham boshidan. */
  const [builderEpoch, setBuilderEpoch] = useState(0);

  // KM-3: «Yuborish vaqti». Reklama (`marketing`) tungi taqiq soatlari — `schedule-policy` dan (kodda qotirilmaydi).
  const promo = values.category === "marketing";
  const schedulePolicy = useSchedulePolicyInfo(values.category, isAudience);
  const schedule: CampaignScheduleValue = values.schedule ?? createDefaultSchedule();
  const scheduled = isAudience && schedule.when === "scheduled";
  const campaignTime = useCampaignTime();
  const clock = useClock();
  /**
   * Yuborishda haqiqiy vaqt bilan tekshiruv rad etsa — soat darhol shu lahzaga suriladi, aks holda (30 s qadamli soat
   * eskirgan bo'lsa) «Rejalashtirish» hech narsa ko'rsatmay qolardi.
   */
  const [syncedAt, setSyncedAt] = useState(0);
  const now = Math.max(clock, syncedAt);
  /**
   * Sana/soat xatosi. «Tanlang» — faqat yuborishga urinilgach; o'tib ketgan vaqt va (kategoriya reklamaga
   * o'zgartirilsa) taqiq soati — darhol.
   */
  const validateSchedule = (
    value: CampaignScheduleValue,
    touched: boolean,
    at: number,
  ): CampaignScheduleErrors => {
    if (value.when !== "scheduled") return {};
    if (!value.day) return touched ? { day: t("campaign.schedule.errors.day") } : {};
    if (!value.time) return touched ? { time: t("campaign.schedule.errors.time") } : {};
    if (!isFutureSlot(value.day, value.time, at)) return { time: t("campaign.schedule.errors.past") };
    const quiet = schedulePolicy.data?.quietHours;
    if (promo && quiet && isQuietTime(value.time, quiet)) {
      return { time: t("campaign.schedule.errors.quiet", { start: quiet.start, end: quiet.end }) };
    }
    return {};
  };
  const scheduleErrors = isAudience ? validateSchedule(schedule, audienceTouched, now) : {};
  /** Reklama taqiqi hali kelmagan — soat tekshirib bo'lmaydi, «Rejalashtirish» kutadi. */
  const policyPending = scheduled && promo && schedulePolicy.isLoading;

  const estimate: { count: number | null; loading: boolean } =
    values.mode === "single"
      ? { count: 1, loading: false }
      : values.mode === "list"
        ? { count: values.recipient_ids?.length ?? 0, loading: false }
        : values.mode === "all"
          ? audiencePreview.current && audiencePreview.data
            ? { count: audiencePreview.data.total, loading: false }
            : { count: null, loading: !(audiencePreview.settled && audiencePreview.isError) }
          : { count: null, loading: false };
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets(
    { status: "active", limit: 100 },
    Boolean(values.telegram) && values.mode !== "audience",
  );
  const markets = toMarkets(marketsQuery.data);

  const dispatchMutation = useDispatchNotification();
  const campaignMutation = useCreateCampaign();
  const sending = dispatchMutation.isPending || campaignMutation.isPending;
  const [confirmPayload, setConfirmPayload] = useState<DispatchPayload | null>(null);
  const [confirmCampaign, setConfirmCampaign] = useState<CampaignConfirm | null>(null);
  const confirmOpen = Boolean(confirmPayload || confirmCampaign);
  const confirmDescription = useAudienceDescription(confirmCampaign?.draft ?? audienceDraft, {
    enabled: Boolean(confirmCampaign),
  });
  const quietPolicy = useSchedulePolicy(
    { scheduled_at: confirmCampaign?.requestedAt, category: confirmCampaign?.payload.category },
    Boolean(confirmCampaign) && confirmCampaign?.payload.category === "marketing",
  );
  const quietCheck = confirmCampaign && quietPolicy.data?.check?.shifted ? quietPolicy.data : null;
  /** Reklama: tungi taqiq tekshiruvi kelguncha «Ha, yuborish» o'chiq — ogohlantirishsiz tasdiqlanmasin. */
  const quietPending =
    confirmCampaign?.payload.category === "marketing" && quietPolicy.isFetching;
  const recountAudience = useRecountAudience();
  /** 400 dan keyin son qayta sanalmoqda — «Yuborish» kutadi. */
  const [recounting, setRecounting] = useState(false);
  const [outcome, setOutcome] = useState<DispatchOutcome | null>(null);
  const [sendError, setSendError] = useState<SendError | null>(null);
  /** «Qayta urinish» rad etildi (natija noma'lum kartasida). */
  const [retryError, setRetryError] = useState<string | null>(null);
  /** Tafsilot oynasi («Tarixdan tekshirish», «Barcha N tasini ko'rish») — `dispatch_id`. */
  const [detailId, setDetailId] = useState<string | null>(null);
  /** Tafsilot natija noma'lum kartasidan ochildimi (404 matni — «Qayta urinish» ga yo'naltiradi). */
  const [detailFromUnknown, setDetailFromUnknown] = useState(false);
  const submittingRef = useRef(false);
  /**
   * Joriy urinish raqami: «Yangi xabar» uni oshiradi — eski (hali tugamagan) so'rov javobi yangi formaga tushmaydi va
   * `submittingRef` ni qulflab qoldirmaydi (`mutation.reset()` dan keyin har chaqiruv callback'lari chaqirilmaydi).
   */
  const attemptRef = useRef(0);
  const [attempts] = useState(createDispatchAttempts);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [previewCreatedAt] = useState(() => new Date().toISOString());

  // Yuborilgan (yoki natijasi noma'lum) xabar shu formadan qayta yuborilmaydi —
  // faqat "Yangi xabar" orqali (yangi guruh kaliti bilan) yoki noma'lumda «Qayta urinish» (o'sha id).
  const locked = Boolean(outcome);
  /** Tasdiq oynasi yopilgach fokus: natija kartasi chiqsa — unga, aks holda «Yuborish» tugmasiga. */
  const outcomeRef = useRef<HTMLDivElement>(null);
  const outcomeKey = outcome
    ? `${outcome.kind}:${"request" in outcome ? outcome.request.client_request_id : outcome.key}`
    : null;
  // Natija almashganda (noma'lum → «Qayta urinish» → natija) fokus yangi kartaga — bosilgan tugma o'chib ketadi.
  // Tasdiq oynasidan keyingi birinchi natija — oynaning `returnFocus` i orqali.
  useEffect(() => {
    if (outcomeKey && !confirmOpen) outcomeRef.current?.focus({ preventScroll: true });
  }, [outcomeKey, confirmOpen]);

  const userLabel = (user: RecipientUser) =>
    [user.name, user.phone_number, user.role].filter(Boolean).join(" · ");

  const userOptions = useMemo<SelectOption[]>(() => {
    const found = recipientsQuery.data?.items ?? [];
    const merged = new Map<string, RecipientUser>();
    for (const user of Object.values(selectedUsers)) merged.set(user.id, user);
    for (const user of found) merged.set(user.id, user);
    return Array.from(merged.values()).map((user) => ({
      value: user.id,
      label: user.name,
      description:
        [
          user.phone_number ? formatPhone(user.phone_number) : "",
          user.role ? tUsers(ROLE_LABEL_KEYS[user.role] ?? user.role) : "",
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      searchText: user.phone_number,
    }));
  }, [recipientsQuery.data, selectedUsers, tUsers]);

  /** Tanlov yorlig'i uchun foydalanuvchini eslab qoladi (qidiruv natijasi o'zgarsa ham). */
  const rememberUser = (id: string) => {
    const user = selectedUsers[id] ?? recipientsQuery.data?.items.find((item) => item.id === id);
    if (user) setSelectedUsers((prev) => ({ ...prev, [id]: user }));
  };

  const searchProps = {
    searchable: true as const,
    filter: false as const,
    onSearchChange: (value: string) => updateSearch(value),
    loading: recipientsQuery.isFetching,
    loadingText: t("dispatch.recipientsLoading"),
    emptyText: t("dispatch.recipientsEmpty"),
    noOptionsText: t("dispatch.recipientsEmpty"),
    disabled: locked,
  };

  const channelLabels = (channels: string[]) =>
    channels.map((channel) => t(`dispatch.channel.${channel}`)).join(", ");
  /** Kampaniyada «Darhol (ochiq ekranga)» — «Ochiq ekranga» (yuborish vaqti «Darhol» bilan adashmasin). */
  const campaignChannelLabels = (channels: string[]) =>
    channels
      .map((channel) => (channel === "realtime" ? t("campaign.channel.realtime") : t(`dispatch.channel.${channel}`)))
      .join(", ");

  const recipientSummary = (payload: DispatchPayload) => {
    if (payload.broadcast) return t("dispatch.confirmAll");
    if (payload.recipient_ids) {
      const names = payload.recipient_ids.map((id) => selectedUsers[id]?.name ?? `#${id}`);
      return `${t("dispatch.confirmList", { count: names.length })}: ${names.join(", ")}`;
    }
    const user = payload.recipient_id ? selectedUsers[payload.recipient_id] : undefined;
    return t("dispatch.confirmSingle", {
      name: user ? userLabel(user) : `#${payload.recipient_id}`,
    });
  };

  const onValid = (formValues: DispatchFormValues) => {
    if (locked) return;
    setSendError(null);
    if (formValues.mode === "audience") {
      setAudienceTouched(true);
      const target = toAudienceTarget(formValues.audience);
      const data = audiencePreview.data;
      // Son hali hisoblanmagan, 0, chegaradan katta yoki xato — yuborilmaydi (tugma o'chiq, sababi ostida).
      if (!target || !canSendAudience(previewState) || !data) return;
      // Vaqt tanlanmagan, o'tib ketgan yoki taqiqqa tushgan — xato kartada.
      if (policyPending) return;
      const at = Date.now();
      if (Object.keys(validateSchedule(formValues.schedule, true, at)).length) {
        setSyncedAt(at);
        return;
      }
      const payload = buildCampaignPayload(formValues, target);
      setConfirmCampaign({
        payload,
        target,
        draft: formValues.audience,
        preview: { total: data.total, campaignMax: data.campaignMax },
        requestedAt: payload.scheduled_at ?? tashkentNowIso(),
        scheduled: payload.scheduled_at
          ? { day: formValues.schedule.day, time: formValues.schedule.time }
          : null,
      });
      return;
    }
    setConfirmPayload(buildDispatchPayload(formValues));
  };

  const errorText = (error: unknown) => {
    const kind = classifyDispatchError(error);
    return kind.kind === "error" ? t(kind.messageKey) : null;
  };

  /**
   * Bitta urinish: `sent` — so'rov (o'z `client_request_id` i bilan). `retry` — natija noma'lum kartasidagi «Qayta
   * urinish» (xato forma ostida emas, kartada ko'rinadi).
   */
  const send = (sent: SentRequest, retry: boolean) => {
    if (submittingRef.current || sending) return;
    submittingRef.current = true;
    const token = ++attemptRef.current;
    const current = () => token === attemptRef.current;
    setRetryError(null);
    dispatchMutation.mutate(sent.request, {
      onSuccess: (response) => {
        if (!current()) return;
        setConfirmPayload(null);
        if (response.duplicate && response.status === "running") {
          // Ayni id bilan avvalgi so'rov hali ishlanmoqda — natija noma'lum, qayta yuborilmaydi.
          setOutcome({ ...sent, kind: "unknown", reason: "running" });
          return;
        }
        attempts.settle(sent.fingerprint);
        if (response.duplicate && response.status === "failed") {
          // Avvalgi urinish xato bilan tugagan, backend qayta yubormadi. Keyingi «Yuborish» — yangi urinish (yangi id).
          setOutcome(null);
          setSendError({ title: t("dispatch.duplicateFailedTitle"), text: t("dispatch.duplicateFailedText") });
          return;
        }
        const status =
          response.duplicate && isDispatchHistoryStatus(response.status)
            ? response.status
            : deriveDispatchStatus(response);
        setOutcome({ ...sent, kind: "result", result: response, status });
      },
      onError: (error) => {
        if (!current()) return;
        setConfirmPayload(null);
        // Id saqlanadi (`settle` yo'q): aynan shu mazmun qayta yuborilsa backend uni ikkinchi marta yubormaydi.
        const text = errorText(error);
        if (text === null) {
          // Javobsiz / 502-504: qatorlar yozilgan bo'lishi mumkin — natija noma'lum. QAYTA YUBORILMAYDI.
          setOutcome({ ...sent, kind: "unknown", reason: "timeout" });
          return;
        }
        if (retry) {
          setRetryError(text);
          return;
        }
        setSendError({ title: t("dispatch.sendFailed"), text });
      },
      onSettled: () => {
        if (current()) submittingRef.current = false;
      },
    });
  };

  /**
   * Kampaniya (KM-2): `POST /notifications/campaigns` + `Idempotency-Key`. Javobsiz / 502–504 — natija noma'lum
   * (kampaniya yaratilgan bo'lishi mumkin): «Qayta urinish» AYNI kalit bilan, backend ikkinchisini yaratmaydi.
   */
  const sendCampaign = (request: CampaignRequest, retry: boolean) => {
    if (submittingRef.current || sending || recounting) return;
    submittingRef.current = true;
    const token = ++attemptRef.current;
    const current = () => token === attemptRef.current;
    const release = () => {
      if (current()) submittingRef.current = false;
    };
    setRetryError(null);
    const showError = (kind: Extract<ReturnType<typeof classifyCampaignError>, { kind: "error" }>) => {
      const values = Object.fromEntries(
        Object.entries(kind.values ?? {}).map(([key, value]) => [key, count(value)]),
      );
      const text = t(kind.messageKey, values);
      if (retry) {
        setRetryError(text);
        return;
      }
      setSendError({ title: t("campaign.createError.title"), text });
    };
    campaignMutation.mutate(
      { payload: request.payload, idempotencyKey: request.key },
      {
        onSuccess: (created) => {
          if (!current()) return;
          setConfirmCampaign(null);
          attempts.settle(request.fingerprint);
          setOutcome({ ...request, kind: "campaign", created });
          release();
        },
        onError: (error) => {
          if (!current()) return;
          setConfirmCampaign(null);
          const status = getErrorStatus(error);
          if (retry && status === 409) {
            // Ayni Idempotency-Key bilan qayta urinishda 409 — birinchi urinish kampaniyani YARATGAN (masalan
            // rejalashtirilgan vaqt o'tib, backend mazmunni boshqacha hisobladi). «Qaytadan yozing» demaymiz — ikkinchi
            // ommaviy yuborish bo'lardi; tarixdan tekshirishga yo'naltiramiz.
            setRetryError(t("campaign.progress.retryConflict"));
            release();
            return;
          }
          if (status !== 400 && status !== 422) {
            const kind = classifyCampaignError(error, request.preview);
            if (kind.kind === "unknown") setOutcome({ ...request, kind: "campaignUnknown" });
            else showError(kind);
            release();
            return;
          }
          // 400: backend yaratishda qayta sanadi — son o'zgargan (0 yoki chegaradan oshgan) bo'lishi mumkin. Tasdiq
          // paytidagi son chegarada edi, shuning uchun o'sha nishon qayta sanaladi: matn yangi sondan, «Kimga» bloki va
          // «Yuborish» ham yangi son bilan (eski «tayyor» son qolmaydi). Sanab bo'lmasa — umumiy rad matni.
          setRecounting(true);
          void recountAudience(request.target)
            .then(
              (fresh) => ({ total: fresh.total, campaignMax: fresh.campaignMax }),
              () => null,
            )
            .then((fresh) => {
              if (!current()) return;
              setRecounting(false);
              const kind = classifyCampaignError(error, fresh);
              if (kind.kind === "error") showError(kind);
              release();
            });
        },
      },
    );
  };

  const confirmSend = () => {
    if (confirmCampaign) {
      // Oyna ochiq turganda tanlangan vaqt o'tib ketgan bo'lsa — yubormaymiz (backend o'tgan vaqtni «darhol» deb oladi,
      // reklamani esa ertalabga suradi): oyna yopiladi, kartada «Bu vaqt o'tib ketdi».
      const slot = confirmCampaign.scheduled;
      if (slot && !isFutureSlot(slot.day, slot.time, Date.now())) {
        setConfirmCampaign(null);
        setSyncedAt(Date.now());
        return;
      }
      const fingerprint = `campaign:${JSON.stringify(confirmCampaign.payload)}`;
      sendCampaign(
        {
          payload: confirmCampaign.payload,
          target: confirmCampaign.target,
          key: attempts.take(fingerprint),
          fingerprint,
          preview: confirmCampaign.preview,
          sentAt: new Date().toISOString(),
        },
        false,
      );
      return;
    }
    if (!confirmPayload) return;
    // Bitta urinish — bitta id: xatodan keyin aynan shu mazmun qayta yuborilsa o'sha id ketadi.
    const fingerprint = dispatchFingerprint(confirmPayload);
    send(
      {
        request: { ...confirmPayload, client_request_id: attempts.take(fingerprint) },
        fingerprint,
        sentAt: new Date().toISOString(),
      },
      false,
    );
  };

  const retryUnknown = () => {
    if (outcome?.kind === "campaignUnknown") {
      sendCampaign(
        {
          payload: outcome.payload,
          target: outcome.target,
          key: outcome.key,
          fingerprint: outcome.fingerprint,
          preview: outcome.preview,
          sentAt: outcome.sentAt,
        },
        true,
      );
      return;
    }
    if (outcome?.kind !== "unknown") return;
    send({ request: outcome.request, fingerprint: outcome.fingerprint, sentAt: outcome.sentAt }, true);
  };

  const startNewMessage = () => {
    // Tugamagan so'rov (masalan «Qayta urinish») endi bu formaga tegishli emas.
    attemptRef.current += 1;
    submittingRef.current = false;
    reset(createDefaultValues());
    attempts.clear();
    setOutcome(null);
    setSendError(null);
    setRetryError(null);
    setDetailId(null);
    setSelectedUsers({});
    setDebouncedSearch("");
    setConfirmPayload(null);
    setConfirmCampaign(null);
    setAudienceTouched(false);
    setRecounting(false);
    setBuilderEpoch((epoch) => epoch + 1);
    dispatchMutation.reset();
    campaignMutation.reset();
  };

  const previewNotification: InboxNotification = {
    id: "preview",
    type: `${values.category}.manual`,
    category: values.category,
    priority: values.priority,
    title: values.title?.trim() || t("dispatch.previewTitlePlaceholder"),
    body: values.body?.trim() || null,
    data: null,
    link: values.link?.trim() || null,
    is_read: false,
    read_at: null,
    created_at: previewCreatedAt,
  };

  const count = (value: number) => formatNumberLocalized(value, { language });
  const counter = (value: string | undefined, max: number) =>
    t("dispatch.counter", { count: count(value?.length ?? 0), max: count(max) });


  const confirmMessage: { title: string; body?: string; link?: string } | null =
    confirmCampaign?.payload ?? confirmPayload;
  /** Tasdiq oynasi «Belgilangan vaqtda» kampaniyasi uchun (maket `-send-confirm-scheduled-dialog`). */
  const confirmScheduled = confirmCampaign?.scheduled ?? null;
  /** Oyna ochiq turganda tanlangan vaqt o'tib ketdi — «Rejalashtirish» o'chiq, sababi oynada. */
  const slotPassed = Boolean(confirmScheduled && !isFutureSlot(confirmScheduled.day, confirmScheduled.time, now));
  /**
   * Reklama taqiqi ogohlantirishi (Toshkent vaqtida): «Darhol» va taqiq oynasi ma'lum — jonli soat bo'yicha (oyna
   * 17:59 da ochilib 18:01 da tasdiqlansa ham chiqadi, 09:00 dan keyin yo'qoladi); aks holda — backend tekshiruvi
   * (`check.shifted`, oyna ochilgan lahzaga).
   */
  const liveQuiet =
    confirmCampaign && !confirmScheduled && confirmCampaign.payload.category === "marketing"
      ? schedulePolicy.data?.quietHours
      : undefined;
  const liveRelease = liveQuiet ? quietReleaseMoment(liveQuiet, now) : null;
  const quietWhen = liveQuiet
    ? liveRelease
      ? campaignTime.inlineMoment(liveRelease, now)
      : null
    : quietCheck?.check?.effectiveAt
      ? campaignTime.inline(quietCheck.check.effectiveAt, now)
      : null;
  const quietHoursShown = quietCheck?.quietHours ?? schedulePolicy.data?.quietHours ?? null;

  /**
   * «Auditoriya» da «Yuborish» o'chiq va sababi ostida: son hisoblanmoqda, xato, 0 ta yoki chegaradan katta. Konstruktor
   * tayyor bo'lmasa (tur / rol / mijoz filtri) — tugma bosiladi va xato kartada ko'rinadi.
   */
  const sendBlockedKey: string | null = !isAudience
    ? null
    : previewState === "loading"
      ? "campaign.disabled.counting"
      : previewState === "error"
        ? previewErrorKind === "offline"
          ? "campaign.disabled.offline"
          : "campaign.disabled.error"
        : previewState === "empty"
          ? "campaign.disabled.empty"
          : previewState === "overCap"
            ? "campaign.disabled.overCap"
            : policyPending
              ? "campaign.disabled.policy"
              : null;

  /** «Yuborish» ostidagi izoh (sababi yoki «Darhol · kampaniya · N ta»); yo'q bo'lsa tugma unga bog'lanmaydi. */
  const sendNote = !isAudience
    ? null
    : sendBlockedKey
      ? t(sendBlockedKey)
      : canSendAudience(previewState)
        ? !scheduled
          ? t("campaign.previewNote", {
              value: count(audiencePreview.data?.total ?? 0),
              count: audiencePreview.data?.total ?? 0,
            })
          : schedule.day && schedule.time && !scheduleErrors.time && !scheduleErrors.day
            ? t("campaign.previewNoteScheduled", {
                time: campaignTime.moment({ day: schedule.day, time: schedule.time }, now),
                value: count(audiencePreview.data?.total ?? 0),
                count: audiencePreview.data?.total ?? 0,
              })
            : // Vaqt hali tanlanmagan yoki xato — «Darhol» deyilmaydi (tugma «Rejalashtirish»).
              t("campaign.previewNoteScheduledPending", {
                value: count(audiencePreview.data?.total ?? 0),
                count: audiencePreview.data?.total ?? 0,
              })
        : null;

  return (
    <>
      {outcome ? (
        <div ref={outcomeRef} tabIndex={-1} className="min-w-0 outline-none">
          {outcome.kind === "campaign" ? (
            <CampaignProgressCard
              kind="created"
              title={outcome.payload.title}
              created={outcome.created}
              onNewMessage={startNewMessage}
            />
          ) : outcome.kind === "campaignUnknown" ? (
            <CampaignProgressCard
              kind="unknown"
              title={outcome.payload.title}
              retrying={campaignMutation.isPending}
              retryError={retryError}
              onRetry={retryUnknown}
              onNewMessage={startNewMessage}
            />
          ) : outcome.kind === "result" ? (
            <DispatchResultCard
              result={outcome.result}
              status={outcome.status}
              payload={outcome.request}
              dispatchId={outcome.result.dispatch_id ?? outcome.request.client_request_id}
              sentAt={outcome.sentAt}
              onNewMessage={startNewMessage}
              onOpenDetail={() => {
                setDetailFromUnknown(false);
                setDetailId(outcome.result.dispatch_id ?? outcome.request.client_request_id);
              }}
            />
          ) : (
            <DispatchUnknownCard
              reason={outcome.reason}
              sentAt={outcome.sentAt}
              retrying={dispatchMutation.isPending}
              retryError={retryError}
              onRetry={retryUnknown}
              onCheckHistory={() => {
                setDetailFromUnknown(true);
                setDetailId(outcome.request.client_request_id);
              }}
              onNewMessage={startNewMessage}
            />
          )}
        </div>
      ) : null}

      <form
        noValidate
        aria-label={t("dispatch.formLabel")}
        onSubmit={handleSubmit(onValid)}
        className="flex min-w-0 flex-wrap items-start gap-6 max-md:gap-4"
      >
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6 max-md:gap-4">
          <Card title={t("dispatch.sectionRecipients")} bodyClassName="flex flex-col gap-4">
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl
                  ariaLabel={t("dispatch.modeLabel")}
                  value={field.value}
                  onValueChange={(mode) => {
                    if (!locked) field.onChange(mode);
                  }}
                  fullWidth
                  className="max-md:flex-wrap max-md:[&>button]:basis-[calc(50%-1px)]"
                  options={RECIPIENT_MODES.map((mode) => ({
                    value: mode,
                    label: t(`dispatch.mode.${mode}`),
                    disabled: locked,
                  }))}
                />
              )}
            />

            {values.mode === "single" ? (
              <Field
                label={t("dispatch.mode.single")}
                labelAs="span"
                hideLabel
                error={errors.recipient_id?.message}
              >
                <Controller
                  control={control}
                  name="recipient_id"
                  render={({ field }) => (
                    <Select
                      {...searchProps}
                      clearable
                      placeholder={t("dispatch.recipientPlaceholder")}
                      options={userOptions}
                      value={field.value || null}
                      onChange={(value) => {
                        field.onChange(value ?? "");
                        if (value) rememberUser(value);
                      }}
                    />
                  )}
                />
              </Field>
            ) : null}

            {values.mode === "list" ? (
              <Controller
                control={control}
                name="recipient_ids"
                render={({ field }) => (
                  <div className="flex min-w-0 flex-col gap-3">
                    <Field
                      label={t("dispatch.mode.list")}
                      labelAs="span"
                      hideLabel
                      error={errors.recipient_ids?.message}
                    >
                      <Select
                        {...searchProps}
                        placeholder={t("dispatch.recipientsPlaceholder")}
                        options={userOptions.filter(
                          (option) => !field.value.includes(option.value),
                        )}
                        value={null}
                        onChange={(value) => {
                          if (!value || field.value.includes(value)) return;
                          rememberUser(value);
                          field.onChange([...field.value, value]);
                        }}
                      />
                    </Field>
                    {field.value.length ? (
                      <ul
                        aria-label={t("dispatch.recipientsSelected")}
                        className="m-0 flex list-none flex-wrap gap-2 p-0"
                      >
                        {field.value.map((id) => {
                          const name = selectedUsers[id]?.name ?? `#${id}`;
                          return (
                            <li
                              key={id}
                              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-sunken py-0.5 pr-0.5 pl-2.5 text-[13px] font-semibold text-text"
                            >
                              <span className="min-w-0 truncate">{name}</span>
                              <IconButton
                                size="sm"
                                icon={X}
                                label={t("dispatch.removeRecipient", { name })}
                                disabled={locked}
                                onClick={() =>
                                  field.onChange(field.value.filter((item) => item !== id))
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                )}
              />
            ) : null}

            {values.mode === "audience" ? (
              <Controller
                control={control}
                name="audience"
                render={({ field }) => (
                  <AudienceBuilder
                    key={builderEpoch}
                    value={field.value}
                    onChange={field.onChange}
                    target={audienceTarget}
                    previewState={previewState}
                    preview={audiencePreview.data}
                    previewErrorKind={previewErrorKind}
                    onRetryPreview={() => void audiencePreview.refetch()}
                    errors={audienceErrors}
                    disabled={locked}
                  />
                )}
              />
            ) : null}

            {values.mode === "all" ? (
              <NoticeAlert tone="warning">{t("dispatch.allHint")}</NoticeAlert>
            ) : null}

            {!isAudience && (estimate.loading || estimate.count !== null) ? (
              <NoticeAlert tone="neutral" icon={Users} data-testid="recipient-estimate">
                {estimate.loading ? (
                  t("dispatch.estimateLoading")
                ) : (
                  <Trans
                    t={t}
                    i18nKey="dispatch.estimate"
                    values={{ value: count(estimate.count ?? 0) }}
                    components={{ b: <span className="font-semibold text-text" /> }}
                  />
                )}
              </NoticeAlert>
            ) : null}
          </Card>

          <Card title={t("dispatch.sectionChannels")} bodyClassName="flex flex-col gap-4">
            {isAudience ? (
              // Kampaniya kanallari (maket `-send-audience` «Kanal»): Ilova ichida · Ochiq ekranga · Push; Telegram —
              // «Kampaniyada yo'q» (o'chiq); SMS — KM-5 gacha chizilmaydi («Taklif · backend kerak»).
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(max(220px,34%),100%),1fr))] gap-2">
                  <ChoiceCheckbox
                    checked
                    disabled
                    label={t("dispatch.channel.in_app")}
                    hint={t("dispatch.inAppAlways")}
                    hintId="campaign-inapp-hint"
                    className="col-span-full"
                  />
                  <Controller
                    control={control}
                    name="realtime"
                    render={({ field }) => (
                      <ChoiceCheckbox
                        checked={field.value}
                        disabled={locked}
                        label={t("campaign.channel.realtime")}
                        hint={t("campaign.channel.realtimeHint")}
                        hintId="campaign-realtime-hint"
                        plainLabel
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="push"
                    render={({ field }) => (
                      <ChoiceCheckbox
                        checked={field.value}
                        disabled={locked}
                        label={t("dispatch.channel.push")}
                        hint={
                          canSendAudience(previewState) && audiencePreview.data?.push != null
                            ? t("campaign.channel.pushHint", { value: count(audiencePreview.data.push) })
                            : t("campaign.channel.pushHintUnknown")
                        }
                        hintId="campaign-push-hint"
                        plainLabel
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <ChoiceCheckbox
                    checked={false}
                    disabled
                    label={t("dispatch.channel.telegram")}
                    hint={t("campaign.channel.telegramOff")}
                    hintId="campaign-telegram-hint"
                    plainLabel
                  />
                </div>
                <p className="m-0 text-xs text-text-muted">{t("campaign.channel.hint")}</p>
              </>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(max(220px,34%),100%),1fr))] gap-2">
                <ChoiceCheckbox
                  checked
                  disabled
                  label={t("dispatch.channel.in_app")}
                  hint={t("dispatch.inAppAlways")}
                  hintId="dispatch-inapp-hint"
                  className="col-span-full"
                />
                {(["realtime", "telegram", "sms", "push"] as const).map((channel) => (
                  <Controller
                    key={channel}
                    control={control}
                    name={channel}
                    render={({ field }) => (
                      <ChoiceCheckbox
                        checked={field.value}
                        disabled={locked}
                        label={t(`dispatch.channel.${channel}`)}
                        onChange={field.onChange}
                      />
                    )}
                  />
                ))}
              </div>
            )}

            {values.sms && !isAudience ? (
              <NoticeAlert tone="warning" role="note">
                {t("dispatch.smsHint")}
              </NoticeAlert>
            ) : null}

            {values.telegram && !isAudience ? (
              // Market ixtiyoriy (TgYRqaTk): tanlanmasa Telegram har qabul qiluvchining shaxsiy chatiga ketadi.
              <Field
                label={t("dispatch.telegramMarket")}
                labelAs="span"
                hint={t("dispatch.telegramHint")}
              >
                <Controller
                  control={control}
                  name="telegram_market_id"
                  render={({ field }) => (
                    <Select
                      searchable={markets.length > 8}
                      placeholder={t("dispatch.telegramMarketPlaceholder")}
                      options={markets.map((market) => ({
                        value: String(market.id),
                        label: market.name ?? `#${market.id}`,
                      }))}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      clearable
                      loading={marketsQuery.isLoading}
                      disabled={locked}
                    />
                  )}
                />
              </Field>
            ) : null}
          </Card>

          {isAudience ? (
            <Controller
              control={control}
              name="schedule"
              render={({ field }) => (
                <CampaignScheduleCard
                  value={field.value}
                  onChange={field.onChange}
                  promo={promo}
                  policy={schedulePolicy.data}
                  policyLoading={schedulePolicy.isLoading}
                  errors={scheduleErrors}
                  disabled={locked}
                  now={now}
                />
              )}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-6 max-md:gap-4">
          <Card title={t("dispatch.sectionContent")} bodyClassName="flex flex-col gap-4">
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <Field
                  label={t("dispatch.title")}
                  required
                  hintLive
                  hint={
                    <span className="block text-right text-text-subtle tabular-nums">
                      {counter(field.value, DISPATCH_LIMITS.title)}
                    </span>
                  }
                  error={errors.title?.message}
                >
                  <TextInput
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder={t("dispatch.titlePlaceholder")}
                    maxLength={DISPATCH_LIMITS.title}
                    disabled={locked}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="body"
              render={({ field }) => (
                <Field
                  label={t("dispatch.body")}
                  hintLive
                  hint={
                    <span className="block text-right text-text-subtle tabular-nums">
                      {counter(field.value, DISPATCH_LIMITS.body)}
                    </span>
                  }
                  error={errors.body?.message}
                >
                  <TextInput
                    multiline
                    rows={4}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t("dispatch.bodyPlaceholder")}
                    maxLength={DISPATCH_LIMITS.body}
                    disabled={locked}
                  />
                </Field>
              )}
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-4">
              <Field label={t("dispatch.category")} labelAs="span">
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      options={NOTIFICATION_CATEGORIES.map((category) => ({
                        value: category,
                        label: t(`category.${category}`),
                      }))}
                      value={field.value}
                      onChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                      disabled={locked}
                    />
                  )}
                />
              </Field>
              <Field label={t("dispatch.priority")} labelAs="span">
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      options={NOTIFICATION_PRIORITIES.map((priority) => ({
                        value: priority,
                        label: t(`priority.${priority}`),
                      }))}
                      value={field.value}
                      onChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                      disabled={locked}
                    />
                  )}
                />
              </Field>
            </div>
            <Controller
              control={control}
              name="link"
              render={({ field }) => (
                <Field label={t("dispatch.link")} error={errors.link?.message}>
                  <TextInput
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t("dispatch.linkPlaceholder")}
                    maxLength={DISPATCH_LIMITS.link}
                    disabled={locked}
                  />
                </Field>
              )}
            />
            {isAudience ? null : (
              <Controller
                control={control}
                name="group_key"
                render={({ field }) => (
                  <Field
                    label={t("dispatch.groupKey")}
                    required
                    hint={t("dispatch.groupKeyHint")}
                    error={errors.group_key?.message}
                  >
                    <TextInput
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      maxLength={DISPATCH_LIMITS.groupKey}
                      disabled={locked}
                    />
                  </Field>
                )}
              />
            )}
          </Card>

          <Card title={t("dispatch.sectionPreview")} bodyClassName="flex flex-col gap-4">
            <div data-testid="dispatch-preview">{renderPreview(previewNotification)}</div>

            {sendError ? (
              <NoticeAlert tone="danger" title={sendError.title}>
                {sendError.text}
              </NoticeAlert>
            ) : null}

            {outcome ? (
              <p className="m-0 flex items-center gap-2 text-[13px] text-text-muted" data-testid="dispatch-locked">
                <Lock size={16} aria-hidden="true" className="shrink-0" />
                {t(LOCKED_KEYS[outcome.kind])}
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  leftIcon={scheduled ? CalendarClock : Send}
                  loading={sending || recounting}
                  disabled={sendBlockedKey !== null}
                  aria-describedby={sendNote ? "campaign-send-note" : undefined}
                >
                  {scheduled ? t("campaign.schedule.submit") : t("dispatch.send")}
                </Button>
                {isAudience ? (
                  // Doim joyida (jonli hudud qayta yaratilmaydi) — faqat matni almashadi.
                  <span
                    id="campaign-send-note"
                    // Matn yo'q — oqimdan chiqadi (ortiqcha oraliq yo'q), jonli hudud a11y daraxtida qoladi.
                    className={cx("text-center text-xs text-text-muted", !sendNote && "sr-only")}
                    aria-live="polite"
                  >
                    {sendNote}
                  </span>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </form>

      {/* Tasdiq oynasi (maket `superadmin-notifications-send-confirm-dialog`): `alertdialog`, fokus «Bekor qilish» da,
          yuborilayotganda yopilmaydi; «Hamma» — qizil ogohlantirish va qizil tugma. «Auditoriya» — kampaniya xulosasi
          (Kimga, aniq son, kanallar, kategoriya, «Darhol»; reklama tungi taqiqqa tushsa — qachon ketadi). */}
      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (sending) return;
          setConfirmPayload(null);
          setConfirmCampaign(null);
        }}
        role="alertdialog"
        title={confirmScheduled ? t("campaign.confirm.scheduledTitle") : t("dispatch.confirmTitle")}
        description={
          confirmScheduled && confirmCampaign ? (
            <Trans
              t={t}
              i18nKey="campaign.confirm.scheduledDescription"
              count={confirmCampaign.preview.total}
              values={{ value: count(confirmCampaign.preview.total) }}
              components={{ b: <span className="font-semibold text-text" /> }}
            />
          ) : undefined
        }
        icon={confirmScheduled ? CalendarClock : Send}
        closable={Boolean(confirmScheduled)}
        size="md"
        busy={sending}
        initialFocus={cancelRef}
        returnFocus={outcomeRef}
        footer={
          <>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={sending}
              onClick={() => {
                setConfirmPayload(null);
                setConfirmCampaign(null);
              }}
            >
              {confirmScheduled ? t("campaign.confirm.back") : t("dispatch.cancel")}
            </Button>
            <Button
              variant={confirmPayload?.broadcast ? "danger" : "primary"}
              leftIcon={confirmScheduled ? CalendarClock : Send}
              loading={sending}
              loadingText={confirmScheduled ? t("campaign.confirm.scheduling") : t("dispatch.confirmSending")}
              disabled={quietPending || slotPassed}
              onClick={confirmSend}
            >
              {confirmScheduled ? t("campaign.schedule.submit") : t("dispatch.confirmSend")}
            </Button>
          </>
        }
      >
        {confirmPayload || confirmCampaign ? (
          <div className="flex min-w-0 flex-col gap-4 text-sm" data-testid="dispatch-confirm">
            {confirmPayload?.broadcast ? (
              <NoticeAlert
                tone="danger"
                role="alert"
                icon={TriangleAlert}
                title={t("dispatch.confirmBroadcast")}
              />
            ) : null}
            {slotPassed ? (
              <NoticeAlert tone="danger" role="alert" title={t("campaign.confirm.slotPassedTitle")}>
                {t("campaign.confirm.slotPassedText")}
              </NoticeAlert>
            ) : null}
            {confirmScheduled && !slotPassed && !quietCheck?.check?.effectiveAt ? (
              <NoticeAlert
                tone="info"
                icon={CalendarClock}
                title={t("campaign.schedule.chosenTitle", { when: campaignTime.moment(confirmScheduled, now) })}
              >
                {t("campaign.confirm.scheduledExact", { when: campaignTime.exact(confirmScheduled) })}
              </NoticeAlert>
            ) : null}
            {quietWhen ? (
              <NoticeAlert
                tone="warning"
                icon={Clock}
                title={t("campaign.confirm.quietTitle", {
                  time: quietWhen,
                })}
              >
                {quietHoursShown
                  ? t("campaign.confirm.quietText", {
                      start: quietHoursShown.start,
                      end: quietHoursShown.end,
                    })
                  : null}
              </NoticeAlert>
            ) : null}
            <dl className="m-0 flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1">
              {(confirmCampaign
                ? [
                    {
                      label: t("dispatch.confirmRecipients"),
                      value: <span className="[overflow-wrap:anywhere]">{confirmDescription.who}</span>,
                    },
                    {
                      label: t("dispatch.confirmCount"),
                      value: (
                        <span data-testid="confirm-count">
                          {t("campaign.confirm.count", { value: count(confirmCampaign.preview.total) })}
                        </span>
                      ),
                    },
                    {
                      label: t("dispatch.confirmChannels"),
                      value: campaignChannelLabels(confirmCampaign.payload.channels),
                    },
                    {
                      label: t("campaign.confirm.category"),
                      value: t(`category.${confirmCampaign.payload.category}`),
                    },
                    // «Belgilangan vaqtda» — vaqt yuqoridagi ko'k blokda (maket `-send-confirm-scheduled-dialog`).
                    ...(confirmScheduled
                      ? []
                      : [{ label: t("campaign.confirm.time"), value: t("campaign.confirm.timeNow") }]),
                  ]
                : confirmPayload
                  ? [
                      {
                        label: t("dispatch.confirmRecipients"),
                        value: (
                          <span className="[overflow-wrap:anywhere]">{recipientSummary(confirmPayload)}</span>
                        ),
                      },
                      {
                        label: t("dispatch.confirmCount"),
                        value: (
                          <span data-testid="confirm-count">
                            {estimate.count === null
                              ? "…"
                              : t("dispatch.confirmCountValue", { value: count(estimate.count) })}
                          </span>
                        ),
                      },
                      {
                        label: t("dispatch.confirmChannels"),
                        value: channelLabels(confirmPayload.channels),
                      },
                    ]
                  : []
              ).map((row, index) => (
                <div
                  key={index}
                  className={cx(
                    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <dt className="min-w-0 text-text-muted">{row.label}</dt>
                  <dd className="m-0 ml-auto text-right font-semibold text-text">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[13px] font-semibold text-text">
                {t("dispatch.confirmMessage")}
              </span>
              <div className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto rounded-xl bg-sunken px-4 py-3">
                <p
                  className="m-0 font-semibold text-text [overflow-wrap:anywhere]"
                  data-testid="confirm-title"
                >
                  {confirmMessage?.title}
                </p>
                {confirmMessage?.body ? (
                  <p
                    className="m-0 text-[13px] whitespace-pre-wrap text-text-muted [overflow-wrap:anywhere]"
                    data-testid="confirm-body"
                  >
                    {confirmMessage.body}
                  </p>
                ) : null}
                {confirmMessage?.link ? (
                  <p className="m-0 text-[13px] break-all text-action-fg">{confirmMessage.link}</p>
                ) : null}
              </div>
            </div>
            {confirmCampaign ? (
              <p className="m-0 text-[13px] text-text-muted">
                {t(confirmScheduled ? "campaign.confirm.scheduledCancelNote" : "campaign.confirm.cancelNote")}
              </p>
            ) : (
              <p className="m-0 text-[13px] font-semibold text-text">
                {t("dispatch.confirmIrreversible")}
              </p>
            )}
          </div>
        ) : null}
      </Dialog>

      <SentDetailDialog
        dispatchId={detailId}
        source={detailFromUnknown ? "unknown" : "history"}
        onClose={() => setDetailId(null)}
      />
    </>
  );
};

export default NotificationDispatchForm;
