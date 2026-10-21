// dizayn-v2: superadmin-users-list, admin-users-list, manager-users-list, superadmin-users-delete-dialog, admin-users-delete-dialog, superadmin-users-list-telegram, admin-users-list-telegram
import { memo, useCallback, useMemo, useState } from "react";
import { ChevronRight, Pencil, Send, Trash2, UserCheck, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import type { User, UserStatus } from "../../../entities/user/types/user";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { useUser } from "../../../entities/user/api/userApi";
// Faqat qoida (barrel emas): ro'yxat havola so'rovlari/oynalarini yuklamasin.
import { canLinkTelegram } from "../../../features/telegram-link/model/canLinkTelegram";
import { UpdateUserModal } from "../../../features/user/update-user/ui/UpdateUserModal";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  ConfirmDialog,
  DataTable,
  useConfirm,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import { UserRowMenu, type UserRowMenuItem } from "./UserRowMenu";

interface UserListTableProps {
  users: readonly User[];
  /**
   * Holat almashtirish, tahrirlash va o'chirish (fix3 RBAC-16). Backend
   * PATCH /users/:id/status va DELETE /users/:id faqat SUPERADMIN/ADMIN
   * ga ruxsat beradi — menejer ko'rardi, lekin har bosishda 403 olardi.
   * Sukut — yashirin (xavfsiz tomon); sahifa rolga qarab yoqadi. Menejerda — «Ochish» (›).
   */
  canManage?: boolean;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi. */
  busy?: boolean;
  /** Jadval yoki kartalar o'rami klassi (karta ichida — `border-t border-border`). */
  className?: string;
}

const STATUS_TONE: Record<UserStatus, Tone> = {
  active: "success",
  inactive: "neutral",
  blocked: "danger",
};

/**
 * Faqat server javobidagi matn (avvalgidek): axios'ning ichki «Request failed with status code 500» /
 * «Network Error» matni foydalanuvchiga chiqmaydi — u holda o'zbekcha zaxira matn.
 */
const serverMessage = (error: unknown) =>
  getBackendErrorMessage({ response: (error as { response?: unknown } | null)?.response });

/** Ismdan bosh harflar (avatar): «Mehr Kosmetika» → «MK». */
const userInitials = (name: string | null | undefined) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

const AVATAR =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-semibold text-text-muted";
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";
const SUB = "text-[13px] text-text-muted";

const userHref = (user: User) => `/all-users/${user.id}`;

/**
 * Shaxsiy Elchi boti ulanishi (`GET /users` → `telegram_linked`, backend `sanitize`): mijoz/investor ulay olmaydi —
 * `unavailable`; maydon kelmasa — `unknown` (ikkalasida «—»).
 */
type TelegramBotState = "linked" | "unlinked" | "unavailable" | "unknown";
const telegramBotState = (user: User): TelegramBotState => {
  if (!canLinkTelegram(user.role)) return "unavailable";
  if (typeof user.telegram_linked !== "boolean") return "unknown";
  return user.telegram_linked ? "linked" : "unlinked";
};

/**
 * FOYDALANUVCHILAR JADVALI — `/all-users` (dizayn v2, `DataTable`; telefonda kartalar).
 *
 * Ustunlar (maket `superadmin-users-list`): Foydalanuvchi (avatar + ism; planshetda ostida telefon) · Telefon
 * (planshetda yashirin) · Rol · Holat · Qo'shilgan (planshetda yashirin) · amallar (kebab: «Tahrirlash»,
 * «Nofaol qilish»/«Faol qilish», «O'chirish»). Menejerda (`manager-users-list`) amallar o'rnida «Ochish» (›).
 * TG-B (`*-users-list-telegram`, ega javobi tg-link S4): superadmin/admin jadvalida «Holat» dan keyin «Telegram boti»
 * (`telegram_linked`: «Ulangan» / «Ulanmagan», `Send` ikonkali belgi; planshetda ham), telefon kartasida «Bot ulangan» /
 * «Bot ulanmagan». «Telegram boti: Barchasi · Ulangan · Ulanmagan» filtri chizilmaydi — backend `telegram_linked`
 * parametri yo'q (yA31z7Rr, TG-D). Menejerda ustun yo'q.
 * «Filial» ustuni chizilmaydi: `GET /users` qatorlarida filial yo'q (backend `findAllAdmins` — faqat `users`
 * jadvali), har qator uchun alohida so'rov esa og'ir — spec §6 ma'lumot bo'shlig'i.
 *
 * Xulq (o'zgarmagan): nofaol qilish — tasdiq oynasi (`useConfirm`), so'ng `updateUserStatus.mutate`, xabarlar
 * va qatordagi kutish; faol qilish — tasdiqsiz; o'chirish — `ConfirmDialog` (maket `*-users-delete-dialog`),
 * so'ng `deleteUser.mutate` + xabarlar. Qator bosilsa — `/all-users/:id`.
 */
export const UserListTable = memo(({ users, canManage = false, busy = false, className }: UserListTableProps) => {
  const { t, i18n } = useTranslation(["users", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const { updateUserStatus, deleteUser } = useUser();
  const confirm = useConfirm();

  // Hozirda holat so'rovi ketayotgan foydalanuvchilar (ikki marta bosilmasin).
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);

  const roleLabel = useCallback((user: User) => t(getUserRoleLabelKey(user.role)), [t]);
  const phone = useCallback((user: User) => formatPhone(user.phone_number), []);
  const joined = useCallback(
    (user: User) => (user.createdAt ? formatDateTimeLocalized(user.createdAt, { language }) : "—"),
    [language],
  );

  const statusBadge = useCallback(
    (user: User) => {
      const status: UserStatus = user.status in STATUS_TONE ? user.status : "inactive";
      return (
        <Badge tone={STATUS_TONE[status]} dot>
          {t(`v2.common.status.${status}`)}
        </Badge>
      );
    },
    [t],
  );

  const telegramBadge = useCallback(
    (user: User, variant: "cell" | "card") => {
      const state = telegramBotState(user);
      if (state === "linked" || state === "unlinked") {
        const key = variant === "card" ? (state === "linked" ? "cardLinked" : "cardUnlinked") : state;
        return (
          <Badge tone={state === "linked" ? "success" : "neutral"} icon={Send}>
            {t(`tgBot.${key}`)}
          </Badge>
        );
      }
      if (variant === "card") return null;
      // Nom `<span>` ga (generic) `aria-label` bilan berilmaydi — o'qilmaydi; ko'rinmas matn yoniga.
      return state === "unavailable" ? (
        <span className="text-text-subtle" title={t("tgBot.unavailable")}>
          <span aria-hidden="true">—</span>
          <span className="sr-only">{t("tgBot.unavailable")}</span>
        </span>
      ) : (
        <span className="text-text-subtle">—</span>
      );
    },
    [t],
  );

  const handleStatusToggle = useCallback(
    async (user: User) => {
      if (loadingIds.has(user.id)) return; // Ikki marta bosilmasin

      const newStatus = user.status === "active" ? "inactive" : "active";

      // Nofaol qilish kirish huquqini oladi — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8, `tizim-feedback`).
      if (newStatus === "inactive") {
        const ok = await confirm({
          tone: "danger",
          title: t("deactivateConfirmTitle"),
          description: t("deactivateConfirmText", { name: user.name }),
          details: (
            <>
              <span className="block font-semibold">{user.name}</span>
              <span className="block text-text-muted">{phone(user)}</span>
            </>
          ),
          confirmLabel: t("deactivateConfirmAction"),
          cancelLabel: t("cancel"),
          icon: UserX,
          confirmIcon: UserX,
        });
        if (!ok) return;
      }

      setLoadingIds((prev) => new Set([...prev, user.id]));

      updateUserStatus.mutate(
        { id: user.id, status: newStatus },
        {
          onSuccess: () => {
            notify.success(t("statusChangeSuccessTitle"), {
              description: t(newStatus === "active" ? "statusActivatedSuccess" : "statusDeactivatedSuccess", {
                name: user.name,
              }),
            });
          },
          onError: (error: unknown) => {
            notify.error(t("statusChangeErrorTitle"), {
              description: serverMessage(error) ?? t("statusChangeErrorDescription"),
            });
          },
          onSettled: () => {
            setLoadingIds((prev) => {
              const next = new Set(prev);
              next.delete(user.id);
              return next;
            });
          },
        },
      );
    },
    [confirm, loadingIds, phone, t, updateUserStatus],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget || deleteUser.isPending) return;

    deleteUser.mutate(deleteTarget.id, {
      onSuccess: () => {
        notify.success(t("deleteSuccessTitle"), {
          description: t("deleteSuccessDescription", { name: deleteTarget.name }),
        });
        setDeleteTarget(null);
      },
      onError: (error: unknown) => {
        notify.error(t("deleteErrorTitle"), {
          description: serverMessage(error) ?? t("deleteErrorDescription"),
        });
      },
    });
  }, [deleteTarget, deleteUser, t]);

  const menuItems = useCallback(
    (user: User): UserRowMenuItem[] => {
      const isActive = user.status === "active";
      return [
        { key: "edit", label: t("v2.list.menu.edit"), icon: Pencil, onSelect: () => setEditTarget(user) },
        {
          key: "status",
          label: t(isActive ? "v2.list.menu.deactivate" : "v2.list.menu.activate"),
          icon: isActive ? UserX : UserCheck,
          disabled: loadingIds.has(user.id),
          onSelect: () => void handleStatusToggle(user),
        },
        {
          key: "delete",
          label: t("v2.list.menu.delete"),
          icon: Trash2,
          danger: true,
          onSelect: () => setDeleteTarget(user),
        },
      ];
    },
    [handleStatusToggle, loadingIds, t],
  );

  const renderActions = useCallback(
    (user: User) =>
      canManage ? (
        <UserRowMenu label={t("v2.list.rowActions", { name: user.name })} items={menuItems(user)} />
      ) : (
        <Link
          to={userHref(user)}
          aria-label={t("v2.list.rowOpen", { name: user.name })}
          title={t("v2.list.rowOpen", { name: user.name })}
          className={ICON_LINK}
        >
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2} />
        </Link>
      ),
    [canManage, menuItems, t],
  );

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        id: "user",
        header: t("v2.list.columns.user"),
        cell: (user) => (
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className={AVATAR}>
              {userInitials(user.name)}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link
                to={userHref(user)}
                className={cx(
                  "font-semibold hover:text-action-fg hover:underline",
                  user.status === "active" ? "text-text" : "text-text-muted",
                )}
              >
                {user.name}
              </Link>
              <span className={cx("hidden whitespace-nowrap max-lg:block", SUB)}>{phone(user)}</span>
            </div>
          </div>
        ),
      },
      {
        id: "phone",
        header: t("v2.list.columns.phone"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: phone,
      },
      {
        id: "role",
        header: t("v2.list.columns.role"),
        cell: (user) => <Badge>{roleLabel(user)}</Badge>,
      },
      { id: "status", header: t("v2.list.columns.status"), cell: statusBadge },
      ...(canManage
        ? [
            {
              id: "telegram",
              header: (
                <abbr title={t("tgBot.columnHint")} className="no-underline">
                  {t("tgBot.column")}
                </abbr>
              ),
              className: "whitespace-nowrap",
              cell: (user: User) => telegramBadge(user, "cell"),
            } satisfies DataTableColumn<User>,
          ]
        : []),
      {
        id: "joined",
        header: t("v2.list.columns.joined"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (user) => <span className="text-text-muted">{joined(user)}</span>,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t(canManage ? "v2.list.columns.actions" : "v2.list.columns.open")}</span>,
        className: "w-16",
        cellClassName: "text-right",
        cell: renderActions,
      },
    ],
    [canManage, joined, phone, renderActions, roleLabel, statusBadge, t, telegramBadge],
  );

  // Telefon kartasi (maket `.el-list-item`): avatar, ism, «telefon», rol + holat, kebab yoki ›.
  const renderCard = useCallback(
    (user: User) => (
      <div className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text">
        <span aria-hidden="true" className={AVATAR}>
          {userInitials(user.name)}
        </span>
        <Link to={userHref(user)} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cx("min-w-0 font-semibold", user.status === "active" ? "text-text" : "text-text-muted")}>
            {user.name}
          </span>
          <span className={SUB}>{phone(user)}</span>
          <span className="flex flex-wrap gap-1.5">
            <Badge>{roleLabel(user)}</Badge>
            {statusBadge(user)}
            {canManage ? telegramBadge(user, "card") : null}
          </span>
        </Link>
        {canManage ? renderActions(user) : <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />}
      </div>
    ),
    [canManage, phone, renderActions, roleLabel, statusBadge, telegramBadge],
  );

  const deletePhone = deleteTarget ? phone(deleteTarget) : "";

  return (
    <>
      <DataTable
        rows={users}
        columns={columns}
        getRowKey={(user) => user.id}
        label={t("v2.list.listLabel")}
        cardsLabel={t("v2.list.cardsLabel")}
        onRowClick={(user) => navigate(userHref(user))}
        renderCard={renderCard}
        busy={busy}
        className={className}
      />

      {canManage ? (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          loading={deleteUser.isPending}
          tone="danger"
          icon={null}
          title={t("deleteUserTitle")}
          description={t("v2.list.deleteDescription", { name: deleteTarget?.name ?? "" })}
          details={
            deleteTarget ? (
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className={cx(AVATAR, "bg-surface")}>
                  {userInitials(deleteTarget.name)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-text">{deleteTarget.name}</span>
                  <span className="text-[13px] text-text-muted">
                    {roleLabel(deleteTarget)} · {deletePhone}
                  </span>
                </span>
              </span>
            ) : null
          }
          note={t("v2.list.deleteNote")}
          confirmLabel={t("v2.list.menu.delete")}
          confirmIcon={Trash2}
          loadingLabel={t("v2.list.deleting")}
          cancelLabel={t("cancel")}
        />
      ) : null}

      {canManage ? (
        <UpdateUserModal
          userId={editTarget?.id ?? null}
          initialUser={editTarget}
          onClose={() => setEditTarget(null)}
        />
      ) : null}
    </>
  );
});

UserListTable.displayName = "UserListTable";
