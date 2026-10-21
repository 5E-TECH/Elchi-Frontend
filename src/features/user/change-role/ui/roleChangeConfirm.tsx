// dizayn-v2: superadmin-users-role-confirm-dialog, superadmin-users-role-confirm-logist
import { ArrowRight, Building2, Check, LogOut, Map as MapIcon, ScrollText, UserCog, type LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import type { ChangeableUserRole } from "../../../../entities/user/types/user";
import { Badge, type ConfirmOptions } from "../../../../shared/ui/primitives";
import { CHANGEABLE_ROLE_ICON } from "../model/roleIcons";

/** Tasdiq oynasida nomi bilan ko'rsatiladigan viloyatlar soni; qolgani — «va yana N ta». */
export const RELEASED_REGION_NAMES_LIMIT = 6;

/** Ismdan bosh harflar (avatar): «Nilufar Rashidova» → «NR». */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

export type RoleChangeConfirmInput = {
  t: TFunction;
  name: string;
  from: ChangeableUserRole;
  to: ChangeableUserRole;
  /**
   * Logistdan chiqishda bo'shaydigan viloyatlar: nomlar (bo'sh massiv — viloyati yo'q, qator chiqmaydi), `null` —
   * yuklab bo'lmadi (nomlarsiz umumiy qator). Logist bo'lmasa e'tiborga olinmaydi.
   */
  releasedRegions?: readonly string[] | null;
};

const regionsText = (t: TFunction, names: readonly string[]): string => {
  const shown = names.slice(0, RELEASED_REGION_NAMES_LIMIT).join(", ");
  const rest = names.length - RELEASED_REGION_NAMES_LIMIT;
  const list = rest > 0 ? t("v2.role.confirm.regionsMore", { names: shown, n: rest }) : shown;
  return t("v2.role.confirm.regions", { n: names.length, names: list });
};

/**
 * ROLNI O'ZGARTIRISH TASDIG'I (FY-2) — maketlar `superadmin-users-role-confirm-dialog` (Admin → Menejer) va
 * `superadmin-users-role-confirm-logist` (Logist → Admin): sarlavha «Rolni o'zgartirasizmi?», izoh «{ism} endi
 * {rol} sifatida ishlaydi.», ob'ekt kartasi (avatar, ism, eski → yangi rol belgisi), «O'zgargandan keyin»:
 * logist viloyatlari bo'shatiladi (faqat logistdan), sessiya yopiladi (backend `refresh_token` ni o'chiradi),
 * menejerni filialga biriktirish (faqat menejerga), jurnal. Tugma «Rolni o'zgartirish».
 *
 * `useConfirm()` ga beriladi; so'rov oynadan keyin (xato — tahrirlash oynasining o'zida, maket
 * `superadmin-users-edit-role-error`).
 */
export const buildRoleChangeConfirm = ({
  t,
  name,
  from,
  to,
  releasedRegions,
}: RoleChangeConfirmInput): ConfirmOptions => {
  const fromLabel = t(getUserRoleLabelKey(from));
  const toLabel = t(getUserRoleLabelKey(to));
  const fromLogist = from === "logist";

  const items: { icon: LucideIcon; text: string }[] = [];
  if (fromLogist) {
    if (!releasedRegions) items.push({ icon: MapIcon, text: t("v2.role.confirm.regionsUnknown") });
    else if (releasedRegions.length > 0) items.push({ icon: MapIcon, text: regionsText(t, releasedRegions) });
  }
  items.push({ icon: LogOut, text: t("v2.role.confirm.session") });
  if (to === "manager") items.push({ icon: Building2, text: t("v2.role.confirm.managerBranch") });
  items.push({ icon: ScrollText, text: t(fromLogist ? "v2.role.confirm.journalLogist" : "v2.role.confirm.journal") });

  return {
    title: t("v2.role.confirm.title"),
    description: t("v2.role.confirm.description", { name, role: t(`v2.role.as.${to}`) }),
    confirmLabel: t("v2.role.confirm.action"),
    cancelLabel: t("cancel"),
    tone: "primary",
    icon: UserCog,
    confirmIcon: Check,
    size: "md",
    details: (
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] font-bold text-text-muted"
        >
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-[1_1_160px] flex-col gap-1.5">
          <span className="font-semibold [overflow-wrap:anywhere] text-text">{name}</span>
          <span
            className="inline-flex flex-wrap items-center gap-2"
            aria-label={t("v2.role.confirm.transition", { from: fromLabel, to: toLabel })}
            role="img"
          >
            <Badge icon={CHANGEABLE_ROLE_ICON[from]}>{fromLabel}</Badge>
            <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
            <Badge icon={CHANGEABLE_ROLE_ICON[to]}>{toLabel}</Badge>
          </span>
        </span>
      </div>
    ),
    children: (
      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
          {t("v2.role.confirm.after")}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {items.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-[13px] text-text">
              <Icon size={16} aria-hidden="true" className="mt-px shrink-0 text-text-muted" />
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  };
};
