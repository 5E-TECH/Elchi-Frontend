// dizayn-v2: superadmin-users-detail-telegram, admin-users-detail-telegram, market-profile, market-profile-telegram-status
import { memo, useId, useRef } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ChevronRight, Link as LinkIcon, Send, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { canViewNotifications } from "../../../app/lib/access";
import {
  inactiveReasonTone,
  NotificationInactiveNote,
  useMyTelegramGroups,
  useNotifications,
  type Notification,
  type NotificationGroupType,
} from "../../../entities/notification";
import type { User } from "../../../entities/user/types/user";
import { useMarketGroupLink } from "../../../features/telegram-link";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { Button, Card, ErrorState, Pressable, Skeleton, StatusBadge } from "../../../shared/ui/primitives";
import { useMarketTelegramGroupPiiToggle } from "../model/useMarketTelegramGroupPiiToggle";

const GROUP_TYPES: readonly NotificationGroupType[] = ["create", "cancel"];

/** Tur bo'yicha kalitlar (`users:tgGroup.*`). */
const TYPE_KEYS: Record<NotificationGroupType, { title: string; off: string; aria: string }> = {
  create: { title: "tgGroup.typeCreate", off: "tgGroup.offCreate", aria: "tgGroup.linkCreate" },
  cancel: { title: "tgGroup.typeCancel", off: "tgGroup.offCancel", aria: "tgGroup.linkCancel" },
};

/** `.el-stat-icon` — neytral ikonka qutisi (CODE-MAP). */
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";
const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-3.5 max-md:px-4";
const MUTED = "text-[13px] leading-[18px] text-text-muted";

/** Bir tur holati — ikkala manbadan (`staff`: `GET /notifications`, `self`: `GET /notifications/me/telegram-groups`). */
type GroupState =
  | { kind: "none" }
  | { kind: "active"; since: string | null }
  | { kind: "inactive"; row: Pick<Notification, "is_active" | "inactive_reason" | "inactive_at"> };

export type MarketTelegramGroupsCardProps = {
  /** Market (`role: market`). */
  user: User;
  /**
   * `staff` — superadmin/admin market tafsilotida (`/all-users/:id`, `/new-orders/userDetail/:id`): har tur holati
   * (`GET /notifications?market_id`), ulanmaganida «Ulash», «Barcha guruhlar …» havolasi; oyna ulanishni kuzatadi.
   * `self` — market o'z profilida (`/profile`, TG-C): har tur holati (`GET /notifications/me/telegram-groups`,
   * KJNHAlGW), ulanmaganida «Ulash»; oyna ulanishni shu endpoint bilan kuzatadi.
   */
  mode: "staff" | "self";
};

/**
 * «TELEGRAM GURUHI» kartasi (TG-B; ega javoblari tg-link S1–S5) — maketlar `{superadmin,admin}-users-detail-telegram`,
 * `market-profile`: izoh, har xabar turi qatori («Yangi buyurtmalar guruhi», «Bekor qilinganlar guruhi») va
 * to'g'ridan-to'g'ri «Ulash» (S5) → `MarketGroupLinkDialog`; ostida «Guruhda mijoz ismi va telefoni» kaliti (S3,
 * «Ruxsatlar» kartasidan ko'chdi; tahrir qoidalari `useMarketTelegramGroupPiiToggle`).
 *
 * Holat (ikkala rejimda; market — maket `market-profile-telegram-status`, TG-C): ulangan — «Ulangan» + «{sana} dan»
 * (sana kelmasa — sanasiz); nofaol — «Nofaol» + sabab izohi (`inactive_reason`, G085w5Qr — NG-C: `/notifications`
 * jadvalidagi bilan bir xil matn va ton, sabab noma'lum — umumiy izoh; maket yo'q — eng yaqini
 * `superadmin-notifications-telegram-groups`; faollashtirish «Bildirishnomalar» bo'limida — xodimga «Barcha guruhlar …»
 * havolasi; marketga `inactive_at` kelmaydi — sanasiz); ulanmagan — «Ulanmagan» + nima kelmasligi va «Ulash». Bot
 * mavjud ulanishni almashtirmaydi — ulangan (nofaol ham) turda «Ulash» yo'q. Yuklanishda belgi o'rnida skelet,
 * xatoda qatorlar o'rnida `ErrorState` + «Qayta urinish» (kalit ishlayveradi). «Ulash» oynasi ikkala rejimda
 * ulanishni kuzatadi: guruh ulansa o'zi yopiladi, «Guruh ulandi».
 * Maketdagi «Taklif · holat uchun backend kerak» belgisi chizilmaydi.
 */
export const MarketTelegramGroupsCard = memo(({ user, mode }: MarketTelegramGroupsCardProps) => {
  const { t, i18n } = useTranslation("users");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isStaff = mode === "staff";
  const marketId = String(user.id);
  const showAllGroupsLink = useSelector(canViewNotifications) && isStaff;
  const pii = useMarketTelegramGroupPiiToggle(user, !isStaff);
  const piiLabelId = useId();
  const piiHintId = useId();
  const headingId = useId();
  // Oyna yopilgach fokus shu tur qatoriga: kuzatuvda guruh ulangach «Ulash» yo'qoladi (fokus `<body>` ga tushmasin).
  const createRowRef = useRef<HTMLDivElement>(null);
  const cancelRowRef = useRef<HTMLDivElement>(null);
  const rowRefs = { create: createRowRef, cancel: cancelRowRef } as const;

  const groupsQuery = useNotifications(
    { market_id: marketId, page: 1, limit: 10 },
    { enabled: isStaff, silentError: true },
  );
  const myGroupsQuery = useMyTelegramGroups({ enabled: !isStaff, silentError: true });
  const statusQuery = isStaff ? groupsQuery : myGroupsQuery;
  const link = useMarketGroupLink({
    // Market o'zi — `market_id` siz: server o'z marketini tokendan oladi (havola ham, holat ham).
    marketId: isStaff ? marketId : undefined,
    marketName: user.name,
    watch: true,
    returnFocusRefs: rowRefs,
  });

  const stateOf = (type: NotificationGroupType): GroupState => {
    if (!isStaff) {
      const own = myGroupsQuery.data?.find((row) => row.group_type === type);
      if (!own?.linked) return { kind: "none" };
      return own.is_active
        ? { kind: "active", since: own.linked_at }
        : { kind: "inactive", row: { is_active: false, inactive_reason: own.inactive_reason, inactive_at: null } };
    }
    const rows = (groupsQuery.data?.data ?? []).filter((row) => row.group_type === type);
    const connection = rows.find((row) => row.is_active) ?? rows[0] ?? null;
    if (!connection) return { kind: "none" };
    return connection.is_active
      ? { kind: "active", since: connection.created_at }
      : { kind: "inactive", row: connection };
  };

  const linkButton = (type: NotificationGroupType) => (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={LinkIcon}
      aria-haspopup="dialog"
      aria-label={t(TYPE_KEYS[type].aria)}
      loading={link.pendingType === type}
      disabled={link.pendingType !== null && link.pendingType !== type}
      onClick={() => void link.start(type)}
      className="max-md:h-11 max-md:basis-full max-md:text-sm"
    >
      {t("tgGroup.link")}
    </Button>
  );

  const statusLine = (type: NotificationGroupType) => {
    if (statusQuery.isLoading) return <Skeleton width={120} height={20} />;
    const state = stateOf(type);
    if (state.kind === "none") {
      return (
        <>
          <StatusBadge tone="neutral" label={t("tgGroup.notConnected")} />
          <span className={MUTED}>{t(TYPE_KEYS[type].off)}</span>
        </>
      );
    }
    if (state.kind === "inactive") {
      return (
        <>
          <StatusBadge tone={inactiveReasonTone(state.row.inactive_reason)} label={t("tgGroup.inactive")} />
          <NotificationInactiveNote row={state.row} className={MUTED} />
        </>
      );
    }
    return (
      <>
        <StatusBadge tone="success" label={t("tgGroup.connected")} />
        {toValidDate(state.since) ? (
          <span className={MUTED}>{t("tgGroup.since", { date: formatDateLocalized(state.since, { language }) })}</span>
        ) : null}
      </>
    );
  };

  // Ulash faqat ulanmagan turda (xato yoki yuklanishda — yo'q).
  const canLink = (type: NotificationGroupType) => statusQuery.isSuccess && stateOf(type).kind === "none";

  const rows =
    statusQuery.isError ? (
      <div className="border-b border-border px-5 py-4 max-md:px-4">
        <ErrorState
          size="chart"
          error={statusQuery.error}
          title={t("tgGroup.loadError")}
          description={t("tgGroup.loadErrorText")}
          onRetry={() => void statusQuery.refetch()}
          retrying={statusQuery.isFetching}
          className="min-h-0"
        />
      </div>
    ) : (
      GROUP_TYPES.map((type) => {
        return (
          <div
            key={type}
            ref={rowRefs[type]}
            role="group"
            aria-labelledby={`${headingId}-${type}`}
            tabIndex={-1}
            className={cx(ROW, "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action")}
          >
            <div className="flex min-w-0 flex-[1_1_200px] items-start gap-3">
              <span aria-hidden="true" className={STAT_ICON}>
                <Users size={18} strokeWidth={2} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 id={`${headingId}-${type}`} className="m-0 text-sm font-semibold text-text">
                  {t(TYPE_KEYS[type].title)}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{statusLine(type)}</div>
              </div>
            </div>
            {canLink(type) ? linkButton(type) : null}
          </div>
        );
      })
    );

  return (
    <Card
      as="section"
      title={
        isStaff ? (
          <span className="inline-flex items-center gap-3">
            <span aria-hidden="true" className={STAT_ICON}>
              <Send size={18} strokeWidth={2} />
            </span>
            {t("tgGroup.title")}
          </span>
        ) : (
          t("tgGroup.title")
        )
      }
      divided
      padding="none"
      className="min-w-0"
    >
      <p className={cx(MUTED, "m-0 px-5 pt-3.5 max-md:px-4")}>{t(isStaff ? "tgGroup.hintStaff" : "tgGroup.hintSelf")}</p>
      <div className="mt-1 flex flex-col">
        {rows}
        {showAllGroupsLink ? (
          <div className="border-b border-border px-5 py-3 max-md:px-4">
            <Link
              to="/notifications"
              className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-action-fg hover:underline max-md:min-h-11"
            >
              {t("tgGroup.allGroups")}
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
            </Link>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 max-md:px-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id={piiLabelId} className="text-sm font-semibold text-text">
              {t("tgGroup.piiLabel")}
            </span>
            <span id={piiHintId} className={MUTED}>
              {t("tgGroup.piiHint")}
            </span>
          </div>
          <Pressable
            role="switch"
            aria-checked={pii.checked}
            aria-labelledby={piiLabelId}
            aria-describedby={piiHintId}
            aria-busy={pii.isSaving || undefined}
            disabled={!pii.canEdit || pii.isSaving}
            onClick={() => void pii.toggle()}
            className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed"
          >
            <span
              aria-hidden="true"
              className={cx(
                "relative h-5 w-9 rounded-full transition-colors duration-150 motion-reduce:transition-none group-disabled:opacity-45",
                pii.checked ? "bg-action" : "bg-border-strong",
              )}
            >
              <span
                className={cx(
                  "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 motion-reduce:transition-none",
                  pii.checked && "translate-x-4",
                )}
              />
            </span>
          </Pressable>
        </div>
      </div>
      {link.dialog}
    </Card>
  );
});

MarketTelegramGroupsCard.displayName = "MarketTelegramGroupsCard";
