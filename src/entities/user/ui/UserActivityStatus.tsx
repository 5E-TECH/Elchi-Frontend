// dizayn-v2: superadmin-users-list, admin-users-list, manager-users-list, superadmin-users-detail, admin-users-detail, manager-users-detail
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized, formatRelativeTimeLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { Badge } from "../../../shared/ui/primitives";
import type { User } from "../types/user";
import { hasActivity, lastActivityAt } from "../lib/activity";

/** Nisbiy vaqt («2 soat oldin») sahifa ochiq turganda eskirmasin: har daqiqada qayta chizish (tarmoq so'rovisiz). */
const TICK_MS = 60_000;

export const useActivityNow = (enabled: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
};

type ActivityUser = Pick<User, "role" | "is_online" | "last_login_at" | "last_seen_at">;

const SUB = "text-[13px] text-text-muted";

/** «Online» (yashil nuqta) yoki «Offline» (kulrang) belgisi. */
export const UserOnlineBadge = ({ online }: { online: boolean }) => {
  const { t } = useTranslation("users");
  return (
    <Badge tone={online ? "success" : "neutral"} dot>
      {t(online ? "activity.online" : "activity.offline")}
    </Badge>
  );
};

/** `<time>` — nisbiy vaqt, `title` da to'liq sana-vaqt (Toshkent vaqti, brauzer mintaqasi). */
export const ActivityTime = ({
  value,
  now,
  className,
}: {
  value: string;
  now: number;
  className?: string;
}) => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <time
      className={className}
      dateTime={toValidDate(value)?.toISOString()}
      title={formatDateTimeLocalized(value, { language })}
    >
      {formatRelativeTimeLocalized(value, { language, now })}
    </time>
  );
};

/**
 * pe71yf8L — «Faollik» katagi (`/all-users`, «Marketlar» va «Market operatorlari» tablari): «Online» yoki «Offline» +
 * oxirgi faollik («2 soat oldin», `title` — to'liq vaqt); hech kirmagan — «Hali kirmagan». Ma'lumot kelmagan qator
 * (xodim, eski backend) — «—». `variant="card"` (telefon kartasi) — belgi va qisqa vaqt bir qatorda.
 */
export const UserActivityStatus = ({
  user,
  now,
  variant = "cell",
}: {
  user: ActivityUser;
  now: number;
  variant?: "cell" | "card";
}) => {
  const { t } = useTranslation("users");
  if (!hasActivity(user)) {
    return variant === "card" ? null : <span className="text-text-subtle">—</span>;
  }
  const online = Boolean(user.is_online);
  const last = online ? undefined : lastActivityAt(user);
  const detail =
    last === null ? (
      <span className={SUB}>{t("activity.never")}</span>
    ) : last ? (
      <ActivityTime value={last} now={now} className={SUB} />
    ) : null;

  if (variant === "card") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <UserOnlineBadge online={online} />
        {detail}
      </span>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <UserOnlineBadge online={online} />
      {detail}
    </div>
  );
};
