import { useMemo, useRef, useState, type ReactNode } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Alert, Button, Checkbox, Input, Modal, Select, Tooltip } from "antd";
import type { AxiosError } from "axios";
import { Send } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type InboxNotification,
} from "../../../entities/notification-inbox";
import { useMarkets } from "../../../entities/markets";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { useDebounce } from "../../../shared/lib/useDebounce";
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

const userLabel = (user: RecipientUser) =>
  [user.name, user.phone_number, user.role].filter(Boolean).join(" · ");

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="min-w-0 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
    <h3 className="m-0 mb-3 text-sm font-black uppercase tracking-wide text-maindark dark:text-white">{title}</h3>
    <div className="flex min-w-0 flex-col gap-3">{children}</div>
  </section>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="m-0 text-xs font-semibold text-red-500">
      {message}
    </p>
  ) : null;

const FieldLabel = ({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) => (
  <label htmlFor={htmlFor} className="text-xs font-bold text-maindark/80 dark:text-white/80">
    {children}
  </label>
);

type NotificationDispatchFormProps = {
  /** Oldindan ko'rish kartasi (inbox'dagi haqiqiy ko'rinish) — sahifa beradi. */
  renderPreview: (notification: InboxNotification) => ReactNode;
};

/**
 * XABAR YUBORISH — `POST /notifications/dispatch` (superadmin/admin).
 * Kimga → Kanal → Mazmun → Oldindan ko'rish → Tasdiq oynasi → Yuborish.
 */
const NotificationDispatchForm = ({ renderPreview }: NotificationDispatchFormProps) => {
  const { t } = useTranslation("notifications");
  const { t: tUsers } = useTranslation("users");
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

  const [search, setSearch] = useState("");
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
  const [previewCreatedAt] = useState(() => new Date().toISOString());

  // Yuborilgan (yoki natijasi noma'lum) xabar shu formadan qayta yuborilmaydi —
  // faqat "Yangi xabar" orqali (yangi guruh kaliti bilan).
  const locked = unknownOutcome || Boolean(result);

  const userOptions = useMemo(() => {
    const found = recipientsQuery.data?.items ?? [];
    const merged = new Map<string, RecipientUser>();
    for (const user of Object.values(selectedUsers)) merged.set(user.id, user);
    for (const user of found) merged.set(user.id, user);
    return Array.from(merged.values()).map((user) => ({ value: user.id, label: userLabel(user) }));
  }, [recipientsQuery.data, selectedUsers]);

  const rememberUsers = (ids: string[]) => {
    const found = recipientsQuery.data?.items ?? [];
    setSelectedUsers((prev) => {
      const next: Record<string, RecipientUser> = {};
      for (const id of ids) {
        const user = prev[id] ?? found.find((item) => item.id === id);
        if (user) next[id] = user;
      }
      return next;
    });
  };

  const channelLabels = (channels: string[]) => channels.map((channel) => t(`dispatch.channel.${channel}`)).join(", ");

  const recipientSummary = (payload: DispatchPayload) => {
    if (payload.broadcast) return t("dispatch.confirmAll");
    if (payload.roles) return payload.roles.map((role) => tUsers(ROLE_LABEL_KEYS[role] ?? role)).join(", ");
    if (payload.recipient_ids) {
      const names = payload.recipient_ids.map((id) => selectedUsers[id]?.name ?? `#${id}`);
      return `${t("dispatch.confirmList", { count: names.length })}: ${names.join(", ")}`;
    }
    const user = payload.recipient_id ? selectedUsers[payload.recipient_id] : undefined;
    return t("dispatch.confirmSingle", { name: user ? userLabel(user) : `#${payload.recipient_id}` });
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
    setSearch("");
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

  const estimateText = estimate.loading
    ? t("dispatch.estimateLoading")
    : estimate.count === null
      ? ""
      : t("dispatch.estimate", { count: estimate.count });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Section title={t("dispatch.sectionRecipients")}>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t("dispatch.sectionRecipients")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={field.value === mode}
                    disabled={locked}
                    onClick={() => field.onChange(mode)}
                    className={`min-w-0 rounded-xl border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      field.value === mode
                        ? "border-main bg-main text-white"
                        : "border-[color:var(--color-border-strong)] text-maindark hover:bg-main/10 dark:border-white/20 dark:text-white"
                    }`}
                  >
                    {t(`dispatch.mode.${mode}`)}
                  </button>
                ))}
              </div>
            )}
          />

          {values.mode === "single" && (
            <Controller
              control={control}
              name="recipient_id"
              render={({ field }) => (
                <Select
                  showSearch={{ filterOption: false, searchValue: search, onSearch: (value) => { setSearch(value); updateSearch(value); } }}
                  allowClear
                  aria-label={t("dispatch.mode.single")}
                  placeholder={t("dispatch.recipientPlaceholder")}
                  value={field.value || undefined}
                  onChange={(value?: string) => {
                    field.onChange(value ?? "");
                    rememberUsers(value ? [value] : []);
                  }}
                  options={userOptions}
                  loading={recipientsQuery.isFetching}
                  status={errors.recipient_id ? "error" : undefined}
                  disabled={locked}
                  className="w-full"
                />
              )}
            />
          )}
          {values.mode === "list" && (
            <Controller
              control={control}
              name="recipient_ids"
              render={({ field }) => (
                <Select
                  mode="multiple"
                  showSearch={{ filterOption: false, searchValue: search, onSearch: (value) => { setSearch(value); updateSearch(value); } }}
                  aria-label={t("dispatch.mode.list")}
                  placeholder={t("dispatch.recipientsPlaceholder")}
                  value={field.value}
                  onChange={(value: string[]) => {
                    field.onChange(value);
                    rememberUsers(value);
                  }}
                  options={userOptions}
                  loading={recipientsQuery.isFetching}
                  status={errors.recipient_ids ? "error" : undefined}
                  disabled={locked}
                  className="w-full"
                />
              )}
            />
          )}
          {values.mode === "roles" && (
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <div role="group" aria-label={t("dispatch.rolesLabel")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DISPATCH_ROLES.map((role) => (
                    <Checkbox
                      key={role}
                      checked={field.value.includes(role)}
                      disabled={locked}
                      onChange={(event) =>
                        field.onChange(
                          event.target.checked ? [...field.value, role] : field.value.filter((item) => item !== role),
                        )
                      }
                    >
                      {tUsers(ROLE_LABEL_KEYS[role])}
                    </Checkbox>
                  ))}
                  {DISABLED_DISPATCH_ROLES.map((role) => (
                    <Tooltip key={role} title={t("dispatch.customerDisabled")}>
                      <span>
                        <Checkbox disabled checked={false}>
                          {tUsers(ROLE_LABEL_KEYS[role])}
                        </Checkbox>
                      </span>
                    </Tooltip>
                  ))}
                </div>
              )}
            />
          )}
          {values.mode === "all" && <Alert type="warning" showIcon title={t("dispatch.allHint")} />}

          <FieldError message={errors.recipient_id?.message ?? errors.recipient_ids?.message ?? errors.roles?.message} />
          {estimateText ? (
            <p data-testid="recipient-estimate" className="m-0 text-sm font-semibold text-main dark:text-violet-200">
              {estimateText}
            </p>
          ) : null}
        </Section>

        <Section title={t("dispatch.sectionChannels")}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Tooltip title={t("dispatch.inAppAlways")}>
              <span>
                <Checkbox checked disabled>
                  {t("dispatch.channel.in_app")}
                </Checkbox>
              </span>
            </Tooltip>
            <Controller
              control={control}
              name="realtime"
              render={({ field }) => (
                <Checkbox checked={field.value} disabled={locked} onChange={(event) => field.onChange(event.target.checked)}>
                  {t("dispatch.channel.realtime")}
                </Checkbox>
              )}
            />
            <Controller
              control={control}
              name="telegram"
              render={({ field }) => (
                <Checkbox checked={field.value} disabled={locked} onChange={(event) => field.onChange(event.target.checked)}>
                  {t("dispatch.channel.telegram")}
                </Checkbox>
              )}
            />
            {(["sms", "push"] as const).map((channel) => (
              <Controller
                key={channel}
                control={control}
                name={channel}
                render={({ field }) => (
                  <Checkbox checked={field.value} disabled={locked} onChange={(event) => field.onChange(event.target.checked)}>
                    {t(`dispatch.channel.${channel}`)}
                  </Checkbox>
                )}
              />
            ))}
          </div>
          {values.sms ? (
            <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("dispatch.smsHint")}
            </p>
          ) : null}
          {values.telegram && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <FieldLabel>{t("dispatch.telegramMarket")}</FieldLabel>
              <Controller
                control={control}
                name="telegram_market_id"
                render={({ field }) => (
                  <Select
                    showSearch={{ optionFilterProp: "label" }}
                    aria-label={t("dispatch.telegramMarket")}
                    placeholder={t("dispatch.telegramMarketPlaceholder")}
                    value={field.value || undefined}
                    onChange={(value?: string) => field.onChange(value ?? "")}
                    options={markets.map((market) => ({ value: String(market.id), label: market.name ?? `#${market.id}` }))}
                    loading={marketsQuery.isLoading}
                    status={errors.telegram_market_id ? "error" : undefined}
                    disabled={locked}
                    className="w-full"
                  />
                )}
              />
              <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("dispatch.telegramHint")}
              </p>
              <FieldError message={errors.telegram_market_id?.message} />
            </div>
          )}
        </Section>

        <Section title={t("dispatch.sectionContent")}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel htmlFor="dispatch-title">{t("dispatch.title")}</FieldLabel>
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <Input
                  {...field}
                  id="dispatch-title"
                  placeholder={t("dispatch.titlePlaceholder")}
                  count={{ show: true, max: DISPATCH_LIMITS.title }}
                  status={errors.title ? "error" : undefined}
                  disabled={locked}
                />
              )}
            />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel htmlFor="dispatch-body">{t("dispatch.body")}</FieldLabel>
            <Controller
              control={control}
              name="body"
              render={({ field }) => (
                <Input.TextArea
                  {...field}
                  id="dispatch-body"
                  rows={5}
                  placeholder={t("dispatch.bodyPlaceholder")}
                  count={{ show: true, max: DISPATCH_LIMITS.body }}
                  status={errors.body ? "error" : undefined}
                  disabled={locked}
                />
              )}
            />
            <FieldError message={errors.body?.message} />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <FieldLabel>{t("dispatch.category")}</FieldLabel>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    aria-label={t("dispatch.category")}
                    value={field.value}
                    onChange={field.onChange}
                    options={NOTIFICATION_CATEGORIES.map((category) => ({ value: category, label: t(`category.${category}`) }))}
                    disabled={locked}
                    className="w-full"
                  />
                )}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <FieldLabel>{t("dispatch.priority")}</FieldLabel>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    aria-label={t("dispatch.priority")}
                    value={field.value}
                    onChange={field.onChange}
                    options={NOTIFICATION_PRIORITIES.map((priority) => ({ value: priority, label: t(`priority.${priority}`) }))}
                    disabled={locked}
                    className="w-full"
                  />
                )}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel htmlFor="dispatch-link">{t("dispatch.link")}</FieldLabel>
            <Controller
              control={control}
              name="link"
              render={({ field }) => (
                <Input
                  {...field}
                  id="dispatch-link"
                  placeholder={t("dispatch.linkPlaceholder")}
                  status={errors.link ? "error" : undefined}
                  disabled={locked}
                />
              )}
            />
            <FieldError message={errors.link?.message} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel htmlFor="dispatch-group-key">{t("dispatch.groupKey")}</FieldLabel>
            <Controller
              control={control}
              name="group_key"
              render={({ field }) => (
                <Input
                  {...field}
                  id="dispatch-group-key"
                  status={errors.group_key ? "error" : undefined}
                  disabled={locked}
                />
              )}
            />
            <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("dispatch.groupKeyHint")}
            </p>
            <FieldError message={errors.group_key?.message} />
          </div>
        </Section>
      </div>

      {/* Telefonda matn tagida, desktopda o'ng ustunda. */}
      <aside
        aria-label={t("dispatch.sectionPreview")}
        className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="flex flex-col gap-3 lg:sticky lg:top-4">
          <h3 className="m-0 text-sm font-black uppercase tracking-wide text-maindark dark:text-white">
            {t("dispatch.sectionPreview")}
          </h3>
          <div data-testid="dispatch-preview">{renderPreview(previewNotification)}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        {result ? (
          <Alert
            type="success"
            showIcon
            title={t("dispatch.sent", { count: result.dispatched })}
            description={result.channels.length ? t("dispatch.sentChannels", { channels: channelLabels(result.channels) }) : undefined}
          />
        ) : null}
        {unknownOutcome ? <Alert type="warning" showIcon title={t("dispatch.unknownOutcome")} /> : null}
        {sendError ? <Alert type="error" showIcon title={sendError} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="primary"
            htmlType="submit"
            icon={<Send size={16} />}
            loading={dispatchMutation.isPending}
            disabled={locked || dispatchMutation.isPending}
            className="h-11 rounded-xl px-6 font-bold"
          >
            {t("dispatch.send")}
          </Button>
          {locked ? (
            <Button htmlType="button" onClick={startNewMessage} className="h-11 rounded-xl px-5 font-semibold">
              {t("dispatch.newMessage")}
            </Button>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(confirmPayload)}
        title={t("dispatch.confirmTitle")}
        onCancel={() => {
          if (!dispatchMutation.isPending) setConfirmPayload(null);
        }}
        onOk={confirmSend}
        okText={t("dispatch.confirmSend")}
        cancelText={t("dispatch.cancel")}
        confirmLoading={dispatchMutation.isPending}
        okButtonProps={{ danger: Boolean(confirmPayload?.broadcast) }}
        cancelButtonProps={{ disabled: dispatchMutation.isPending }}
        maskClosable={false}
        destroyOnHidden
      >
        {confirmPayload ? (
          <div className="flex flex-col gap-3" data-testid="dispatch-confirm">
            {confirmPayload.broadcast ? <Alert type="error" showIcon title={t("dispatch.confirmBroadcast")} /> : null}
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              <dt className="font-bold">{t("dispatch.confirmRecipients")}</dt>
              <dd className="m-0 break-words">{recipientSummary(confirmPayload)}</dd>
              <dt className="font-bold">{t("dispatch.confirmCount")}</dt>
              <dd className="m-0" data-testid="confirm-count">
                {estimate.count === null ? "…" : t("dispatch.confirmCountValue", { count: estimate.count })}
              </dd>
              <dt className="font-bold">{t("dispatch.confirmChannels")}</dt>
              <dd className="m-0">{channelLabels(confirmPayload.channels)}</dd>
            </dl>
            <div>
              <p className="m-0 mb-1 text-sm font-bold">{t("dispatch.confirmMessage")}</p>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[color:var(--color-border-soft)] p-3 dark:border-white/10">
                <p className="m-0 font-bold break-words" data-testid="confirm-title">{confirmPayload.title}</p>
                {confirmPayload.body ? (
                  <p className="m-0 mt-1 whitespace-pre-wrap break-words" data-testid="confirm-body">
                    {confirmPayload.body}
                  </p>
                ) : null}
                {confirmPayload.link ? <p className="m-0 mt-1 text-xs text-main break-all">{confirmPayload.link}</p> : null}
              </div>
            </div>
            <p className="m-0 text-sm font-semibold text-red-500">{t("dispatch.confirmIrreversible")}</p>
          </div>
        ) : null}
      </Modal>
    </form>
  );
};

export default NotificationDispatchForm;
