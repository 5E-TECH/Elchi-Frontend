// dizayn-v2: (maket yo'q) market-profile, common-profile
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  currentSessionFirst,
  describeSessionDevice,
  useMySessions,
  type AccountSession,
  type AccountSessionList,
} from "../../../entities/account-session";
import {
  formatDateTimeLocalized,
  formatRelativeTimeLocalized,
  toValidDate,
} from "../../../shared/lib/formatDateTime";
import { Badge, Card, EmptyState, QueryBoundary, Skeleton } from "../../../shared/ui/primitives";

/**
 * «SESSIYALAR» — profil (`/profile`, barcha rollar), Elchi Pochta #3. Maket yo'q — eng yaqini `market-profile`
 * «Telegram guruhi» kartasi (sarlavha + badge, izoh, chiziq bilan ajratilgan qatorlar: `.el-stat-icon`, `.el-h3`,
 * badge, `.el-small` izoh) va `common-profile` «Xavfsizlik» kartasi.
 *
 *  - Sarlavha «Sessiyalar» + «N ta faol» (`active_count` — FAQAT shu hisobning faol sessiyalari; tizim bo'yicha
 *    son yoki boshqa foydalanuvchilar yo'q), izoh — chiqish faqat shu qurilmani yopadi.
 *  - Har qator: qurilma (server yorlig'i «Telefon · Android · Chrome», turi joriy tilda; bo'lmasa qisqa
 *    User-Agent, u ham bo'lmasa «Noma'lum qurilma»; to'liq User-Agent — `title`), «Shu qurilma» badge'i, IP,
 *    «Kirgan vaqti» va «Oxirgi faollik» (nisbiy «12 daqiqa oldin» + «Bugun, 14:15»). «Shu qurilma» tepada,
 *    qolgani server tartibida (oxirgi faollik bo'yicha yangisi tepada).
 *  - Telefonda qator ustma-ust: qurilma, so'ng ikki ustunli vaqtlar.
 *  - Holatlar `QueryBoundary`: qator shaklidagi skelet, bo'sh holat, xato + «Qayta urinish». Ro'yxat 50 tadan
 *    qisqa qolsa (server chegarasi) — pastda «Oxirgi 50 tasi ko'rsatilgan».
 *  - So'rov bo'lim ochilganda va oynaga qaytilganda (`useMySessions`); davriy so'rov yo'q — faqat nisbiy vaqt
 *    har daqiqada qayta chiziladi.
 */

/** `.el-stat-icon` — neytral ikonka qutisi (CODE-MAP; `ProfileCards` dagi bilan bir xil). */
const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

/** Qator chekkasi — maketdagi `padding: 14px 20px` + chiziq (`market-profile` «Telegram guruhi»). */
const ROW = "border-b border-border px-5 py-3.5 last:border-b-0";

/** Nisbiy vaqt sahifa ochiq turganda eskirmasin: har daqiqada qayta chizish (tarmoq so'rovisiz). */
const CLOCK_TICK_MS = 60_000;

const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

const isoOf = (value: string | null) => toValidDate(value)?.toISOString();

const SessionsSkeleton = () => (
  <ul aria-hidden="true" className="flex flex-col">
    {[0, 1].map((index) => (
      <li key={index} className={`flex items-start gap-3 ${ROW}`}>
        <Skeleton shape="block" width={36} height={36} className="rounded-[10px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          <Skeleton width="45%" height={14} />
          <Skeleton width="25%" />
        </div>
      </li>
    ))}
  </ul>
);

const SessionRow = ({ session, now }: { session: AccountSession; now: number }) => {
  const { t, i18n } = useTranslation("profile");
  const language = i18n.language;
  const device = describeSessionDevice(session);
  const label = device.kind
    ? [t(`sessions.kind.${device.kind}`), device.detail].filter(Boolean).join(" · ")
    : (device.detail ?? t("sessions.unknownDevice"));

  return (
    <li className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${ROW}`}>
      <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
        <span aria-hidden="true" className={STAT_ICON}>
          <KeyRound size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className="min-w-0 text-sm font-semibold wrap-break-word text-text"
              title={session.user_agent ?? undefined}
            >
              {label}
            </h3>
            {session.current ? <Badge tone="info">{t("sessions.current")}</Badge> : null}
          </div>
          <p className="text-[13px] wrap-break-word text-text-muted">
            {session.ip ? t("sessions.ip", { ip: session.ip }) : t("sessions.ipUnknown")}
          </p>
        </div>
      </div>
      <dl className="grid min-w-0 flex-[0_1_400px] grid-cols-2 gap-x-6 gap-y-3 max-md:flex-[1_1_100%]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("sessions.loggedInAt")}</dt>
          <dd className="text-sm font-semibold text-text">
            <time dateTime={isoOf(session.logged_in_at)}>
              {formatDateTimeLocalized(session.logged_in_at, { language, now })}
            </time>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("sessions.lastSeenAt")}</dt>
          <dd className="text-sm font-semibold text-text">
            <time dateTime={isoOf(session.last_seen_at)}>
              {formatRelativeTimeLocalized(session.last_seen_at, { language, now })}
            </time>
          </dd>
          <dd className="text-[13px] text-text-muted">
            {formatDateTimeLocalized(session.last_seen_at, { language, now })}
          </dd>
        </div>
      </dl>
    </li>
  );
};

export const ProfileSessionsCard = ({ className }: { className?: string }) => {
  const { t } = useTranslation("profile");
  const query = useMySessions();
  const now = useNow(CLOCK_TICK_MS);
  const list = query.data;

  return (
    <Card
      padding="none"
      className={className}
      title={t("sessions.title")}
      titleAddon={
        list ? (
          <Badge tone={list.active_count > 0 ? "success" : "neutral"} dot>
            {t("sessions.activeCount", { count: list.active_count })}
          </Badge>
        ) : null
      }
      description={t("sessions.description")}
      footer={
        list && list.active_count > list.sessions.length ? (
          <p className="text-[13px] text-text-muted">
            {t("sessions.truncated", { shown: list.sessions.length, count: list.active_count })}
          </p>
        ) : null
      }
    >
      <QueryBoundary
        query={query}
        isEmpty={(data: AccountSessionList) => data.sessions.length === 0}
        loading={<SessionsSkeleton />}
        loadingLabel={t("sessions.loading")}
        empty={
          <EmptyState
            icon={KeyRound}
            title={t("sessions.emptyTitle")}
            description={t("sessions.emptyDescription")}
          />
        }
      >
        {(data) => (
          <ul aria-label={t("sessions.listLabel")} className="flex flex-col">
            {currentSessionFirst(data.sessions).map((session) => (
              <SessionRow key={session.id} session={session} now={now} />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
};
