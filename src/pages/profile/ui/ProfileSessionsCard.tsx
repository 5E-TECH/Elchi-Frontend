// dizayn-v2: (maket yo'q) market-profile, common-profile
import { useEffect, useId, useState } from "react";
import { KeyRound, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  currentSessionFirst,
  describeSessionDevice,
  parseSessionTooNewError,
  useMySessions,
  useRevokeOtherSessions,
  useRevokeSession,
  type AccountSession,
  type AccountSessionList,
  type SessionTooNewError,
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
  StatusBadge,
  TONE_SOFT,
  useConfirm,
} from "../../../shared/ui/primitives";
import { cx } from "../../../shared/lib/cx";

/**
 * «SESSIYALAR» — profil (`/profile`, barcha rollar), Elchi Pochta #3. Maket yo'q — eng yaqini `market-profile`
 * «Telegram guruhi» kartasi (sarlavha + badge, izoh, chiziq bilan ajratilgan qatorlar: `.el-stat-icon`, `.el-h3`,
 * badge, `.el-small` izoh) va `common-profile` «Xavfsizlik» kartasi.
 *
 *  - Sarlavha «Sessiyalar» + «N ta faol» (`active_count` — FAQAT shu hisobning `active` sessiyalari; `expired`,
 *    tizim bo'yicha son yoki boshqa foydalanuvchilar yo'q), izoh — chiqish faqat shu qurilmani yopadi.
 *  - Har qator: qurilma (mijoz nomi «Samsung SM-A515F · Android 13 · Chrome 155» yoki server yorlig'i
 *    «Telefon · Android · Chrome», turi joriy tilda; bo'lmasa qisqa User-Agent, u ham bo'lmasa «Noma'lum
 *    qurilma»; to'liq User-Agent — `title`), «Shu qurilma» badge'i, «Tarmoq IP» (bitta Wi-Fi'dagi qurilmalar bir
 *    xil IP — `title` izohi), «Kirgan vaqti» (OXIRGI kirish; birinchi kirish boshqa bo'lsa — ostida «Birinchi
 *    marta: …») va «Oxirgi faollik» (nisbiy «12 daqiqa oldin» + «Bugun, 14:15»). Tartib: «Shu qurilma», faollar,
 *    so'ng qayta kirishi kerak bo'lganlar.
 *  - `expired` (qurilmada ochiq sessiya bor, lekin qayta kirishi kerak — refresh muddati tugagan yoki parol
 *    almashgan): qator xiralashgan (`text-text-muted` / `text-text-subtle`, AA saqlanadi) + neytral «Qayta kirish
 *    kerak» belgisi (`LogIn`); «Chiqarish» unda ham bor.
 *  - Telefonda qator ustma-ust: qurilma, so'ng ikki ustunli vaqtlar.
 *  - Holatlar `QueryBoundary`: qator shaklidagi skelet, bo'sh holat, xato + «Qayta urinish». Ro'yxatdagi faollar
 *    `active_count` dan kam bo'lsa (server chegarasi) — pastda «Oxirgi N tasi ko'rsatilgan».
 *  - So'rov bo'lim ochilganda va oynaga qaytilganda (`useMySessions`); davriy so'rov yo'q — faqat nisbiy vaqt
 *    har daqiqada qayta chiziladi.
 *  - Boshqa qurilmalarni chiqarish: har «Shu qurilma» BO'LMAGAN qatorda «Chiqarish» (`DELETE /auth/sessions/:id`),
 *    sarlavhada — kamida bitta boshqa sessiya (faol yoki `expired`) bo'lsa — «Boshqa barcha qurilmalardan chiqish»
 *    (`POST /auth/sessions/revoke-others`, tasdiqdagi son — barcha boshqalar). Ikkalasi `useConfirm` (danger:
 *    qaysi qurilma / nechta; `expired` qatorda o'z izohi) orqali, tasdiq tugmasida yuklanish, muvaffaqiyat —
 *    `notify`, ro'yxat keshi yangilanadi. 404 — sessiya allaqachon yopilgan: ro'yxat qayta so'raladi,
 *    `notify.info`; 400 — oyna ichida sabab (joriy sessiya / eski token — qayta kirish).
 *    Yopilgan qurilma keyingi so'rovida 401 → refresh ham rad → kirish sahifasi (`setupInterceptors`).
 *  - Yangi qurilma (Telegram kabi qoida): shu qurilmadan birinchi kirganiga 48 soat to'lmagan sessiya boshqalarni
 *    chiqara olmaydi — `can_revoke_others: false` va ro'yxatda kamida bitta boshqa sessiya bo'lsa (faqat shu qurilma
 *    bo'lsa — chiqaradigan narsa yo'q, ogohlantirish ham yo'q) kartada `.el-alert` (info, `ShieldCheck`): faqat
 *    sabab — qachon mumkin bo'lishi ko'rsatilmaydi (Dilshod). Ikkala chiqarish amali yashirilmaydi — `disabled` +
 *    `aria-describedby` (sabab) + `title`. `revoke_available_at` o'tib ketsa (sahifa ochiq turganda) — cheklov o'zi
 *    olinadi. Maydon yo'q (eski backend) — ruxsat.
 *    Shunga qaramay 403 `SESSION_TOO_NEW` kelsa: tasdiq oynasi yopiladi, sabab (vaqtsiz) `notify.warning` da,
 *    ro'yxat qayta so'raladi (`useRevokeSessions` → yangi ro'yxat cheklovni olib keladi).
 */

/** `.el-stat-icon` — neytral ikonka qutisi (CODE-MAP; `ProfileCards` dagi bilan bir xil); rangi alohida. */
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken";

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

const isExpired = (session: AccountSession) => session.status === "expired";

/**
 * «Birinchi marta» qatori faqat birinchi kirish oxirgisidan ko'rinadigan aniqlikda (daqiqa) farq qilsa; maydon
 * yo'q (eski backend) yoki yaroqsiz bo'lsa — yo'q.
 */
const firstLoginShown = (session: AccountSession, language: string, now: number) => {
  if (!toValidDate(session.first_logged_in_at)) return null;
  const first = formatDateTimeLocalized(session.first_logged_in_at, { language, now });
  return first === formatDateTimeLocalized(session.logged_in_at, { language, now }) ? null : first;
};

/** Qurilma nomi: tur joriy tilda + server yorlig'ining qolgani; bo'lmasa qisqa User-Agent yoki «Noma'lum qurilma». */
const sessionLabel = (session: AccountSession, t: TFunction<"profile">) => {
  const device = describeSessionDevice(session);
  return device.kind
    ? [t(`sessions.kind.${device.kind}`), device.detail].filter(Boolean).join(" · ")
    : (device.detail ?? t("sessions.unknownDevice"));
};

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/**
 * Amal natijasi tasdiq oynasidan tashqariga: 404 — sessiya allaqachon yopilgan (xato emas); 403 `SESSION_TOO_NEW`
 * — joriy sessiya yangi (oyna yopiladi, sabab xabarda).
 */
type RevokeOutcome =
  | { kind: "done"; revoked: number }
  | { kind: "gone" }
  | { kind: "tooNew"; error: SessionTooNewError };

/** Cheklov amalda: `can_revoke_others === false` va ruxsat vaqti hali kelmagan (vaqt noma'lum — kelmagan). */
const isRevokeLocked = (list: AccountSessionList | undefined, now: number) => {
  if (!list || list.can_revoke_others !== false) return false;
  const availableAt = toValidDate(list.revoke_available_at);
  return !availableAt || availableAt.getTime() > now;
};

/**
 * «Yangi qurilma» ogohlantirishi — `.el-alert` (CODE-MAP 2.7, info): faqat sabab (qachon mumkinligi ko'rsatilmaydi).
 * `reasonId` — o'chirilgan tugmalarning `aria-describedby` manbasi.
 */
const RevokeLockNotice = ({ reasonId }: { reasonId: string }) => {
  const { t } = useTranslation("profile");
  return (
    <div
      role="status"
      data-testid="sessions-revoke-lock"
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.info)}
    >
      <ShieldCheck size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        <p id={reasonId} className="font-bold wrap-break-word">
          {t("sessions.lock.title")}
        </p>
      </div>
    </div>
  );
};

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
  lock,
}: {
  session: AccountSession;
  now: number;
  /** Faqat «Shu qurilma» bo'lmagan qatorda. */
  onRevoke?: (session: AccountSession) => void;
  /** Yangi qurilma cheklovi: «Chiqarish» o'chirilgan, sababi — ogohlantirish matni. */
  lock?: { describedBy: string; title: string };
}) => {
  const { t, i18n } = useTranslation("profile");
  const language = i18n.language;
  const label = sessionLabel(session, t);
  const expired = isExpired(session);
  const firstLogin = firstLoginShown(session, language, now);
  // Qayta kirishi kerak bo'lgan qator xiralashgan: asosiy matn `text-muted` (AA), ikonka `text-subtle`.
  const valueClass = cx("text-sm font-semibold", expired ? "text-text-muted" : "text-text");

  return (
    <li
      data-session-status={session.status}
      className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${ROW}`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
        <span aria-hidden="true" className={cx(STAT_ICON, expired ? "text-text-subtle" : "text-text-muted")}>
          <KeyRound size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={cx("min-w-0 wrap-break-word", valueClass)}
              title={session.user_agent ?? undefined}
            >
              {label}
            </h3>
            {session.current ? <Badge tone="info">{t("sessions.current")}</Badge> : null}
            {expired ? <StatusBadge tone="neutral" icon={LogIn} label={t("sessions.expired")} /> : null}
          </div>
          <p
            className="text-[13px] wrap-break-word text-text-muted"
            title={session.ip ? t("sessions.ipHint") : undefined}
          >
            {session.ip ? t("sessions.ip", { ip: session.ip }) : t("sessions.ipUnknown")}
          </p>
        </div>
      </div>
      <dl className="grid min-w-0 flex-[0_1_480px] grid-cols-2 gap-x-6 gap-y-3 max-md:flex-[1_1_100%]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("sessions.loggedInAt")}</dt>
          <dd className={valueClass}>
            <time dateTime={isoOf(session.logged_in_at)}>
              {formatDateTimeLocalized(session.logged_in_at, { language, now })}
            </time>
          </dd>
          {firstLogin ? (
            <dd className="text-[13px] text-text-muted">
              {t("sessions.firstLoggedInAt")}{" "}
              <time className="whitespace-nowrap" dateTime={isoOf(session.first_logged_in_at)}>
                {firstLogin}
              </time>
            </dd>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("sessions.lastSeenAt")}</dt>
          <dd className={valueClass}>
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
          disabled={Boolean(lock)}
          aria-describedby={lock?.describedBy}
          title={lock?.title}
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
  const reasonId = useId();
  const query = useMySessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const confirm = useConfirm();
  const now = useNow(CLOCK_TICK_MS);
  const list = query.data;
  const others = list?.sessions.filter((session) => !session.current) ?? [];
  // Ro'yxat server chegarasida qisqa qolishi mumkin — `active_count` to'liq (faqat faollar, joriy ham shu sonda).
  const activeInList = list?.sessions.filter((session) => !isExpired(session)).length ?? 0;
  const hiddenActive = list ? Math.max(0, list.active_count - activeInList) : 0;
  // Tasdiqdagi son — barcha boshqa qurilmalar: faol va qayta kirishi kerak bo'lganlar.
  const otherCount = others.length + hiddenActive;
  // Yangi qurilma: boshqalarni chiqarish vaqtincha yopiq (tugmalar o'chirilgan, sababi ogohlantirishda). Boshqa
  // sessiya yo'q bo'lsa — chiqaradigan narsa yo'q, ogohlantirish ham yo'q (ro'yxat yangilanib boshqasi kelsa — chiqadi).
  const locked = others.length > 0 && isRevokeLocked(list, now);
  const lock = locked
    ? {
        describedBy: reasonId,
        title: t("sessions.lock.title"),
      }
    : undefined;

  /** 403 `SESSION_TOO_NEW`: sabab ogohlantirish xabarida — vaqtsiz (server matnidagi sana ko'rsatilmaydi). */
  const notifyTooNew = () => {
    notify.warning(t("sessions.lock.toastTitle"), { description: t("sessions.lock.title") });
  };

  const handleRevoke = async (session: AccountSession) => {
    const label = sessionLabel(session, t);
    // Natija tasdiq oynasi ichidagi `onConfirm` dan chiqadi (oyna yopilgach xabar).
    const result: { outcome?: RevokeOutcome } = {};
    const ok = await confirm({
      tone: "danger",
      icon: LogOut,
      title: t("sessions.revoke.title"),
      description: isExpired(session) ? t("sessions.revoke.descriptionExpired") : t("sessions.revoke.description"),
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
          // Joriy sessiya yangi (48 soat to'lmagan) — oyna yopiladi, sabab xabarda, ro'yxat qayta so'raladi.
          const tooNew = parseSessionTooNewError(error);
          if (tooNew) {
            result.outcome = { kind: "tooNew", error: tooNew };
            return;
          }
          throw error;
        }
      },
    });
    if (!ok || !result.outcome) return;
    if (result.outcome.kind === "tooNew") {
      notifyTooNew();
    } else if (result.outcome.kind === "gone") {
      notify.info(t("sessions.revoke.goneTitle"), { description: t("sessions.listRefreshed") });
    } else {
      notify.success(t("sessions.revoke.success"), { description: label });
    }
  };

  const handleRevokeOthers = async () => {
    const result: { revoked?: number; tooNew?: SessionTooNewError } = {};
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
        try {
          const response = await revokeOthers.mutateAsync();
          result.revoked = response.revoked;
        } catch (error) {
          // Joriy sessiya yangi (48 soat to'lmagan) — oyna yopiladi, sabab xabarda, ro'yxat qayta so'raladi.
          const tooNew = parseSessionTooNewError(error);
          if (!tooNew) throw error;
          result.tooNew = tooNew;
        }
      },
    });
    if (!ok) return;
    if (result.tooNew) {
      notifyTooNew();
      return;
    }
    if (result.revoked === undefined) return;
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
            disabled={locked}
            aria-describedby={lock?.describedBy}
            title={lock?.title}
            onClick={() => void handleRevokeOthers()}
          >
            {t("sessions.revokeOthers.action")}
          </Button>
        ) : null
      }
      footer={
        hiddenActive > 0 && list ? (
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
          <>
            {lock ? (
              <div className="px-5 pt-4">
                <RevokeLockNotice reasonId={reasonId} />
              </div>
            ) : null}
            <ul aria-label={t("sessions.listLabel")} className="flex flex-col">
              {currentSessionFirst(data.sessions).map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  now={now}
                  lock={lock}
                  onRevoke={session.current ? undefined : (target) => void handleRevoke(target)}
                />
              ))}
            </ul>
          </>
        )}
      </QueryBoundary>
    </Card>
  );
};
