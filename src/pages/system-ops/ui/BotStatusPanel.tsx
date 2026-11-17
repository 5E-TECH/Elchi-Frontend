// dizayn-v2: (maket yo'q) superadmin-ops-system-partial, superadmin-ops-system-ai-config
import { CircleX, Hourglass, KeyRound, Power, RefreshCw, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRecheckNotificationBot } from "../../../entities/coverage/notificationBotHealth";
import { getBackendMessage, getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Badge, Button } from "../../../shared/ui/primitives";
import { OpsAlert, type OpsAlertTone } from "../../ops/ui/OpsToolPage";
import {
  botIssue,
  botIssueText,
  botIssueTitle,
  readBotHealth,
  type BotHealth,
  type BotIssue,
  type BotIssueKind,
} from "../lib/botStatus";

/**
 * «Tizim holati» → Telegram bot nosozligining aniq sababi (BOT-DIAG-FE). Maket yo'q — eng yaqini:
 * `superadmin-ops-system-partial` (NOTIFICATION qatori) va `superadmin-ops-system-ai-config` (sabab + nima qilish
 * kerak — `.el-alert`, «AI holati» kartasidagi `OpsAlert`).
 *
 * NOTIFICATION qatori `down` / `reported` bo'lganda `HealthCard` xulosa qatori ostida chizadi: sabab sarlavhasi va
 * keyingi qadam (`error_kind` bo'yicha), server texnik matni («Texnik sabab»), «Oxirgi tekshiruv» va ikkinchi
 * darajali «Qayta tekshirish» (`POST …/recheck`). Token rad etilgan / sozlanmagan bo'lsa tugma o'rniga
 * «Qayta ishga tushirish kerak» (qayta tekshirish yordam bermaydi).
 */

type IssueLook = { tone: OpsAlertTone; icon: LucideIcon };

const ISSUE_LOOK: Record<BotIssueKind, IssueLook> = {
  tokenRejected: { tone: "danger", icon: KeyRound },
  disabled: { tone: "warning", icon: Power },
  network: { tone: "warning", icon: WifiOff },
  timeout: { tone: "warning", icon: WifiOff },
  telegramError: { tone: "warning", icon: TriangleAlert },
  unknown: { tone: "danger", icon: CircleX },
  pending: { tone: "info", icon: Hourglass },
};

export const BotStatusPanel = ({ health, issue }: { health: BotHealth; issue: BotIssue }) => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const recheck = useRecheckNotificationBot();
  const look = ISSUE_LOOK[issue.kind];
  const checkedAt = health.checkedAt ? formatDateTimeLocalized(health.checkedAt, { language }) : null;
  // «Tekshiruv hali tugamagan» sarlavhasi vaqtsiz holatni o'zi aytadi — takrorlanmaydi.
  const meta = checkedAt
    ? t("system.health.bot.checkedAt", { time: checkedAt })
    : issue.kind === "pending"
      ? null
      : t("system.health.bot.neverChecked");

  // `mutateAsync` — natija xabari blok yo'qolganda ham chiqadi (bot tiklansa blok darhol yopiladi).
  const onRecheck = async () => {
    let data: unknown;
    try {
      data = await recheck.mutateAsync();
    } catch (error) {
      const status = getErrorStatus(error);
      // Javob umuman kelmadi (tarmoq / vaqt) — global «Internet aloqasi yo'q» / «Server javob bermadi» o'zi chiqadi.
      if (status === undefined) return;
      const description =
        status === 503
          ? (getBackendMessage(error) ?? t("system.health.bot.result.unavailable"))
          : status === 429
            ? t("system.health.bot.result.tooMany")
            : t("system.health.bot.result.retryLater");
      notify.error(t("system.health.bot.result.error"), { description });
      return;
    }
    const next = readBotHealth(data);
    if (next?.healthy === true) {
      notify.success(t("system.health.bot.result.healthy"), {
        description: next.username ? t("system.health.bot.result.healthyUser", { username: next.username }) : undefined,
      });
      return;
    }
    const nextIssue = next ? botIssue(next) : null;
    notify.warning(t("system.health.bot.result.failing"), {
      description: nextIssue ? botIssueTitle(t, nextIssue) : undefined,
    });
  };

  return (
    <section aria-label={t("system.health.bot.label")} className="flex flex-col gap-3 border-t border-border px-5 py-4">
      <OpsAlert tone={look.tone} icon={look.icon} title={botIssueTitle(t, issue)}>
        {botIssueText(t, issue)}
        {health.errorText ? (
          <span className="mt-1 block text-xs">
            {t("system.health.bot.technical")}{" "}
            <code className="font-mono text-xs text-text wrap-anywhere">{health.errorText}</code>
          </span>
        ) : null}
      </OpsAlert>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {meta ? <p className="text-[13px] text-text-muted">{meta}</p> : null}
        {issue.restartRequired ? (
          <Badge tone="warning" icon={Power} className="ml-auto">
            {t("system.health.bot.restartRequired")}
          </Badge>
        ) : (
          <Button
            className="ml-auto"
            variant="secondary"
            size="sm"
            leftIcon={RefreshCw}
            loading={recheck.isPending}
            loadingText={t("system.health.bot.rechecking")}
            onClick={() => void onRecheck()}
          >
            {t("system.health.bot.recheck")}
          </Button>
        )}
      </div>
    </section>
  );
};
