// dizayn-v2: superadmin-integrations-carrier-console, superadmin-integrations-carrier-create-dialog, superadmin-integrations-carrier-rotate-dialog, superadmin-integrations-carrier-status-dialog, admin-integrations-carrier-console, admin-integrations-carrier-create-dialog, admin-integrations-carrier-rotate-dialog, admin-integrations-carrier-status-dialog
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleX, Info, PackageCheck, User, type LucideIcon } from "lucide-react";
import type { CarrierAccount } from "../../../entities/integrations/carriers";
import { cx } from "../../../shared/lib/cx";
import { StatusBadge, type Tone } from "../../../shared/ui/primitives";
import {
  STATE_LABEL,
  STATE_TONE,
  isCourierActive,
  type CarrierAccountState,
  type CarrierCourier,
  type CourierInfo,
} from "./carrierModel";
import { courierSubline, useCourierName } from "./carrierFormat";

/**
 * Tashqi yetkazuvchi oynalari va tafsilotining umumiy bo'laklari (maket `*-carrier-*-dialog`):
 * akkaunt / kuryer kartasi (`sunken` quti), «Darhol to'xtaydi» / «O'zgarmaydi» ro'yxatlari, kulrang izoh.
 */

export const CarrierStateBadge = ({ state }: { state: CarrierAccountState }) => {
  const { t } = useTranslation("integrations");
  return <StatusBadge tone={STATE_TONE[state]} label={t(STATE_LABEL[state])} />;
};

export const CourierStatusBadge = ({ courier }: { courier: CarrierCourier }) => {
  const { t } = useTranslation("integrations");
  const active = isCourierActive(courier);
  return (
    <StatusBadge
      tone={active ? "success" : "neutral"}
      label={t(active ? "carrier.courierState.active" : "carrier.courierState.inactive")}
    />
  );
};

/** `sunken` quti: ikonka (akkaunt — `PackageCheck`, kuryer — `User`) + sarlavha + izoh + o'ngda belgi. */
export const SummaryBox = ({
  icon: Icon = PackageCheck,
  title,
  subtitle,
  badge,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5">
    <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface text-text-muted">
      <Icon size={18} aria-hidden="true" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{title}</span>
      {subtitle ? (
        <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{subtitle}</span>
      ) : null}
    </span>
    {badge}
  </div>
);

/** Akkaunt kartasi (tasdiq oynalari): «FastPost Logistics» + «Kuryer: FastPost kuryeri · Toshkent HQ». */
export const AccountSummary = ({
  account,
  info,
  badge,
}: {
  account: CarrierAccount;
  info: CourierInfo | undefined;
  badge?: ReactNode;
}) => {
  const { t } = useTranslation("integrations");
  const courierName = useCourierName()(account, info);
  const branch = info?.state === "ready" ? info.courier.branch?.name : undefined;
  return (
    <SummaryBox
      title={account.name}
      subtitle={[t("carrier.rotate.courierLine", { courier: courierName }), branch]
        .filter(Boolean)
        .join(" · ")}
      badge={badge}
    />
  );
};

/** Kuryer kartasi (rad javobi oynalari, maket `User` ikonkasi bilan): ism + telefon · filial + «Nofaol». */
export const CourierSummary = ({
  account,
  info,
}: {
  account: CarrierAccount;
  info: CourierInfo | undefined;
}) => {
  const { t } = useTranslation("integrations");
  if (info?.state === "ready") {
    return (
      <SummaryBox
        icon={User}
        title={info.courier.name || t("carrier.courierIdOnly", { id: account.courier_user_id })}
        subtitle={courierSubline(info.courier)}
        badge={<CourierStatusBadge courier={info.courier} />}
      />
    );
  }
  return (
    <SummaryBox
      icon={User}
      title={t("carrier.courierIdOnly", { id: account.courier_user_id })}
      badge={
        info?.state === "missing" ? (
          <StatusBadge tone="danger" label={t("carrier.state.courierMissing")} />
        ) : undefined
      }
    />
  );
};

/** Ustki yozuv + belgili ro'yxat («Darhol to'xtaydi», «O'zgarmaydi»). */
export const MarkedList = ({
  title,
  tone,
  items,
}: {
  title: ReactNode;
  tone: Extract<Tone, "success" | "danger">;
  items: ReactNode[];
}) => {
  const Icon = tone === "success" ? CircleCheck : CircleX;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">
        {title}
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
            <Icon
              size={16}
              aria-hidden="true"
              className={cx(
                "mt-px flex-none",
                tone === "success" ? "text-success-fg" : "text-danger-fg",
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Kulrang izoh `Info` bilan. */
export const MutedNote = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
    <Info size={16} aria-hidden="true" className="mt-px flex-none" />
    <span>{children}</span>
  </p>
);

/** Raqamli qadamlar (bo'sh holat, «Javob kelmadi»). */
export const NumberedSteps = ({ steps, className }: { steps: ReactNode[]; className?: string }) => (
  <ol className={cx("flex flex-col gap-2.5", className)}>
    {steps.map((step, index) => (
      <li
        key={index}
        className="flex items-start gap-2.5 text-left text-[13px] leading-[18px] text-text"
      >
        <span className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-action-soft text-xs font-bold text-action-fg">
          {index + 1}
        </span>
        <span className="min-w-0">{step}</span>
      </li>
    ))}
  </ol>
);
