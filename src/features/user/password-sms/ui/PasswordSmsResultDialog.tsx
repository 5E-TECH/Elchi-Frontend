// dizayn-v2: superadmin-users-create-password-result-dialog
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Lock, RefreshCw, TriangleAlert, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PasswordSms } from "../../../../entities/user/types/user";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import { Badge, Button, Dialog, type Tone } from "../../../../shared/ui/primitives";
import { isNetworkFailure } from "../../../../auth/networkError";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import { passwordSmsStatusKey, usePasswordSmsStatus, useResendPasswordSms } from "../api/passwordSmsApi";
import {
  canManagePasswordSms,
  formatCountdown,
  isKnownFailureReason,
  readResendLimit,
} from "../model/passwordSms";
import { notifyResendLimit } from "./notifyResendLimit";

export type PasswordSmsResultUser = {
  id: string | null;
  name: string;
  phoneNumber: string | null;
  /** FE roli (`marketing` — market). */
  role: string;
  /** Rol nomi (badge). */
  roleLabel: string;
};

type PasswordSmsResultDialogProps = {
  open: boolean;
  user: PasswordSmsResultUser;
  /** Yaratish javobidagi `password_sms` (boshlang'ich holat). */
  initialSms: PasswordSms | null;
  /** Ko'ruvchi roli — holatni so'rash va «Qayta yuborish» huquqi (`canManagePasswordSms`). */
  viewerRole: string | null | undefined;
  /**
   * `created` (sukut) — yaratilgach; `reset` — tafsilotdagi «Parolni tiklash va SMS yuborish» (xtXKLUwT): sarlavha va
   * izoh tiklash haqida, `failed` da parol o'zgarmagani aytiladi.
   */
  mode?: "created" | "reset";
  /** Asosiy amal: «Foydalanuvchiga o'tish» (logist — «Viloyatlarni belgilash»), tiklashda — «Yopish». */
  primaryLabel: string;
  onPrimary: () => void;
  /** «Yana yaratish» (faqat yaratishda). */
  onCreateAnother?: () => void;
  /** «Yopish» / Esc / fon. */
  onClose: () => void;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Har soniyada yangilanadigan «hozir» (qayta yuborish sanog'i) — faqat oyna ochiq va huquq bo'lganda. */
const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
};

/**
 * «FOYDALANUVCHI YARATILDI» — maket `superadmin-users-create-password-result-dialog` (aidsxJ2H; telefonda pastki
 * varaqa — `Dialog` o'zi). `password_mode: generate_sms` bilan yaratilgach: foydalanuvchi, SMS holati (yuborildi →
 * yetkazildi yoki yuborilmadi + sababi), «SMSni qayta yuborish» (60 s sanoq, 429 `retry_after_seconds`, kunlik
 * limit), «Yana yaratish» · «Foydalanuvchiga o'tish». Parol hech qayerda ko'rsatilmaydi.
 *
 * Holat — `GET /users/:id/password/sms-status` (bir necha soniyada, `delivered` / `failed` da to'xtaydi) va
 * `POST /users/:id/password/resend-sms` javobi. Huquq backend bilan aynan (`canManagePasswordSms`): huquq yo'q
 * bo'lsa (masalan menejer yaratgan market) — faqat yaratishdagi holat, so'rash va qayta yuborish yo'q.
 * Prod'da SMS yuborilmasligi mumkin (Eskiz TEST rejimi, shablon moderatsiyasi) — sabab va «Qo'lda kiritish» tavsiyasi
 * ko'rinadi.
 *
 * Tiklash va qayta yuborish (backend shartnomasi): javobning o'zida `failed` — SMS navbatga tushmadi, parol va
 * sessiyalar O'ZGARMAGAN; `pending` / `sent` dan keyin so'rovda `failed` — provayder rad etdi, parol allaqachon yangi.
 */
export const PasswordSmsResultDialog = ({
  open,
  user,
  initialSms,
  viewerRole,
  mode = "created",
  primaryLabel,
  onPrimary,
  onCreateAnother,
  onClose,
}: PasswordSmsResultDialogProps) => {
  const { t, i18n } = useTranslation(["users", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const canManage = Boolean(user.id) && canManagePasswordSms(viewerRole, user.role);
  // Qayta yuborish javobi — keyingi so'rov natijasi kelguncha shu ko'rinadi.
  const [resent, setResent] = useState<{ sms: PasswordSms | null; at: number } | null>(null);
  // 429 — server aytgan vaqtgacha (soniya) tugma o'chiq; kunlik limit — bugun boshqa yo'q.
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const reset = mode === "reset";
  const [passwordUnchanged, setPasswordUnchanged] = useState(reset && initialSms?.status === "failed");
  const resend = useResendPasswordSms();

  // So'rash yakuniy holatda o'zi to'xtaydi (`refetchInterval`); boshlang'ich holat yakuniy bo'lsa — bitta so'rov.
  const statusQuery = usePasswordSmsStatus(user.id, open && canManage);
  const polled = statusQuery.data?.passwordSms ?? null;
  const sms =
    resent && (!polled || statusQuery.dataUpdatedAt <= resent.at) ? (resent.sms ?? polled) : (polled ?? initialSms);

  const now = useNow(open && canManage);
  const availableAt = Math.max(
    sms?.resend_available_at ? Date.parse(sms.resend_available_at) || 0 : 0,
    blockedUntil ?? 0,
  );
  const waitSeconds = availableAt > now ? Math.ceil((availableAt - now) / 1000) : 0;
  const noResendsLeft = dailyLimitReached || sms?.resends_left_today === 0;
  const resendDisabled = resend.isPending || waitSeconds > 0 || noResendsLeft;

  const status = sms?.status ?? "pending";
  const failed = status === "failed";
  const delivered = status === "delivered";
  const sent = status === "sent" || delivered;

  const failureText = failed
    ? isKnownFailureReason(sms?.failure_reason)
      ? t(`v2.passwordSms.failure.${sms.failure_reason}`)
      : (sms?.failure_message ?? t("v2.passwordSms.failureFallback"))
    : null;

  const timeOf = (iso: string | null | undefined) => (iso ? formatDateTimeLocalized(iso, { language }) : null);

  const onResend = async () => {
    if (!user.id || resendDisabled) return;
    try {
      const result = await resend.mutateAsync(user.id);
      setBlockedUntil(null);
      setResent({ sms: result.passwordSms, at: Date.now() });
      // Yiqilgan urinish avvalgi muvaffaqiyatli tiklashni bekor qilmaydi — bayroq faqat muvaffaqiyatda tushadi.
      if (result.passwordSms?.status !== "failed") setPasswordUnchanged(false);
      // Yangi SMS — holat yana so'raladi (yakuniy holat bo'lmasa).
      void queryClient.invalidateQueries({ queryKey: passwordSmsStatusKey(user.id) });
      if (result.passwordSms?.status === "failed") {
        notify.warning(t("v2.passwordSms.resentFailed"), {
          description: result.passwordSms.failure_message ?? undefined,
        });
      } else {
        notify.success(t("v2.passwordSms.resent"), { description: t("v2.passwordSms.resentDescription") });
      }
    } catch (error) {
      const limit = readResendLimit(error);
      if (limit) {
        setBlockedUntil(Date.now() + limit.retryAfterSeconds * 1000);
        if (limit.kind === "daily") setDailyLimitReached(true);
        notifyResendLimit(t, limit);
        return;
      }
      if (!isNetworkFailure(error)) {
        notify.error(t("v2.passwordSms.resendError"), { description: getBackendErrorMessage(error) ?? undefined });
      }
    }
  };

  const title = reset
    ? t(passwordUnchanged ? "v2.passwordSms.reset.titleUnchanged" : "v2.passwordSms.reset.title")
    : t("v2.passwordSms.title");
  const description = reset
    ? t(
        passwordUnchanged
          ? "v2.passwordSms.reset.descriptionUnchanged"
          : failed
            ? "v2.passwordSms.reset.descriptionFailed"
            : sent
              ? "v2.passwordSms.reset.descriptionSent"
              : "v2.passwordSms.reset.descriptionPending",
      )
    : t(
        failed
          ? "v2.passwordSms.descriptionFailed"
          : sent
            ? "v2.passwordSms.descriptionSent"
            : "v2.passwordSms.descriptionPending",
      );

  const badge = (tone: Tone, text: string) => (
    <Badge tone={tone} dot className="self-start">
      {text}
    </Badge>
  );

  const row = (left: ReactNode, right: string | null, first = false) => (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5",
        !first && "border-t border-border",
      )}
    >
      <span className="flex min-w-0 flex-col gap-1">{left}</span>
      {right ? <span className="whitespace-nowrap text-[13px] text-text-muted">{right}</span> : null}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={failed ? TriangleAlert : CircleCheck}
      iconTone={failed ? "warning" : "success"}
      title={title}
      description={description}
      footer={
        <>
          {onCreateAnother ? (
            <Button variant="secondary" leftIcon={UserPlus} onClick={onCreateAnother}>
              {t("v2.passwordSms.createAnother")}
            </Button>
          ) : null}
          <Button onClick={onPrimary}>{primaryLabel}</Button>
        </>
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
        >
          {initialsOf(user.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold text-text">{user.name}</span>
          {user.phoneNumber ? (
            <span className="whitespace-nowrap text-[13px] text-text-muted">
              {t("v2.passwordSms.login", { phone: formatPhone(user.phoneNumber) })}
            </span>
          ) : null}
        </span>
        <Badge tone="neutral">{user.roleLabel}</Badge>
      </div>

      <div className="flex flex-col rounded-xl bg-sunken px-4 py-1" aria-live="polite">
        {failed ? (
          <>
            {row(
              <>
                {badge("danger", t("v2.passwordSms.status.failed"))}
                <span className="text-xs text-text">{failureText}</span>
              </>,
              timeOf(sms?.requested_at),
              true,
            )}
            <div className="border-t border-border py-2.5">
              <p className="m-0 text-[13px] text-text-muted">
                {t(reset ? "v2.passwordSms.reset.manualSuggestion" : "v2.passwordSms.manualSuggestion")}
              </p>
            </div>
          </>
        ) : (
          <>
            {row(
              <>
                {badge(sent ? "success" : "neutral", t(sent ? "v2.passwordSms.status.sent" : "v2.passwordSms.status.pending"))}
                <span className="text-xs text-text-muted">
                  {t(sent ? "v2.passwordSms.sentHint" : "v2.passwordSms.pendingHint")}
                </span>
              </>,
              timeOf(sent ? (sms?.sent_at ?? sms?.requested_at) : sms?.requested_at),
              true,
            )}
            {row(
              <>
                {badge(
                  delivered ? "success" : "neutral",
                  t(delivered ? "v2.passwordSms.status.delivered" : "v2.passwordSms.status.awaitingDelivery"),
                )}
                <span className="text-xs text-text-muted">
                  {t(delivered ? "v2.passwordSms.deliveredHint" : "v2.passwordSms.awaitingHint")}
                </span>
              </>,
              delivered ? timeOf(sms?.delivered_at) : null,
            )}
          </>
        )}
        {canManage ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border py-3">
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <span className="text-sm text-text">{t("v2.passwordSms.resendTitle")}</span>
              <span className="text-xs text-text-muted">
                {noResendsLeft
                  ? t("v2.passwordSms.resendDaily")
                  : typeof sms?.resends_left_today === "number"
                    ? `${t("v2.passwordSms.resendHint")} · ${t("v2.passwordSms.resendLeft", { count: sms.resends_left_today })}`
                    : t("v2.passwordSms.resendHint")}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={RefreshCw}
              className="max-w-full flex-[1_1_auto]"
              disabled={resendDisabled}
              loading={resend.isPending}
              loadingText={t("v2.passwordSms.resending")}
              onClick={() => void onResend()}
            >
              {t("v2.passwordSms.resend")}
              {waitSeconds > 0 && !noResendsLeft ? (
                <span aria-label={t("v2.passwordSms.resendCountdownAria", { seconds: waitSeconds })}>
                  {` · ${formatCountdown(waitSeconds)}`}
                </span>
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>

      {passwordUnchanged ? null : (
        <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
          <Lock size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>{t("v2.passwordSms.note")}</span>
        </p>
      )}
    </Dialog>
  );
};
