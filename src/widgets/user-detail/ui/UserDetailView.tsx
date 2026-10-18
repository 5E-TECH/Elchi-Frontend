// dizayn-v2: superadmin-users-detail, admin-users-detail, manager-users-detail
import { memo, useId, useMemo, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, History, Pencil, Phone, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { OrderStatusBadge } from "../../../entities/order";
import { useUser } from "../../../entities/user/api/userApi";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import type { ExpenseProofCondition, Order, User, UserStatus } from "../../../entities/user/types/user";
import { TransferCourierButton } from "../../../features/courier-transfer-branch";
import { runUserRequest } from "../../../features/user/lib/userRequest";
import { readViewerBranch } from "../../../features/user/lib/viewerBranch";
import { UpdateUserModal } from "../../../features/user/update-user/ui/UpdateUserModal";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import { useMarketTelegramGroupPiiToggle } from "../model/useMarketTelegramGroupPiiToggle";
import { MarketTelegramTokenCard } from "./MarketTelegramTokenCard";

const STATUS_TONE: Record<UserStatus, Tone> = { active: "success", inactive: "neutral", blocked: "danger" };

/** Kalit qatori (`.el-switch`, CODE-MAP 2.2): matn chapda, kalit o'ngda; butun qator bosilmaydi — kalit tugma. */
const SettingSwitch = ({
  title,
  description,
  checked,
  disabled,
  busy,
  onToggle,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle?: () => void;
}) => {
  const descriptionId = useId();
  return (
    <div className="flex min-h-16 items-center gap-4 border-t border-border px-5 py-3 first:border-t-0 max-md:px-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="m-0 text-sm font-semibold text-text">{title}</h3>
        {description ? (
          <p id={descriptionId} className="m-0 text-[13px] text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        disabled={disabled || !onToggle}
        onClick={onToggle}
        className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={cx(
            "relative h-5 w-9 rounded-full transition-colors duration-150 motion-reduce:transition-none group-disabled:opacity-45",
            checked ? "bg-action" : "bg-border-strong",
          )}
        >
          <span
            className={cx(
              "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 motion-reduce:transition-none",
              checked && "translate-x-4",
            )}
          />
        </span>
      </button>
    </div>
  );
};

/** «Aloqa va sanalar» bandi (`.el-stat-icon` + yorliq + qiymat). */
const ContactItem = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
    >
      <Icon size={18} strokeWidth={2} />
    </span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className="font-semibold text-text wrap-break-word">{value}</span>
    </div>
  </div>
);

/** Ta'rif ro'yxati qatori (Tarif, Profil ma'lumotlari): nom chapda, qiymat o'ngda (desktopda ustunda). */
const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 py-1.5 text-sm">
    <dt className="text-text-muted">{label}</dt>
    <dd className="m-0 font-semibold text-text wrap-break-word">{value}</dd>
  </div>
);

export interface UserDetailViewProps {
  user: User;
  /**
   * «← Foydalanuvchilar» havolasi: `/all-users` (sukut) yoki `true` — tarixda orqaga («Orqaga»;
   * `/new-orders/userDetail/:id` route'i — sahifa boshqa bo'limdan ochiladi).
   */
  back?: string | true;
}

/**
 * FOYDALANUVCHI TAFSILOTI — `/all-users/:id` va `/new-orders/userDetail/:id` (dizayn v2).
 *
 * Maketlar: `superadmin-users-detail` / `admin-users-detail` (market: sarlavha + holat, «{Rol} · Login: …»,
 * «Tahrirlash»; «Aloqa va sanalar»; «Ruxsatlar» (darhol saqlanadi) + «Tarif» + «Telegram token»),
 * `superadmin-users-courier-transfer-dialog` (kuryer: «Boshqa filialga o'tkazish», «Ruxsatlar · Qo'shimcha
 * xarajat», «Tarif»), `manager-users-detail` (rol va holat badge'lari, «{filial} · {telefon}», «Profil
 * ma'lumotlari»). «Faoliyat» (Taklif) va menejerdagi «Oylik maosh» kartasi CHIZILMAYDI (spec §6, §9.9).
 * Mijoz (`customer`, maket yo'q — eng yaqini `superadmin-users-detail`): «Aloqa va sanalar» + buyurtmalar jadvali.
 *
 * Xulq `UserDetailWidget` dagidek (u `/profile` uchun muzlatilgan): ruxsat bayroqlari, har kalit mutatsiyasi va
 * xabarlari, kutish holatlari, «Tahrirlash» — `UpdateUserModal`, kuryer o'tkazish — `TransferCourierButton`.
 * Telegram token — faqat superadmin (backend `GET /markets/:id/tg-token` faqat SUPERADMIN; admin uchun token
 * hech qayerda qaytmaydi — karta adminga «token yo'q» deb noto'g'ri gapirmasin).
 */
export const UserDetailView = memo(({ user, back = "/all-users" }: UserDetailViewProps) => {
  const { t, i18n } = useTranslation(["users", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const { updateUser, updateMarketAddOrder, updateMarketExpenseProof, updateMarketCancelledHandoverQr } = useUser();
  const currentRole = useSelector((state: RootState) => state.role.role);
  const viewerBranchName = useSelector((state: RootState) => readViewerBranch(state.user.user).name);

  const canManagePrivilegedToggles = currentRole === "admin" || currentRole === "superadmin";
  const isManagerViewer = currentRole === "manager";
  const isMarket = user.role === "market" || user.role === "marketing";
  const isCourier = user.role === "courier";
  const isCustomer = user.role === "customer";
  const canReceiveExtraCostPermission = user.role === "manager" || user.role === "courier";
  // Per-menejer sotish/bekor qilish ruxsati — faqat menejer rolida ko'rsatiladi.
  const canReceiveSellCancelPermission = user.role === "manager";
  // Admin filial sahifalarini ocha olmaydi — kuryerni o'tkazishning uning uchun yagona kirish joyi shu sahifa.
  const canTransferCourier = isCourier && canManagePrivilegedToggles;
  const canSeeMarketTelegramToken = isMarket && currentRole === "superadmin";
  // ysBqD9Nx: Telegram guruhida mijoz ismi/telefoni — market qatorida; kim o'zgartira olishi hook'da
  // (superadmin/admin — istalgan market, market — faqat o'zi; qolganlar faqat ko'radi).
  const groupPii = useMarketTelegramGroupPiiToggle(user);
  const proofConditions = useMemo(
    () => (Array.isArray(user.expense_proof_conditions) ? user.expense_proof_conditions : []),
    [user.expense_proof_conditions],
  );

  const roleLabel = t(getUserRoleLabelKey(user.role));
  const status: UserStatus = user.status in STATUS_TONE ? user.status : "inactive";
  const money = (value: number | null | undefined) => formatMoneyLocalized(Number(value ?? 0), { language });
  const date = (value: string | null | undefined) => (value ? formatDateLocalized(value, { language }) : "—");
  const phone = formatPhone(user.phone_number);

  // ─── Mutatsiyalar (UserDetailWidget bilan aynan bir xil) ─────────────────
  const editError = t("editUserError");

  const handleToggleExtraCostPermission = async () => {
    if (!canReceiveExtraCostPermission || !canManagePrivilegedToggles) return;
    const nextValue = !user.can_add_extra_cost;
    await runUserRequest({
      t,
      request: () => updateUser.mutateAsync({ id: user.id, data: { can_add_extra_cost: nextValue } }),
      successMessage: nextValue ? t("extraCostPermissionEnabled") : t("extraCostPermissionDisabled"),
      errorMessage: editError,
    });
  };

  const handleToggleSellCancelPermission = async () => {
    if (!canReceiveSellCancelPermission || !canManagePrivilegedToggles) return;
    const nextValue = !user.can_sell_cancel;
    await runUserRequest({
      t,
      request: () => updateUser.mutateAsync({ id: user.id, data: { can_sell_cancel: nextValue } }),
      successMessage: nextValue ? t("sellCancelPermissionEnabled") : t("sellCancelPermissionDisabled"),
      errorMessage: editError,
    });
  };

  const handleToggleMarketAddOrder = async () => {
    if (!isMarket || !canManagePrivilegedToggles) return;
    const nextValue = !user.add_order;
    await runUserRequest({
      t,
      request: () => updateMarketAddOrder.mutateAsync({ id: user.id, add_order: nextValue }),
      successMessage: nextValue
        ? t("marketAddOrderEnabled", { defaultValue: "Market uchun buyurtma qo'shish yoqildi" })
        : t("marketAddOrderDisabled", { defaultValue: "Market uchun buyurtma qo'shish o'chirildi" }),
      errorMessage: editError,
    });
  };

  const handleToggleMarketProof = async (condition: ExpenseProofCondition) => {
    if (!isMarket || !canManagePrivilegedToggles) return;
    const nextConditions = proofConditions.includes(condition)
      ? proofConditions.filter((item) => item !== condition)
      : [...proofConditions, condition];
    await runUserRequest({
      t,
      request: () =>
        updateMarketExpenseProof.mutateAsync({ id: user.id, expense_proof_conditions: nextConditions }),
      successMessage: nextConditions.includes(condition)
        ? t("marketProofEnabled", { defaultValue: "Market uchun rasm/video isbot yoqildi" })
        : t("marketProofDisabled", { defaultValue: "Market uchun rasm/video isbot o'chirildi" }),
      errorMessage: editError,
    });
  };

  const handleToggleMarketCancelledHandoverQr = async () => {
    if (!isMarket || !canManagePrivilegedToggles) return;
    const nextValue = user.cancelled_handover_qr_required === false;
    await runUserRequest({
      t,
      request: () =>
        updateMarketCancelledHandoverQr.mutateAsync({ id: user.id, cancelled_handover_qr_required: nextValue }),
      successMessage: nextValue
        ? t("cancelledHandoverQrEnabled", {
            defaultValue: "Bekor qilingan buyurtmalarni topshirishda market QR talabi yoqildi",
          })
        : t("cancelledHandoverQrDisabled", {
            defaultValue: "Bekor qilingan buyurtmalarni topshirishda market QR talabi o'chirildi",
          }),
      errorMessage: editError,
    });
  };

  // ─── Sarlavha ──────────────────────────────────────────────────────────────
  const description = isManagerViewer
    ? viewerBranchName
      ? t("v2.detail.descriptionBranch", { branch: viewerBranchName, phone })
      : phone
    : user.username && !isCustomer
      ? t("v2.detail.description", { role: roleLabel, login: user.username })
      : t("v2.detail.descriptionNoLogin", { role: roleLabel });

  const headerMeta = (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isManagerViewer ? <Badge>{roleLabel}</Badge> : null}
      <Badge tone={STATUS_TONE[status]} dot>
        {t(`v2.common.status.${status}`)}
      </Badge>
    </span>
  );

  const actions = (
    <>
      {canTransferCourier ? (
        <TransferCourierButton variant="secondary" courierId={user.id} courierName={user.name} />
      ) : null}
      <Button leftIcon={Pencil} onClick={() => setShowEdit(true)}>
        {t("edit")}
      </Button>
    </>
  );

  // ─── Kartalar ──────────────────────────────────────────────────────────────
  const showExtraCost = canReceiveExtraCostPermission && canManagePrivilegedToggles;
  const showSellCancel = canReceiveSellCancelPermission && canManagePrivilegedToggles;
  const permissionsCard =
    isMarket || showExtraCost || showSellCancel ? (
      <Card
        as="section"
        title={t("v2.detail.permissions")}
        actions={<span className="text-[13px] text-text-muted">{t("v2.detail.permissionsHint")}</span>}
        divided
        padding="none"
      >
        {isMarket ? (
          <>
            <SettingSwitch
              title={t("v2.detail.addOrder")}
              description={t("v2.detail.addOrderHint")}
              checked={Boolean(user.add_order)}
              busy={updateMarketAddOrder.isPending}
              disabled={updateMarketAddOrder.isPending}
              onToggle={canManagePrivilegedToggles ? () => void handleToggleMarketAddOrder() : undefined}
            />
            <SettingSwitch
              title={t("v2.detail.handoverQr")}
              description={t("v2.detail.handoverQrHint")}
              checked={user.cancelled_handover_qr_required !== false}
              busy={updateMarketCancelledHandoverQr.isPending}
              disabled={updateMarketCancelledHandoverQr.isPending}
              onToggle={canManagePrivilegedToggles ? () => void handleToggleMarketCancelledHandoverQr() : undefined}
            />
            <SettingSwitch
              title={t("tgGroupPiiLabel")}
              description={t("tgGroupPiiHint")}
              checked={groupPii.checked}
              busy={groupPii.isSaving}
              disabled={groupPii.isSaving}
              onToggle={groupPii.canEdit ? () => void groupPii.toggle() : undefined}
            />
            {canManagePrivilegedToggles ? (
              <>
                <div className="flex flex-col gap-0.5 border-t border-border px-5 pb-1 pt-4 max-md:px-4">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
                    {t("v2.detail.proofTitle")}
                  </h3>
                  <p className="m-0 text-[13px] text-text-muted">{t("v2.detail.proofHint")}</p>
                </div>
                {/* Bo'lim sarlavhasidan keyingi birinchi qatorda chiziq yo'q (maket). */}
                <div>
                  {(
                    [
                      ["sell_any", "sellProof"],
                      ["cancel_any", "cancelProof"],
                      ["sell_extra_cost", "sellExtraProof"],
                      ["cancel_extra_cost", "cancelExtraProof"],
                    ] as const
                  ).map(([condition, key]) => (
                    <SettingSwitch
                      key={condition}
                      title={t(`v2.detail.${key}`)}
                      description={t(`v2.detail.${key}Hint`)}
                      checked={proofConditions.includes(condition)}
                      busy={updateMarketExpenseProof.isPending}
                      disabled={updateMarketExpenseProof.isPending}
                      onToggle={() => void handleToggleMarketProof(condition)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {showExtraCost ? (
          <SettingSwitch
            title={t("v2.detail.extraCost")}
            description={isCourier ? t("v2.detail.extraCostHint") : undefined}
            checked={Boolean(user.can_add_extra_cost)}
            busy={updateUser.isPending}
            disabled={updateUser.isPending}
            onToggle={() => void handleToggleExtraCostPermission()}
          />
        ) : null}
        {showSellCancel ? (
          <SettingSwitch
            title={t("v2.detail.sellCancel")}
            checked={Boolean(user.can_sell_cancel)}
            busy={updateUser.isPending}
            disabled={updateUser.isPending}
            onToggle={() => void handleToggleSellCancelPermission()}
          />
        ) : null}
      </Card>
    ) : null;

  const hasTariffs = user.tariff_home != null || user.tariff_center != null;
  const tariffCard =
    isMarket || isCourier || (user.role === "manager" && hasTariffs) ? (
      <Card as="section" title={t("v2.detail.tariff")} divided>
        <dl className="m-0 flex flex-col">
          {isMarket ? (
            <InfoRow
              label={t("v2.detail.defaultTariff")}
              value={
                <Badge>{t(user.default_tariff === "center" ? "v2.detail.tariffCenter" : "v2.detail.tariffHome")}</Badge>
              }
            />
          ) : null}
          <InfoRow label={t("v2.detail.homeTariff")} value={money(user.tariff_home)} />
          <InfoRow label={t("v2.detail.centerTariff")} value={money(user.tariff_center)} />
        </dl>
      </Card>
    ) : null;

  const paymentDay = Number(user.payment_day);
  const hasPaymentDay = Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31;
  const hasSalary = Number(user.salary ?? 0) > 0;
  const isStaff = user.role === "admin" || user.role === "manager" || user.role === "registrator";
  const profileCard =
    !isCustomer && !isMarket && (isStaff || hasSalary || hasPaymentDay || (isManagerViewer && viewerBranchName)) ? (
      <Card as="section" title={t("v2.detail.profile")} divided>
        <dl className="m-0 flex flex-col">
          {isManagerViewer && viewerBranchName ? (
            <InfoRow label={t("v2.detail.branch")} value={viewerBranchName} />
          ) : null}
          {isStaff || hasSalary ? <InfoRow label={t("v2.detail.salary")} value={money(user.salary)} /> : null}
          {hasPaymentDay ? (
            <InfoRow
              label={t("v2.detail.paymentDay")}
              value={t("v2.detail.paymentDayValue", { day: formatNumberLocalized(paymentDay, { language }) })}
            />
          ) : null}
        </dl>
      </Card>
    ) : null;

  const sideCards = [profileCard, tariffCard, canSeeMarketTelegramToken ? (
    // `key`: boshqa marketga o'tilsa (sahifa qayta o'rnatilmaydi) oldingi marketning tokeni qolmaydi.
    <MarketTelegramTokenCard key={`token-${user.id}`} marketId={String(user.id)} />
  ) : null].filter(Boolean);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        {...(back === true ? { back: true as const } : { back, backLabel: t("v2.common.back") })}
        title={user.name}
        meta={headerMeta}
        description={description}
        actions={actions}
      />

      <Card as="section" aria-label={t("v2.detail.contactLabel")}>
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <ContactItem icon={Phone} label={t("v2.detail.phone")} value={phone} />
          <ContactItem icon={Calendar} label={t("v2.detail.registered")} value={date(user.createdAt)} />
          <ContactItem icon={History} label={t("v2.detail.updated")} value={date(user.updatedAt)} />
        </div>
      </Card>

      {permissionsCard || sideCards.length > 0 ? (
        <div
          className={cx(
            "grid items-start gap-6 max-md:gap-4",
            permissionsCard && sideCards.length > 0 ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : null,
          )}
        >
          {permissionsCard}
          {sideCards.length > 0 ? (
            <div className={cx("flex min-w-0 flex-col gap-6 max-md:gap-4", !permissionsCard && "lg:max-w-[560px]")}>
              {sideCards}
            </div>
          ) : null}
        </div>
      ) : null}

      {isCustomer ? <CustomerOrdersCard orders={user.orders ?? []} onOpen={(order) => navigate(customerOrderHref(order))} /> : null}

      <UpdateUserModal
        userId={showEdit ? user.id : null}
        initialUser={showEdit ? user : null}
        onClose={() => setShowEdit(false)}
      />
    </div>
  );
});

UserDetailView.displayName = "UserDetailView";

/** Mijoz buyurtmasi — tahrirlash sahifasi (avvalgi `CustomerOrdersTable` dagi yo'l). */
const customerOrderHref = (order: Order) => `/new-orders/${order.market_id}/edit/${order.id}`;

/** Mijoz buyurtmalari (maket yo'q — eng yaqini `superadmin-users-detail`; avvalgi `CustomerOrdersTable` o'rnida). */
const CustomerOrdersCard = ({ orders, onOpen }: { orders: readonly Order[]; onOpen: (order: Order) => void }) => {
  const { t, i18n } = useTranslation("users");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const columns: DataTableColumn<Order>[] = [
    {
      id: "order",
      header: t("v2.detail.orderColumns.order"),
      cell: (order) => (
        <>
          {/* Qatorni bosish — sichqoncha uchun; klaviatura uchun qatorda havola (DataTable qoidasi). */}
          <Link
            to={customerOrderHref(order)}
            className="font-semibold text-text hover:text-action-fg hover:underline"
          >
            {t("v2.detail.orderId", { id: order.id })}
          </Link>
          <div className="whitespace-nowrap text-[13px] text-text-muted">
            {order.createdAt ? formatDateTimeLocalized(order.createdAt, { language }) : "—"}
          </div>
        </>
      ),
    },
    {
      id: "products",
      header: t("v2.detail.orderColumns.products"),
      cell: (order) => t("productCount", { count: order.product_quantity }),
    },
    {
      id: "amount",
      header: t("v2.detail.orderColumns.amount"),
      align: "end",
      cell: (order) => (
        <span className="font-semibold text-text">{formatMoneyLocalized(Number(order.total_price ?? 0), { language })}</span>
      ),
    },
    {
      id: "status",
      header: t("v2.detail.orderColumns.status"),
      cell: (order) => <OrderStatusBadge status={order.status} />,
    },
  ];

  return (
    <Card as="section" title={t("v2.detail.orders")} divided padding="none">
      {orders.length === 0 ? (
        <EmptyState title={t("v2.detail.ordersEmpty")} description={t("v2.detail.ordersEmptyDescription")} />
      ) : (
        <DataTable
          rows={orders}
          columns={columns}
          getRowKey={(order) => String(order.id)}
          label={t("v2.detail.ordersLabel")}
          onRowClick={onOpen}
          renderCard={(order) => (
            <button
              type="button"
              onClick={() => onOpen(order)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm text-text"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{t("v2.detail.orderId", { id: order.id })}</span>
                  <span className="whitespace-nowrap font-semibold">
                    {formatMoneyLocalized(Number(order.total_price ?? 0), { language })}
                  </span>
                </span>
                <span className="text-[13px] text-text-muted">
                  {t("productCount", { count: order.product_quantity })} ·{" "}
                  {order.createdAt ? formatDateTimeLocalized(order.createdAt, { language }) : "—"}
                </span>
                <span>
                  <OrderStatusBadge status={order.status} />
                </span>
              </span>
            </button>
          )}
        />
      )}
    </Card>
  );
};
