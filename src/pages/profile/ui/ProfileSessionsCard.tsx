// dizayn-v2: (maket yo'q) market-profile, common-profile
import { useEffect, useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  currentSessionFirst,
  describeSessionDevice,
  useMySessions,
  useRevokeOtherSessions,
  useRevokeSession,
  type AccountSession,
  type AccountSessionList,
} from "../../../entities/account-session";
import {
  formatDateTimeLocalized,
  formatRelativeTimeLocalized,
  toValidDate,
} from "../../../shared/lib/formatDateTime";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  QueryBoundary,
  Skeleton,
  useConfirm,
} from "../../../shared/ui/primitives";

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
 *  - Boshqa qurilmalarni chiqarish: har «Shu qurilma» BO'LMAGAN qatorda «Chiqarish» (`DELETE /auth/sessions/:id`),
 *    sarlavhada — kamida bitta boshqa sessiya bo'lsa — «Boshqa barcha qurilmalardan chiqish»
 *    (`POST /auth/sessions/revoke-others`). Ikkalasi `useConfirm` (danger: qaysi qurilma / nechta) orqali, tasdiq
 *    tugmasida yuklanish, muvaffaqiyat — `notify`, ro'yxat keshi yangilanadi. 404 — sessiya allaqachon yopilgan:
 *    ro'yxat qayta so'raladi, `notify.info`; 400 — oyna ichida sabab (joriy sessiya / eski token — qayta kirish).
 *    Yopilgan qurilma keyingi so'rovida 401 → refresh ham rad → kirish sahifasi (`setupInterceptors`).
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

/** Qurilma nomi: tur joriy tilda + server yorlig'ining qolgani; bo'lmasa qisqa User-Agent yoki «Noma'lum qurilma». */
const sessionLabel = (session: AccountSession, t: TFunction<"profile">) => {
  const device = describeSessionDevice(session);
  return device.kind
    ? [t(`sessions.kind.${device.kind}`), device.detail].filter(Boolean).join(" · ")
    : (device.detail ?? t("sessions.unknownDevice"));
};

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/** Amal natijasi tasdiq oynasidan tashqariga: 404 — sessiya allaqachon yopilgan (xato emas). */
type RevokeOutcome = { kind: "done"; revoked: number } | { kind: "gone" };

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

const SessionRow = ({
  session,
  now,
  onRevoke,
}: {
  session: AccountSession;
  now: number;
  /** Faqat «Shu qurilma» bo'lmagan qatorda. */
  onRevoke?: (session: AccountSession) => void;
}) => {
  const { t, i18n } = useTranslation("profile");
  const language = i18n.language;
  const label = sessionLabel(session, t);

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
      {onRevoke ? (
        <Button
          variant="danger-soft"
          size="sm"
          leftIcon={LogOut}
          aria-haspopup="dialog"
          aria-label={t("sessions.revoke.aria", { device: label })}
          onClick={() => onRevoke(session)}
          className="shrink-0 self-center max-md:self-start"
        >
          {t("sessions.revoke.action")}
        </Button>
      ) : null}
    </li>
  );
};

export const ProfileSessionsCard = ({ className }: { className?: string }) => {
  const { t, i18n } = useTranslation("profile");
  const language = i18n.language;
  const query = useMySessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const confirm = useConfirm();
  const now = useNow(CLOCK_TICK_MS);
  const list = query.data;
  const others = list?.sessions.filter((session) => !session.current) ?? [];
  // Ro'yxat 50 ta bilan cheklangan — sarlavhadagi son to'liq (`active_count`), joriy sessiya ham shu sonda.
  const otherCount = list
    ? Math.max(others.length, list.active_count - (list.sessions.some((session) => session.current) ? 1 : 0))
    : 0;

  const handleRevoke = async (session: AccountSession) => {
    const label = sessionLabel(session, t);
    // Natija tasdiq oynasi ichidagi `onConfirm` dan chiqadi (oyna yopilgach xabar).
    const result: { outcome?: RevokeOutcome } = {};
    const ok = await confirm({
      tone: "danger",
      icon: LogOut,
      title: t("sessions.revoke.title"),
      description: t("sessions.revoke.description"),
      details: (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold wrap-break-word text-text">{label}</span>
          <span className="text-[13px] wrap-break-word text-text-muted">
            {[
              session.ip ? t("sessions.ip", { ip: session.ip }) : t("sessions.ipUnknown"),
              t("sessions.revoke.lastSeen", {
                when: formatRelativeTimeLocalized(session.last_seen_at, { language, now: Date.now() }),
              }),
            ].join(" · ")}
          </span>
        </span>
      ),
      confirmLabel: t("sessions.revoke.confirm"),
      confirmIcon: LogOut,
      loadingLabel: t("sessions.revoke.loading"),
      onConfirm: async () => {
        try {
          const response = await revokeOne.mutateAsync(session.id);
          result.outcome = { kind: "done", revoked: response.revoked };
        } catch (error) {
          // Boshqa qurilmadan (yoki boshqa oynadan) allaqachon yopilgan — xato emas, ro'yxat yangilanadi.
          if (statusOf(error) === 404) {
            result.outcome = { kind: "gone" };
            return;
          }
          throw error;
        }
      },
    });
    if (!ok || !result.outcome) return;
    if (result.outcome.kind === "gone") {
      notify.info(t("sessions.revoke.goneTitle"), { description: t("sessions.listRefreshed") });
    } else {
      notify.success(t("sessions.revoke.success"), { description: label });
    }
  };

  const handleRevokeOthers = async () => {
    const result: { revoked?: number } = {};
    const ok = await confirm({
      tone: "danger",
      icon: LogOut,
      title: t("sessions.revokeOthers.title"),
      description: t("sessions.revokeOthers.description", { count: otherCount }),
      note: t("sessions.revokeOthers.note"),
      confirmLabel: t("sessions.revokeOthers.confirm"),
      confirmIcon: LogOut,
      loadingLabel: t("sessions.revoke.loading"),
      // 400 — joriy sessiya aniqlanmadi (sessiyalardan oldingi eski token): qayta kirish kerak.
      errorMessage: (error) =>
        statusOf(error) === 400
          ? t("sessions.revokeOthers.reloginRequired")
          : (getActionErrorMessage(error, t("sessions.revoke.error")) ?? t("sessions.revoke.error")),
      onConfirm: async () => {
        const response = await revokeOthers.mutateAsync();
        result.revoked = response.revoked;
      },
    });
    if (!ok || result.revoked === undefined) return;
    if (result.revoked > 0) {
      notify.success(t("sessions.revokeOthers.success"), {
        description: t("sessions.revokeOthers.successDescription", { count: result.revoked }),
      });
    } else {
      notify.info(t("sessions.revokeOthers.noneTitle"), { description: t("sessions.listRefreshed") });
    }
  };

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
      actions={
        others.length > 0 ? (
          <Button
            variant="danger-soft"
            size="sm"
            leftIcon={LogOut}
            aria-haspopup="dialog"
            onClick={() => void handleRevokeOthers()}
          >
            {t("sessions.revokeOthers.action")}
          </Button>
        ) : null
      }
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
              <SessionRow
                key={session.id}
                session={session}
                now={now}
                onRevoke={session.current ? undefined : (target) => void handleRevoke(target)}
              />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
};
