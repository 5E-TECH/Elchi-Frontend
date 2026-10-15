import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Building,
  CalendarCheck,
  Copy,
  Eye,
  EyeOff,
  Hash,
  Info,
  Mail,
  MapPinned,
  PackageCheck,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { formatMoney } from "../../../shared/config/designSystem";
import { formatTrackingDate } from "../../../features/order-tracking";
import {
  canLookupBranches,
  canLookupUsers,
  readOrderMeta,
  telHref,
  visibleTariffs,
  type TariffField,
} from "../model/orderMeta";
import { useOrderMetaLookups, type PersonContact } from "../model/useOrderMetaLookups";

/**
 * BUYURTMA MA'LUMOTLARI — detal sahifaning O'NG ustunida, Mijozdan yuqorida.
 *
 * "Hozir kimda?", "Kim yetkazyapti, telefoni?", "Qaysi pochtada?", "Bu
 * buyurtmadan qancha?" — ilgari detal sahifa bularga javob bermasdi (yaratilgan
 * sana va aktyorlar faqat tarix timeline'ida bilvosita ko'rinardi).
 *
 * Tarif / ulush ROL bo'yicha va sukut bo'yicha XIRALASHTIRILGAN — ekranni
 * kimgadir ko'rsatganda raqam tasodifan ochilib qolmasin; ko'z tugmasi ochadi.
 */

interface OrderMetaProps {
  /** `GET orders/:id` javobidagi buyurtma (xom). */
  order: unknown;
  role: string | null | undefined;
  /** Joriy foydalanuvchi — kuryer o'z buyurtmasida o'z kontaktini ko'radi. */
  self?: { id?: string | number | null; name?: string | null; phone_number?: string | null } | null;
  /** Pochta (`/mails/:id`) sahifasiga ruxsat bormi — bo'lmasa raqam matn bo'lib qoladi. */
  canOpenMails?: boolean;
}

/**
 * QATOR — yorliq CHAPDA, qiymat O'NGDA, BITTA qatorda.
 *
 * ⚠️ 390px da ham o'ralmaydi va yorliq/qiymat ustma-ust tushmaydi: yorliq
 * qisqarmaydi, qiymat qolgan joyni oladi va sig'masa `…` bilan kesiladi
 * (to'liq matn `title` da). Telefon raqami esa hech qachon kesilmaydi.
 */
const Row = ({
  icon,
  label,
  children,
  testId,
  title,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  testId?: string;
  title?: string;
}) => (
  <div
    className="flex min-h-11 items-center gap-2.5 border-b border-gray-100 py-2 last:border-0 dark:border-white/6"
    data-testid={testId}
  >
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-main/15 text-main">{icon}</div>
    <span className="shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400" data-meta-label>
      {label}
    </span>
    <div
      className="ml-auto flex min-w-0 items-center justify-end gap-2 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-white"
      data-meta-value
      title={title}
    >
      {children}
    </div>
  </div>
);

/** Qisqarishi mumkin bo'lgan matn (nom) — sig'masa `…`. */
const Fit = ({ children }: { children: ReactNode }) => <span className="min-w-0 truncate">{children}</span>;

const PhoneLink = ({ phone }: { phone: string }) => (
  <a href={telHref(phone)} className="shrink-0 font-mono text-xs font-semibold text-main hover:underline">
    {phone}
  </a>
);

const TARIFF_LABEL: Record<TariffField, string> = {
  marketTariff: "metaTariffMarket",
  courierTariff: "metaTariffCourier",
  courierShare: "metaShareCourier",
  branchShare: "metaShareBranch",
};

const OrderMeta = ({ order, role, self, canOpenMails = false }: OrderMetaProps) => {
  const { t } = useTranslation("orders");
  const { api: notify } = useAppNotification();
  const [showTariffs, setShowTariffs] = useState(false);
  const meta = readOrderMeta(order);

  const selfId = self?.id !== null && self?.id !== undefined ? String(self.id) : null;
  const isCourier = (role ?? "").toLowerCase() === "courier";
  const userIds = [meta?.courierId, meta?.holderType === "COURIER" ? meta.holderCourierId : null].filter(
    (value): value is string => Boolean(value) && value !== (isCourier ? selfId : null),
  );
  const holderBranchId =
    meta?.holderType === "BRANCH" && meta.holderBranchId && meta.holderBranchId !== meta.branch?.id
      ? meta.holderBranchId
      : null;
  const { userById, branchNameById } = useOrderMetaLookups({
    userIds,
    branchIds: holderBranchId ? [holderBranchId] : [],
    canUsers: canLookupUsers(role),
    canBranches: canLookupBranches(role),
  });

  if (!meta) return null;

  /** Kuryer kontakti: ruxsat bo'lsa so'ralgan, kuryerning o'zi uchun — profilidan. */
  const contactOf = (courierId: string): PersonContact | null => {
    if (isCourier && selfId === courierId) {
      return { name: self?.name ?? null, phone: self?.phone_number ?? null };
    }
    return userById.get(courierId) ?? null;
  };

  const courier = meta.courierId ? contactOf(meta.courierId) : null;

  const holderText = (() => {
    switch (meta.holderType) {
      case "HQ":
        return t("metaHolderHQ");
      case "MARKET":
        return t("metaHolderMarket");
      case "BRANCH": {
        const name =
          (meta.holderBranchId && meta.holderBranchId === meta.branch?.id ? meta.branch?.name : null) ??
          (meta.holderBranchId ? branchNameById.get(meta.holderBranchId) : null) ??
          (meta.holderBranchId ? `#${meta.holderBranchId}` : "—");
        return t("metaHolderBranch", { name });
      }
      case "COURIER": {
        const name =
          (meta.holderCourierId ? contactOf(meta.holderCourierId)?.name : null) ??
          (meta.holderCourierId ? `#${meta.holderCourierId}` : "—");
        return t("metaHolderCourier", { name });
      }
      default:
        return "—";
    }
  })();

  const tariffFields = visibleTariffs(role);

  const copyId = () => {
    void copyToClipboard(meta.id).then((copied) => {
      if (copied) notify.success({ message: t("orderNumberCopied"), placement: "topRight" });
      else notify.error({ message: t("orderNumberCopyFailed", { id: meta.id }), placement: "topRight" });
    });
  };

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white dark:border-white/8 dark:bg-white/4"
      data-testid="order-meta"
    >
      <div className="space-y-2 p-3.5 sm:p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-main/20 p-2.5 text-main">
            <Info size={16} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("metaTitle")}</p>
        </div>

        <div>
          <Row icon={<Hash size={15} />} label={t("metaId")} testId="meta-id">
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="font-mono">#{meta.id}</span>
              <button
                type="button"
                onClick={copyId}
                aria-label={t("metaCopyId")}
                title={t("metaCopyId")}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-main/10 hover:text-main dark:text-gray-400"
              >
                <Copy size={14} />
              </button>
            </span>
          </Row>

          {meta.soldAt ? (
            <Row icon={<CalendarCheck size={15} />} label={t("metaSoldAt")} testId="meta-sold-at">
              {/* Toshkent vaqti — brauzer zonasidan qat'i nazar (timeline bilan bir xil format). */}
              <span className="font-mono text-xs">{formatTrackingDate(meta.soldAt)}</span>
            </Row>
          ) : null}

          {meta.market?.name || meta.market?.phone ? (
            <Row
              icon={<Store size={15} />}
              label={t("metaMarket")}
              testId="meta-market"
              title={[meta.market.name, meta.market.phone].filter(Boolean).join(" · ")}
            >
              <Fit>{meta.market.name ?? "—"}</Fit>
              {meta.market.phone ? <PhoneLink phone={meta.market.phone} /> : null}
            </Row>
          ) : null}

          {meta.branch?.name ? (
            <Row icon={<Building size={15} />} label={t("metaBranch")} testId="meta-branch" title={meta.branch.name}>
              <Fit>{meta.branch.name}</Fit>
            </Row>
          ) : null}

          {meta.postId ? (
            <Row icon={<Mail size={15} />} label={t("metaPost")} testId="meta-post">
              {canOpenMails ? (
                <Link to={`/mails/${meta.postId}`} className="font-mono text-main hover:underline">
                  #{meta.postId}
                </Link>
              ) : (
                <span className="font-mono">#{meta.postId}</span>
              )}
            </Row>
          ) : null}

          <Row
            icon={<Truck size={15} />}
            label={t("metaCourier")}
            testId="meta-courier"
            title={meta.courierId ? [courier?.name ?? `#${meta.courierId}`, courier?.phone].filter(Boolean).join(" · ") : undefined}
          >
            {meta.courierId ? (
              <>
                <Fit>{courier?.name ?? `#${meta.courierId}`}</Fit>
                {courier?.phone ? <PhoneLink phone={courier.phone} /> : null}
              </>
            ) : (
              <Fit>
                <span className="text-gray-500 dark:text-gray-400">{t("metaCourierNone")}</span>
              </Fit>
            )}
          </Row>

          <Row icon={<PackageCheck size={15} />} label={t("metaHolder")} testId="meta-holder" title={holderText}>
            <Fit>{holderText}</Fit>
          </Row>

          {meta.whereDeliver ? (
            <Row icon={<MapPinned size={15} />} label={t("metaDelivery")} testId="meta-delivery">
              {meta.whereDeliver === "center" ? t("deliveryCenter") : t("deliveryHome")}
            </Row>
          ) : null}
        </div>

        {tariffFields.length > 0 ? (
          <div className="rounded-xl border border-gray-100 p-3 dark:border-white/8" data-testid="meta-tariffs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Wallet size={14} /> {t("metaTariffs")}
              </span>
              <button
                type="button"
                onClick={() => setShowTariffs((value) => !value)}
                aria-pressed={showTariffs}
                aria-label={showTariffs ? t("metaTariffsHide") : t("metaTariffsShow")}
                title={showTariffs ? t("metaTariffsHide") : t("metaTariffsShow")}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-main/10 hover:text-main dark:text-gray-400"
              >
                {showTariffs ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <dl className="m-0 flex flex-col gap-1.5">
              {tariffFields.map((field) => {
                const value = meta.tariffs[field];
                return (
                  <div key={field} className="flex min-w-0 items-center justify-between gap-3" data-tariff={field}>
                    <dt className="shrink-0 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {t(TARIFF_LABEL[field])}
                    </dt>
                    <dd
                      className={`m-0 whitespace-nowrap text-right text-sm font-bold text-gray-900 transition-[filter] dark:text-white ${
                        showTariffs ? "" : "select-none blur-sm"
                      }`}
                      aria-hidden={!showTariffs}
                    >
                      {/* O'lchanmagan qiymat "—", hech qachon 0 emas. */}
                      {value === null ? "—" : `${formatMoney(value)} ${t("currency")}`}
                    </dd>
                    {!showTariffs ? <span className="sr-only">{t("metaTariffsHidden")}</span> : null}
                  </div>
                );
              })}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(OrderMeta);
