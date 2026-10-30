import type { TFunction } from "i18next";
import { notify } from "../../../../shared/lib/notify";
import { formatCountdown, type ResendLimit } from "../model/passwordSms";

/** 429 matni: `PASSWORD_SMS_COOLDOWN` — qancha kutish, `PASSWORD_SMS_DAILY_LIMIT` — bugungi limit tugadi. */
export const resendLimitText = (t: TFunction, limit: ResendLimit) =>
  limit.kind === "daily"
    ? t("v2.passwordSms.resendDaily")
    : t("v2.passwordSms.resendCooldownText", { time: formatCountdown(limit.retryAfterSeconds) });

export const notifyResendLimit = (t: TFunction, limit: ResendLimit) =>
  notify.warning(t(limit.kind === "daily" ? "v2.passwordSms.resendDaily" : "v2.passwordSms.resendCooldown"), {
    description: limit.kind === "daily" ? undefined : resendLimitText(t, limit),
  });
