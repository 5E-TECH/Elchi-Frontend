// dizayn-v2: superadmin-notifications-create-dialog
import { useId, useState, type FormEventHandler } from "react";
import { Bell, ChevronDown, CircleHelp, ExternalLink, Store } from "lucide-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Button,
  buttonClasses,
  Dialog,
  Field,
  Select,
  TextInput,
  type SelectOption,
} from "../../../shared/ui/primitives";
import type { TelegramGroupFormValues, TelegramMarketOption } from "../model/telegramGroupForm";
import { NoticeAlert } from "./NoticeAlert";

/** `.el-choice-card` (CODE-MAP 2.2): tanlangan — `action` chegara va `action-soft` fon. */
const CHOICE_CARD =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 " +
  "text-sm font-semibold text-text has-[:checked]:border-action has-[:checked]:bg-action-soft";

/** `.el-radio`. */
const RADIO = "size-[18px] shrink-0 cursor-pointer accent-action";

/** Telefonda (< 768) yordam bloki yig'ilgan, kompyuterda ochiq (maket). */
const isPhoneViewport = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 767px)").matches
    : false;

export type TelegramGroupFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** «Bildirishnoma qo'shish» / «Bildirishnomani tahrirlash». */
  title: string;
  /** Qo'shishda — «Telegram guruhga bildirishnoma ulash» izohi va «Botni guruhga qo'shish». */
  showConnectHint?: boolean;
  control: Control<TelegramGroupFormValues>;
  errors: FieldErrors<TelegramGroupFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitting: boolean;
  markets: readonly TelegramMarketOption[];
  marketsLoading: boolean;
};

/**
 * TELEGRAM GURUHI OYNASI — maket `superadmin-notifications-create-dialog` (tahrirlash — maket yo'q, eng yaqini shu oyna,
 * ega qarori D6). Ko'rinish faqat shu yerda; ma'lumot (`react-hook-form`, mutatsiya) — `features/notification-create`
 * va `features/notification-edit` da.
 *
 * Tuzilma: ko'k izoh «Telegram guruhga bildirishnoma ulash» + «Botni guruhga qo'shish» (bot nomi `.env` da bo'lmasa —
 * ogohlantirish), Market* (qidiruvli), Telegram guruh ID*, «Guruh ID ni qanday olish mumkin?» (kompyuterda ochiq,
 * telefonda yig'ilgan), Xabar turi* (ikki radio-karta). Telefonda pastki varaqa (`Dialog`).
 */
export const TelegramGroupFormDialog = ({
  open,
  onClose,
  title,
  showConnectHint = false,
  control,
  errors,
  onSubmit,
  submitting,
  markets,
  marketsLoading,
}: TelegramGroupFormDialogProps) => {
  const { t } = useTranslation("notificationGroups");
  const helpId = useId();
  const typeLabelId = useId();
  const typeHintId = useId();
  const [helpOpen, setHelpOpen] = useState(() => !isPhoneViewport());
  // Har ochilishda yordam bloki ekran turiga qarab qaytadan (holat render paytida — effektsiz).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setHelpOpen(!isPhoneViewport());
  }

  const botUsername = import.meta.env.VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME?.replace(
    /^@/,
    "",
  ).trim();
  const addBotUrl = botUsername ? `https://t.me/${botUsername}?startgroup=notification` : "";

  const marketOptions: SelectOption[] = markets.map((market) => ({
    value: market.id,
    label: market.name,
    description: market.phone ? formatPhone(market.phone) : undefined,
    searchText: market.phone,
    icon: Store,
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      icon={Bell}
      size="lg"
      busy={submitting}
      onSubmit={onSubmit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" loading={submitting} loadingText={t("form.saving")}>
            {t("form.save")}
          </Button>
        </>
      }
    >
      {showConnectHint ? (
        addBotUrl ? (
          <NoticeAlert
            tone="info"
            role="note"
            title={t("form.connectTitle")}
            action={
              <a
                href={addBotUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <ExternalLink aria-hidden="true" size={16} className="shrink-0" />
                {t("form.addBot")}
              </a>
            }
          >
            {t("form.connectText")}
          </NoticeAlert>
        ) : (
          <>
            <NoticeAlert tone="info" role="note" title={t("form.connectTitle")}>
              {t("form.connectText")}
            </NoticeAlert>
            <NoticeAlert tone="warning" title={t("form.botMissingTitle")}>
              {t("form.botMissingText")}
            </NoticeAlert>
          </>
        )
      ) : null}

      <Field label={t("form.market")} labelAs="span" required error={errors.market_id?.message}>
        <Controller
          control={control}
          name="market_id"
          render={({ field }) => (
            <Select
              searchable
              icon={Store}
              options={marketOptions}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder={t("form.marketPlaceholder")}
              loading={marketsLoading}
              loadingText={t("form.marketsLoading")}
              noOptionsText={t("form.marketsEmpty")}
              disabled={submitting}
            />
          )}
        />
      </Field>

      <Field
        label={t("form.groupId")}
        required
        hint={t("form.groupIdHint")}
        error={errors.group_id?.message}
      >
        <Controller
          control={control}
          name="group_id"
          render={({ field }) => (
            <TextInput
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder="-1001234567890"
              autoComplete="off"
              disabled={submitting}
              inputClassName="tabular-nums"
            />
          )}
        />
      </Field>

      <div className={cx("rounded-xl bg-sunken", helpOpen ? "px-1 pt-1" : "p-0.5")}>
        <button
          type="button"
          aria-expanded={helpOpen}
          aria-controls={helpOpen ? helpId : undefined}
          onClick={() => setHelpOpen((value) => !value)}
          className={cx(
            "flex h-10 w-full items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm font-semibold text-text",
            "transition-[background-color] duration-150 hover:bg-border motion-reduce:transition-none max-md:min-h-11",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <CircleHelp aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
            <span className="truncate">{t("form.helpTitle")}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={18}
            className={cx(
              "shrink-0 text-text-muted transition-transform motion-reduce:transition-none",
              helpOpen && "rotate-180",
            )}
          />
        </button>
        {helpOpen ? (
          <ol
            id={helpId}
            className="m-0 flex list-decimal flex-col gap-1.5 pt-1 pr-4 pb-3.5 pl-9 text-[13px] text-text-muted"
          >
            <li>{t("form.helpStep1")}</li>
            <li>
              <Trans
                t={t}
                i18nKey="form.helpStep2"
                components={{ b: <span className="font-semibold text-text" /> }}
              />
            </li>
            <li>
              <Trans
                t={t}
                i18nKey="form.helpStep3"
                components={{ b: <span className="font-semibold text-text" /> }}
              />
            </li>
          </ol>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span id={typeLabelId} className="text-[13px] font-semibold text-text">
          {t("form.type")}
          <span aria-hidden="true" className="text-danger-fg">
            {" *"}
          </span>
        </span>
        <Controller
          control={control}
          name="group_type"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-labelledby={typeLabelId}
              aria-describedby={typeHintId}
              aria-required="true"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2"
            >
              {(["create", "cancel"] as const).map((type) => (
                <label key={type} className={CHOICE_CARD}>
                  <input
                    type="radio"
                    name={field.name}
                    value={type}
                    checked={field.value === type}
                    onChange={() => field.onChange(type)}
                    onBlur={field.onBlur}
                    disabled={submitting}
                    className={RADIO}
                  />
                  {t(type === "create" ? "form.typeCreate" : "form.typeCancel")}
                </label>
              ))}
            </div>
          )}
        />
        {errors.group_type?.message ? (
          <span id={typeHintId} className="text-xs font-semibold text-danger-fg">
            {errors.group_type.message}
          </span>
        ) : (
          <span id={typeHintId} className="text-xs text-text-muted">
            {t("form.typeHint")}
          </span>
        )}
      </div>
    </Dialog>
  );
};

export default TelegramGroupFormDialog;
