// dizayn-v2: superadmin-users-edit-role, superadmin-users-edit-role-error
import { useId, useState } from "react";
import { CircleX, Crown, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRoleCatalog } from "../../../../entities/user/api/roleApi";
import { CHANGEABLE_USER_ROLES, isChangeableUserRole } from "../../../../entities/user/lib/changeableRole";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import type { ChangeableUserRole } from "../../../../entities/user/types/user";
import { Button, Field, Select, type SelectOption } from "../../../../shared/ui/primitives";
import { isRetryableRoleChangeError, type RoleChangeErrorKind } from "../model/roleChangeError";
import { CHANGEABLE_ROLE_ICON } from "../model/roleIcons";

export type RoleSectionProps = {
  /** Tanlangan (yangi) rol. */
  value: string;
  onChange: (role: ChangeableUserRole) => void;
  onBlur?: () => void;
  /** Hozirgi rol (serverdagi). */
  originalRole: ChangeableUserRole;
  /** Foydalanuvchi ismi — 409 matnida. */
  userName: string;
  /** Oxirgi urinish xatosi (`PATCH /users/:id/role`); `null` — xato yo'q. */
  error: RoleChangeErrorKind | null;
  /** «Qayta urinish» (faqat `retry` turida). */
  onRetry?: () => void;
  /** Rol so'rovi ketmoqda — «Qayta urinish» yuklanishda. */
  busy?: boolean;
};

/**
 * TAHRIRLASH OYNASIDAGI «ROL» BO'LIMI (FY-2, K3scaE0W) — maketlar `superadmin-users-edit-role` (ro'yxat ochiq:
 * nom + izoh, tanlanganda `Check`), `superadmin-users-role-confirm-dialog` (izohda «O'zgartirildi: A → B · saqlashda
 * tasdiq so'raladi»), `superadmin-users-edit-role-error` (maydon xato holatida + oyna ichidagi ogohlantirish).
 *
 * Faqat superadmin va faqat admin ⇄ menejer ⇄ ro'yxatchi ⇄ logist (ko'rsatish shartini oyna beradi). Variantlar —
 * `GET /roles` → `changeable_roles` (katalog yorliqlari faqat o'zbekcha — nom va izoh i18n'dan). Katalog ro'yxat
 * birinchi ochilganda so'raladi (oyna har ochilganda emas, 30 daqiqa keshda); kelguncha yoki xatoda — zaxira
 * ro'yxat (`CHANGEABLE_USER_ROLES`, backend baribir o'zi tekshiradi). Joriy rol variantlarda doim bor.
 *
 * Xato (`error`): 409 — umumiy matn (filial nomi va havolasi backend kGIjOciz dan keyin, FY-4 —
 * `superadmin-users-edit-role-branch` ham o'sha yerda); 5xx — «Qayta urinish»; vaqt / tarmoq — natija noma'lum,
 * «Qayta urinish»; qolgani — umumiy matn.
 * Backend matni ko'rsatilmaydi (unda texnik yo'l bor).
 */
export const RoleSection = ({
  value,
  onChange,
  onBlur,
  originalRole,
  userName,
  error,
  onRetry,
  busy = false,
}: RoleSectionProps) => {
  const { t } = useTranslation("users");
  const titleId = useId();
  const alertId = useId();
  const [catalogRequested, setCatalogRequested] = useState(false);
  const catalog = useRoleCatalog({ enabled: catalogRequested });

  const allowed = new Set<ChangeableUserRole>(catalog.data?.changeableRoles ?? CHANGEABLE_USER_ROLES);
  allowed.add(originalRole);
  const options: SelectOption<ChangeableUserRole>[] = CHANGEABLE_USER_ROLES.filter((role) => allowed.has(role)).map(
    (role) => ({
      value: role,
      label: t(getUserRoleLabelKey(role)),
      description: t(`v2.role.descriptions.${role}`),
    }),
  );

  const selected = isChangeableUserRole(value) ? value : originalRole;
  const changed = selected !== originalRole;
  const transition = { from: t(getUserRoleLabelKey(originalRole)), to: t(getUserRoleLabelKey(selected)) };
  const hint = changed
    ? t(error ? "v2.role.changedShort" : "v2.role.changed", transition)
    : t("v2.role.hint");

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
          {t("v2.role.section")}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Crown size={14} aria-hidden="true" className="shrink-0" />
          {t("v2.role.superadminOnly")}
        </span>
      </div>

      <Field label={t("v2.role.label")} labelAs="span" hint={hint} invalid={Boolean(error)}>
        <Select<ChangeableUserRole>
          options={options}
          value={selected}
          icon={CHANGEABLE_ROLE_ICON[selected]}
          listLabel={t("v2.role.listLabel")}
          // Xato holatida sababi maydon izohida ham (maket: `aria-describedby="ue-role-alert"`).
          aria-describedby={error ? alertId : undefined}
          onOpenChange={(open) => {
            if (open) setCatalogRequested(true);
          }}
          onChange={(next) => {
            if (next) onChange(next);
          }}
          onBlur={onBlur}
        />
      </Field>

      {error ? (
        <div
          id={alertId}
          role="alert"
          data-testid="role-change-error"
          className="flex min-w-0 items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-fg"
        >
          <CircleX size={18} aria-hidden="true" className="mt-px shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2 text-text">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="font-bold">{t("v2.role.error.title")}</div>
              <div className="text-[13px] leading-[18px] wrap-break-word">
                {t(`v2.role.error.${error}`, { name: userName })}
              </div>
            </div>
            {isRetryableRoleChangeError(error) && onRetry ? (
              <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={busy} onClick={onRetry}>
                {t("v2.role.error.retryAction")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
