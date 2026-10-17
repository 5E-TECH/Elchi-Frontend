// dizayn-v2: common-profile, common-profile-password-dialog
import { useMemo } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  ClipboardPenLine,
  Clock,
  Crown,
  Headset,
  History,
  Lock,
  Phone,
  Store,
  Truck,
  User as UserIcon,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { User } from "../../../entities/user/types/user";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge, Button, Card, type Tone } from "../../../shared/ui/primitives";
import { profileInitials, readProfileBranchName } from "../lib/profileView";
import { calcEarnedSalary, calcSalaryCycle, toPaymentDay } from "../lib/salaryCycle";

/**
 * PROFIL KARTALARI — maket `common-profile` (dizayn v2).
 *
 *  - `ProfileInfoCard` — avatar (bosh harflar), ism, «Login: …» (login bo'lmasa qator yo'q), rol va holat
 *    badge'lari; pastda 4 ta ma'lumot: Telefon · Filial (biriktirilmagan bo'lsa yo'q) · Ro'yxatdan o'tgan ·
 *    Yangilangan (telefonda ustma-ust).
 *  - `ProfileSalaryCard` — «Oylik maosh»: davr, to'plangan / maosh, foiz, progress, o'tgan va qolgan kunlar.
 *    Faqat maoshli xodim rollarida (eski `UserStatsCard` qoidasi: admin, menejer, ro'yxatchi, superadmin
 *    va `salary > 0`).
 *  - `ProfileSecurityCard` — «Xavfsizlik»: parol izohi va «Parolni o'zgartirish».
 */

/** Rol belgisi ikonkasi — `design/icon-registry.json` «Odamlar va tashkilot». */
const ROLE_ICON: Record<string, LucideIcon> = {
  superadmin: Crown,
  admin: UserCog,
  manager: Briefcase,
  registrator: ClipboardPenLine,
  operator: Headset,
  courier: Truck,
  market: Store,
  marketing: Store,
  customer: UserIcon,
};

const STATUS_VIEW: Record<string, { key: string; tone: Tone }> = {
  active: { key: "statusActive", tone: "success" },
  inactive: { key: "statusInactive", tone: "neutral" },
  blocked: { key: "statusBlocked", tone: "danger" },
};

/** `.el-stat-icon` — neytral ikonka qutisi (CODE-MAP). */
const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden="true" className={STAT_ICON}>
      <Icon size={18} />
    </span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className="truncate text-sm font-semibold text-text">{value}</span>
    </div>
  </div>
);

export const ProfileInfoCard = ({ user }: { user: User }) => {
  const { t } = useTranslation(["profile", "users"]);
  const RoleIcon = ROLE_ICON[String(user.role)] ?? UserIcon;
  const status = STATUS_VIEW[String(user.status)];
  const branchName = readProfileBranchName(user);
  const username =
    typeof user.username === "string" && user.username.trim() ? user.username.trim() : null;
  const createdAt = formatDateLocalized(user.createdAt);
  const updatedAt = formatDateLocalized(user.updatedAt);

  return (
    <Card padding="none" aria-label={user.name}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 px-5 py-6 max-md:px-4">
        <span
          aria-hidden="true"
          className="inline-flex size-16 shrink-0 select-none items-center justify-center rounded-full bg-avatar text-base font-bold text-on-avatar"
        >
          {profileInitials(user.name)}
        </span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-bold wrap-break-word text-text">{user.name}</h2>
            {username ? (
              <p className="text-[13px] text-text-muted">{t("profile:login", { username })}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge icon={RoleIcon}>{t(`users:${getUserRoleLabelKey(user.role)}`)}</Badge>
            {status ? (
              <Badge tone={status.tone} dot>
                {t(`users:${status.key}`)}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-x-4 gap-y-5 border-t border-border px-5 py-5 max-md:px-4">
        <InfoItem
          icon={Phone}
          label={t("profile:info.phone")}
          value={formatPhone(user.phone_number)}
        />
        {branchName ? (
          <InfoItem icon={Building2} label={t("profile:info.branch")} value={branchName} />
        ) : null}
        <InfoItem icon={Calendar} label={t("profile:info.createdAt")} value={createdAt} />
        <InfoItem icon={History} label={t("profile:info.updatedAt")} value={updatedAt} />
      </div>
    </Card>
  );
};

export const ProfileSalaryCard = ({ user, className }: { user: User; className?: string }) => {
  const { t } = useTranslation("profile");
  const salary = Number(user.salary ?? 0);
  // Davr sahifa ochilgan paytga hisoblanadi (eski kartadagidek har renderda emas).
  const cycle = useMemo(() => calcSalaryCycle(toPaymentDay(user.payment_day)), [user.payment_day]);
  const earned = calcEarnedSalary(salary, cycle.progress);
  const percent = Math.round(cycle.progress);

  return (
    <Card
      className={className}
      title={t("salary.title")}
      actions={
        <span className="whitespace-nowrap text-[13px] text-text-muted">
          {formatDateLocalized(cycle.start)} – {formatDateLocalized(cycle.end)}
        </span>
      }
      bodyClassName="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-text-muted">
            {t("salary.accumulated")}
          </span>
          <span className="text-[28px] leading-9 font-bold tracking-[-.01em] text-text">
            {formatNumberLocalized(earned)}
            <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
              / {formatMoneyLocalized(salary)}
            </span>
          </span>
        </div>
        <span className="text-base font-bold text-text">{formatPercentLocalized(percent)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t("salary.progressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-sunken"
      >
        {/* Eni — hisoblangan foiz (CODE-MAP `.el-progress`: `style={{ width }}`). */}
        <span className="block h-full rounded-full bg-action" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-[13px] text-text-muted max-md:flex-col">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={16} aria-hidden="true" className="shrink-0" />
          {t("salary.passed", { passed: cycle.passedDays, total: cycle.totalDays })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={16} aria-hidden="true" className="shrink-0" />
          <span>
            <Trans
              t={t}
              i18nKey="salary.remaining"
              values={{
                count: Math.max(cycle.remainDays, 0),
                date: formatDateLocalized(cycle.end),
              }}
              components={{ b: <span className="font-semibold text-text" /> }}
            />
          </span>
        </span>
      </div>
    </Card>
  );
};

export const ProfileSecurityCard = ({
  onChangePassword,
  className,
}: {
  onChangePassword: () => void;
  className?: string;
}) => {
  const { t } = useTranslation("profile");
  return (
    <Card
      className={cx("flex flex-col", className)}
      title={t("security.title")}
      bodyClassName="flex flex-1 flex-wrap content-between items-center justify-between gap-4"
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
        <span aria-hidden="true" className={STAT_ICON}>
          <Lock size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-text">{t("security.password")}</span>
          <p className="text-[13px] text-text-muted">{t("security.passwordHint")}</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onChangePassword} className="max-md:w-full">
        {t("security.changePassword")}
      </Button>
    </Card>
  );
};
