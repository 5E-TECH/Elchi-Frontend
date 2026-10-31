// dizayn-v2: superadmin-users-create-password-sms
import { useId, type ReactNode } from "react";
import { Check, Lock, MessageSquareText, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PasswordMode } from "../../../../entities/user/types/user";
import { cx } from "../../../../shared/lib/cx";
import { Badge } from "../../../../shared/ui/primitives";

type PasswordModeSectionProps = {
  mode: PasswordMode;
  onModeChange: (mode: PasswordMode) => void;
  mustChangePassword: boolean;
  onMustChangePasswordChange: (value: boolean) => void;
  /** Kiritilgan telefon (`+998 90 123 45 67`) yoki `null` — SMS izohi va namunasi uchun. */
  phone: string | null;
  /** `manual` da ko'rinadigan parol maydoni (forma o'zi boshqaradi). */
  passwordField: ReactNode;
  disabled?: boolean;
};

/**
 * «PAROL» bo'limi — maket `superadmin-users-create-password-sms` (aidsxJ2H): «Parolni qanday berish» —
 * «Tizim yaratsin va SMS yuborsin» (sukut, `generate_sms`, parol maydoni yo'q) · «Qo'lda kiritish» (`manual` —
 * parol maydoni). «Birinchi kirishda parolni almashtirishni talab qilish» — SMS rejimida doim yoqiq (backend
 * `must_change_password` ni o'zi `true` qiladi, `false` — 400), qo'lda rejimda tanlanadi. SMS rejimida — SMS matni
 * namunasi (shablon `user.temp_password`, parol yashirilgan).
 */
export const PasswordModeSection = ({
  mode,
  onModeChange,
  mustChangePassword,
  onMustChangePasswordChange,
  phone,
  passwordField,
  disabled = false,
}: PasswordModeSectionProps) => {
  const { t } = useTranslation("users");
  const id = useId();
  const sms = mode === "generate_sms";

  const choice = (value: PasswordMode, Icon: LucideIcon, title: ReactNode, hint: string) => {
    const selected = mode === value;
    const hintId = `${id}-${value}-hint`;
    return (
      <label
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3",
          "transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
          selected ? "border-action bg-action-soft" : "border-border bg-surface hover:bg-sunken",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="radio"
          name={`${id}-password-mode`}
          value={value}
          checked={selected}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={() => onModeChange(value)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
            selected ? "bg-surface text-action-fg" : "bg-sunken text-text-muted",
          )}
        >
          <Icon size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {title}
          <span id={hintId} className="text-[13px] text-text-muted">
            {hint}
          </span>
        </span>
        {selected ? (
          <Check size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-action-fg" />
        ) : null}
      </label>
    );
  };

  const mustChangeHintId = `${id}-must-hint`;

  return (
    <>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="sr-only">{t("v2.create.passwordMode.legend")}</legend>
        {choice(
          "generate_sms",
          MessageSquareText,
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-text">{t("v2.create.passwordMode.sms")}</span>
            <Badge tone="neutral">{t("v2.create.passwordMode.recommended")}</Badge>
          </span>,
          phone
            ? t("v2.create.passwordMode.smsHint", { phone })
            : t("v2.create.passwordMode.smsHintNoPhone"),
        )}
        {choice(
          "manual",
          Lock,
          <span className="font-semibold text-text">{t("v2.create.passwordMode.manual")}</span>,
          t("v2.create.passwordMode.manualHint"),
        )}
      </fieldset>

      {sms ? null : passwordField}

      <div className="flex flex-col gap-1">
        <label
          className={cx(
            "flex items-start gap-2.5 text-sm text-text max-md:min-h-11",
            sms || disabled ? "cursor-default" : "cursor-pointer",
          )}
        >
          <input
            type="checkbox"
            className="mt-px size-[18px] shrink-0 accent-action"
            // SMS rejimida backend doim `true` qiladi — belgilangan va o'zgartirilmaydi.
            checked={sms ? true : mustChangePassword}
            disabled={sms || disabled}
            aria-describedby={mustChangeHintId}
            onChange={(event) => onMustChangePasswordChange(event.target.checked)}
          />
          <span>{t("v2.create.passwordMode.mustChange")}</span>
        </label>
        <span id={mustChangeHintId} className="pl-7 text-xs text-text-muted">
          {t(sms ? "v2.create.passwordMode.mustChangeHintSms" : "v2.create.passwordMode.mustChangeHintManual")}
        </span>
      </div>

      {sms ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-2 rounded-xl bg-sunken px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <MessageSquareText size={16} aria-hidden="true" />
                {t("v2.create.passwordMode.sampleTitle")}
              </span>
              <span className="text-xs text-text-muted">
                {t("v2.create.passwordMode.sampleSender")}: <span className="font-semibold text-text">ELCHI</span>
              </span>
            </div>
            <p className="m-0 text-[13px] text-text [overflow-wrap:anywhere]">
              {t("v2.create.passwordMode.sampleText", { login: phone ? phone.replace(/\s+/g, "") : "+998…" })}
            </p>
          </div>
          <span className="text-xs text-text-muted">{t("v2.create.passwordMode.sampleSize")}</span>
        </div>
      ) : null}
    </>
  );
};
