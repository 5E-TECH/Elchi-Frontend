// dizayn-v2: superadmin-notifications-send, superadmin-notifications-send-confirm-dialog
import { useMemo, useRef, useState, type ReactNode } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import type { AxiosError } from "axios";
import { Send, TriangleAlert, Users, X } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type InboxNotification,
} from "../../../entities/notification-inbox";
import { useMarkets } from "../../../entities/markets";
import { NoticeAlert } from "../../../entities/notification";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
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
  useRecipientEstimate,
  useRecipientSearch,
  type DispatchResult,
  type RecipientUser,
} from "../api/useDispatchNotification";
import {
  DISABLED_DISPATCH_ROLES,
  DISPATCH_LIMITS,
  DISPATCH_ROLES,
  buildDispatchPayload,
  createDefaultValues,
  createDispatchSchema,
  type DispatchFormValues,
  type DispatchPayload,
  type RecipientMode,
} from "../model/schema";

const MODES: RecipientMode[] = ["single", "roles", "list", "all"];

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

/**
 * `.el-choice-card` (CODE-MAP 2.2): tanlangan — `action` chegara va `action-soft` fon; o'chirilgani — `sunken`,
 * `text-subtle` (maketdagi «Mijoz», «Ilova ichida»).
 */
const CHOICE_CARD =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 " +
  "text-sm text-text has-[:checked]:border-action has-[:checked]:bg-action-soft " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-border has-[:disabled]:bg-sunken";

/** `.el-check`. */
const CHECKBOX =
  "size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-60";

type ChoiceCheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
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
  className,
}: ChoiceCheckboxProps) => (
  <label className={cx(CHOICE_CARD, disabled && !checked && "text-text-subtle", className)}>
    <input
      type="checkbox"
      className={CHECKBOX}
      checked={checked}
      disabled={disabled}
      // Izohli kartada nom — faqat sarlavha, izoh — tavsif (`aria-describedby`).
      aria-labelledby={hint && hintId ? `${hintId}-label` : undefined}
      aria-describedby={hintId}
      onChange={(event) => onChange?.(event.target.checked)}
    />
    {hint ? (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={hintId ? `${hintId}-label` : undefined} className="font-semibold text-text">
          {label}
        </span>
        <span id={hintId} className="text-xs text-text-muted">
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
 * Chap ustun: «Kimga» (Bitta odam · Rol · Tanlangan ro'yxat · Hamma; rollar — karta-katakchalar, «Mijoz» o'chiq +
 * sababi; taxminiy son), «Kanal» (Ilova ichida doim yoqiq; Darhol, Telegram, SMS, Push; SMS — ogohlantirish,
 * Telegram — market guruhi). O'ng ustun: «Mazmun» (Sarlavha*, Matn, Kategoriya, Muhimlik, Havola, Guruh kaliti*),
 * «Oldindan ko'rish» (inbox kartasi) + «Yuborish». Telefonda ustunlar ketma-ket.
 *
 * Tasdiq oynasi (`Dialog role="alertdialog"`): Kimga · Qabul qiluvchilar taxminan · Kanallar · to'liq xabar; «Hamma» da qizil
 * ogohlantirish va qizil tugma. Ikki marta yuborilmaydi (`submittingRef` + `isPending`); javobsiz / 502–504 — natija
 * noma'lum, qayta yuborilmaydi, forma «Yangi xabar» gacha qulflanadi (avvalgidek).
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
  const estimate = useRecipientEstimate(values.mode, {
    roles: values.roles ?? [],
    listSize: values.recipient_ids?.length ?? 0,
  });
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, Boolean(values.telegram));
  const markets = toMarkets(marketsQuery.data);

  const dispatchMutation = useDispatchNotification();
  const [confirmPayload, setConfirmPayload] = useState<DispatchPayload | null>(null);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [sendError, setSendError] = useState("");
  const submittingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [previewCreatedAt] = useState(() => new Date().toISOString());

  // Yuborilgan (yoki natijasi noma'lum) xabar shu formadan qayta yuborilmaydi —
  // faqat "Yangi xabar" orqali (yangi guruh kaliti bilan).
  const locked = unknownOutcome || Boolean(result);

  const roleLabel = (role?: string) => (role ? tUsers(ROLE_LABEL_KEYS[role] ?? role) : "");
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

  const recipientSummary = (payload: DispatchPayload) => {
    if (payload.broadcast) return t("dispatch.confirmAll");
    if (payload.roles) return payload.roles.map((role) => roleLabel(role)).join(", ");
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
    setSendError("");
    setConfirmPayload(buildDispatchPayload(formValues));
  };

  const confirmSend = () => {
    if (!confirmPayload || submittingRef.current || dispatchMutation.isPending) return;
    submittingRef.current = true;
    dispatchMutation.mutate(confirmPayload, {
      onSuccess: (response) => {
        setResult(response);
        setConfirmPayload(null);
      },
      onError: (error) => {
        const status = (error as AxiosError).response?.status;
        setConfirmPayload(null);
        // Javobsiz / 502-504: qatorlar yozilgan bo'lishi mumkin — natija
        // noma'lum. QAYTA YUBORILMAYDI, tugma bloklanadi.
        if (!status || status >= 502) {
          setUnknownOutcome(true);
          return;
        }
        setSendError(getBackendErrorMessage(error) ?? t("dispatch.sendFailed"));
      },
      onSettled: () => {
        submittingRef.current = false;
      },
    });
  };

  const startNewMessage = () => {
    reset(createDefaultValues());
    setResult(null);
    setUnknownOutcome(false);
    setSendError("");
    setSelectedUsers({});
    setDebouncedSearch("");
    dispatchMutation.reset();
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

  const recipientsError =
    errors.recipient_id?.message ?? errors.recipient_ids?.message ?? errors.roles?.message;

  return (
    <>
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
                  options={MODES.map((mode) => ({
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

            {values.mode === "roles" ? (
              <Controller
                control={control}
                name="roles"
                render={({ field }) => (
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
                      {t("dispatch.rolesLabel")}
                      <span aria-hidden="true" className="text-danger-fg">
                        {" *"}
                      </span>
                    </legend>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] gap-2">
                      {DISPATCH_ROLES.map((role) => (
                        <ChoiceCheckbox
                          key={role}
                          checked={field.value.includes(role)}
                          disabled={locked}
                          label={roleLabel(role)}
                          onChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role]
                                : field.value.filter((item) => item !== role),
                            )
                          }
                        />
                      ))}
                      {DISABLED_DISPATCH_ROLES.map((role) => (
                        <label key={role} className={cx(CHOICE_CARD, "text-text-subtle")}>
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            checked={false}
                            disabled
                            aria-describedby="dispatch-customer-hint"
                            readOnly
                          />
                          <span className="min-w-0">{roleLabel(role)}</span>
                        </label>
                      ))}
                    </div>
                    <span id="dispatch-customer-hint" className="text-xs text-text-muted">
                      {t("dispatch.customerDisabled")}
                    </span>
                  </fieldset>
                )}
              />
            ) : null}

            {values.mode === "all" ? (
              <NoticeAlert tone="warning">{t("dispatch.allHint")}</NoticeAlert>
            ) : null}

            {values.mode === "roles" && recipientsError ? (
              <p role="alert" className="m-0 text-xs font-semibold text-danger-fg">
                {recipientsError}
              </p>
            ) : null}

            {estimate.loading || estimate.count !== null ? (
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

            {values.sms ? (
              <NoticeAlert tone="warning" role="note">
                {t("dispatch.smsHint")}
              </NoticeAlert>
            ) : null}

            {values.telegram ? (
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
          </Card>

          <Card title={t("dispatch.sectionPreview")} bodyClassName="flex flex-col gap-4">
            <div data-testid="dispatch-preview">{renderPreview(previewNotification)}</div>

            {result ? (
              <NoticeAlert tone="success" title={t("dispatch.sent", { count: result.dispatched })}>
                {result.channels.length
                  ? t("dispatch.sentChannels", { channels: channelLabels(result.channels) })
                  : null}
              </NoticeAlert>
            ) : null}
            {unknownOutcome ? (
              <NoticeAlert tone="warning">{t("dispatch.unknownOutcome")}</NoticeAlert>
            ) : null}
            {sendError ? <NoticeAlert tone="danger">{sendError}</NoticeAlert> : null}

            <Button
              type="submit"
              size="lg"
              fullWidth
              leftIcon={Send}
              loading={dispatchMutation.isPending}
              disabled={locked}
            >
              {t("dispatch.send")}
            </Button>
            {locked ? (
              <Button variant="secondary" fullWidth onClick={startNewMessage}>
                {t("dispatch.newMessage")}
              </Button>
            ) : null}
          </Card>
        </div>
      </form>

      {/* Tasdiq oynasi (maket `superadmin-notifications-send-confirm-dialog`): `alertdialog`, fokus «Bekor qilish» da,
          yuborilayotganda yopilmaydi; «Hamma» — qizil ogohlantirish va qizil tugma. */}
      <Dialog
        open={Boolean(confirmPayload)}
        onClose={() => {
          if (!dispatchMutation.isPending) setConfirmPayload(null);
        }}
        role="alertdialog"
        title={t("dispatch.confirmTitle")}
        icon={Send}
        size="md"
        busy={dispatchMutation.isPending}
        initialFocus={cancelRef}
        footer={
          <>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={dispatchMutation.isPending}
              onClick={() => setConfirmPayload(null)}
            >
              {t("dispatch.cancel")}
            </Button>
            <Button
              variant={confirmPayload?.broadcast ? "danger" : "primary"}
              leftIcon={Send}
              loading={dispatchMutation.isPending}
              loadingText={t("dispatch.confirmSending")}
              onClick={confirmSend}
            >
              {t("dispatch.confirmSend")}
            </Button>
          </>
        }
      >
        {confirmPayload ? (
          <div className="flex min-w-0 flex-col gap-4 text-sm" data-testid="dispatch-confirm">
            {confirmPayload.broadcast ? (
              <NoticeAlert
                tone="danger"
                role="alert"
                icon={TriangleAlert}
                title={t("dispatch.confirmBroadcast")}
              />
            ) : null}
            <dl className="m-0 flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1">
              {[
                {
                  label: t("dispatch.confirmRecipients"),
                  value: (
                    <span className="[overflow-wrap:anywhere]">
                      {recipientSummary(confirmPayload)}
                    </span>
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
              ].map((row, index) => (
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
                  {confirmPayload.title}
                </p>
                {confirmPayload.body ? (
                  <p
                    className="m-0 text-[13px] whitespace-pre-wrap text-text-muted [overflow-wrap:anywhere]"
                    data-testid="confirm-body"
                  >
                    {confirmPayload.body}
                  </p>
                ) : null}
                {confirmPayload.link ? (
                  <p className="m-0 text-[13px] break-all text-action-fg">{confirmPayload.link}</p>
                ) : null}
              </div>
            </div>
            <p className="m-0 text-[13px] font-semibold text-text">
              {t("dispatch.confirmIrreversible")}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};

export default NotificationDispatchForm;
