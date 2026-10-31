// dizayn-v2: (maket yo'q) superadmin-users-create-password-result-dialog
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PasswordSms } from "../../../../entities/user/types/user";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { Button, useConfirm } from "../../../../shared/ui/primitives";
import { useResendPasswordSms } from "../api/passwordSmsApi";
import { readResendLimit } from "../model/passwordSms";
import { resendLimitText } from "./notifyResendLimit";
import { PasswordSmsResultDialog, type PasswordSmsResultUser } from "./PasswordSmsResultDialog";

type ResetPasswordSmsButtonProps = {
  user: PasswordSmsResultUser & { id: string };
  /** Ko'ruvchi roli — natija oynasidagi holat va qayta yuborish huquqi. */
  viewerRole: string | null | undefined;
};

/**
 * «PAROLNI TIKLASH VA SMS YUBORISH» (xtXKLUwT) — foydalanuvchi tafsilotidagi amal. Maket yo'q — eng yaqini
 * `superadmin-users-create-password-result-dialog`.
 *
 * Tasdiqdan keyin `POST /users/:id/password/resend-sms`: yangi vaqtinchalik parol + SMS, eski parol ishlamaydi,
 * sessiyalar yopiladi. Xato (403 begona kuryer, 429 cooldown / kunlik limit) tasdiq oynasining o'zida ko'rinadi.
 * Natija — `PasswordSmsResultDialog` (`reset`): holat, sabab, «SMSni qayta yuborish» (60 s sanoq). Parol ko'rsatilmaydi.
 */
export const ResetPasswordSmsButton = ({ user, viewerRole }: ResetPasswordSmsButtonProps) => {
  const { t } = useTranslation(["users", "common"]);
  const confirm = useConfirm();
  const resend = useResendPasswordSms();
  const [result, setResult] = useState<{ sms: PasswordSms | null } | null>(null);

  const onClick = async () => {
    const outcome = { sms: null as PasswordSms | null };
    const confirmed = await confirm({
      title: t("v2.passwordSms.reset.confirmTitle"),
      description: t("v2.passwordSms.reset.confirmDescription", {
        name: user.name,
        phone: formatPhone(user.phoneNumber),
      }),
      confirmLabel: t("v2.passwordSms.reset.confirmLabel"),
      loadingLabel: t("v2.passwordSms.reset.confirmLoading"),
      tone: "danger",
      consequences: [
        { text: t("v2.passwordSms.reset.consequenceOld"), tone: "warning" },
        { text: t("v2.passwordSms.reset.consequenceSessions"), tone: "warning" },
        { text: t("v2.passwordSms.reset.consequenceFirstLogin") },
      ],
      onConfirm: async () => {
        outcome.sms = (await resend.mutateAsync(user.id)).passwordSms;
      },
      errorMessage: (error) => {
        const limit = readResendLimit(error);
        if (limit) return resendLimitText(t, limit);
        return getBackendErrorMessage(error) ?? t("v2.passwordSms.reset.error");
      },
    });
    if (confirmed) setResult(outcome);
  };

  return (
    <>
      <Button variant="secondary" leftIcon={KeyRound} onClick={() => void onClick()}>
        {t("v2.passwordSms.reset.action")}
      </Button>
      {result ? (
        <PasswordSmsResultDialog
          open
          mode="reset"
          user={user}
          initialSms={result.sms}
          viewerRole={viewerRole}
          primaryLabel={t("common:close")}
          onPrimary={() => setResult(null)}
          onClose={() => setResult(null)}
        />
      ) : null}
    </>
  );
};
