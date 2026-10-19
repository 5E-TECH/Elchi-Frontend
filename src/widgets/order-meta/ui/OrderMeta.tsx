// dizayn-v2: (maket yo'q) superadmin-orders-detail
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
  Mail,
  MapPinned,
  PackageCheck,
  Store,
  Truck,
} from "lucide-react";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { Card, IconButton } from "../../../shared/ui/primitives";
import { formatTrackingDate } from "../../../features/order-tracking";
import {
  CANCEL_RETURN_STAGES,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  useCancelReturnPlaceText,
} from "../../../entities/order";
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
  /**
   * «Marketga topshirildi» vaqti — tafsilot sahifasi tarixdagi topshirish hodisasidan beradi
   * (`last_handover_at` ni `mark-returned-to-market` yangilamaydi). Berilmasa — vaqtsiz.
   */
  handoverAt?: unknown;
  className?: string;
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
  <div className="flex min-h-11 items-center gap-2.5 border-b border-border py-2 last:border-b-0" data-testid={testId}>
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-sunken text-text-muted">
      {icon}
    </span>
    <span className="shrink-0 whitespace-nowrap text-[13px] text-text-muted" data-meta-label>
      {label}
    </span>
    <div
      className="ml-auto flex min-w-0 items-center justify-end gap-2 whitespace-nowrap text-right text-sm font-semibold text-text"
      data-meta-value
      title={title}
    >
      {children}
    </div>
  </div>
);

/** Qisqarishi mumkin bo'lgan matn (nom) — sig'masa `…`. */
const Fit = ({ children }: { children: ReactNode }) => <span className="min-w-0 truncate">{children}</span>;

/** Telefonda havola nishoni 44px, qator balandligi esa o'zgarmaydi (manfiy vertikal chekka). */
const PHONE_TAP = "max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-end";

/** Telefon — mijoz kartasidagidek formatlangan («+998 88 700 91 13», D-14); havola xom raqam bilan. */
const PhoneLink = ({ phone }: { phone: string }) => (
  <a href={telHref(phone)} className={cx("shrink-0 text-[13px] font-semibold tabular-nums text-action-fg hover:underline", PHONE_TAP)}>
    {formatPhone(phone) || phone}
  </a>
);

const TARIFF_LABEL: Record<TariffField, string> = {
  marketTariff: "metaTariffMarket",
  courierTariff: "metaTariffCourier",
  courierShare: "metaShareCourier",
  branchShare: "metaShareBranch",
};

const OrderMeta = ({ order, role, self, canOpenMails = false, handoverAt, className }: OrderMetaProps) => {
  const { t } = useTranslation("orders");
  const [showTariffs, setShowTariffs] = useState(false);
  const meta = readOrderMeta(order);
  const placeText = useCancelReturnPlaceText();

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

  /** Filial / kuryer nomi (yoki `#id`) — «Hozir kimda» qatori va bekor bosqichi uchun. */
  const holderName = (() => {
    switch (meta.holderType) {
      case "BRANCH":
        return (
          (meta.holderBranchId && meta.holderBranchId === meta.branch?.id ? meta.branch?.name : null) ??
          (meta.holderBranchId ? branchNameById.get(meta.holderBranchId) : null) ??
          (meta.holderBranchId ? `#${meta.holderBranchId}` : null)
        );
      case "COURIER":
        return (
          (meta.holderCourierId ? contactOf(meta.holderCourierId)?.name : null) ??
          (meta.holderCourierId ? `#${meta.holderCourierId}` : null)
        );
      default:
        return null;
    }
  })();

  const holderText = (() => {
    switch (meta.holderType) {
      case "HQ":
        return t("metaHolderHQ");
      case "MARKET":
        return t("metaHolderMarket");
      case "BRANCH":
        return t("metaHolderBranch", { name: holderName ?? "—" });
      case "COURIER":
        return t("metaHolderCourier", { name: holderName ?? "—" });
      default:
        return "—";
    }
  })();

  /**
   * Bekor qilingan buyurtmada «Hozir kimda» bosqich bilan birlashadi (taklif §3.3): «Bekor · HQ'da — Toshkent HQ ·
   * 3 kun», «Marketga topshirildi — Toshkent HQ · Bugun, 11:20». Joy nomi bo'lmasa — yuqoridagi filial / kuryer
   * nomi, u ham bo'lmasa faqat bosqich.
   */
  const stage = resolveCancelReturnStage(order);
  const holderValue = (() => {
    if (!stage) return holderText;
    const label = t(CANCEL_RETURN_STAGES[stage].labelKey, { ns: "status" });
    const place = placeText(resolveCancelReturnPlace(order, stage, { handoverAt }));
    const fallbackName = stage === "branch" || stage === "courier" ? holderName : null;
    const where = [place?.name ?? fallbackName, place?.extra].filter(Boolean).join(" · ");
    return where ? t("metaHolderStage", { stage: label, place: where }) : label;
  })();

  const tariffFields = visibleTariffs(role);

  const copyId = () => {
    void copyToClipboard(meta.id).then((copied) => {
      if (copied) notify.success(t("orderNumberCopied"));
      else notify.error(t("orderNumberCopyFailed", { id: meta.id }));
    });
  };

  return (
    <Card
      title={t("metaTitle")}
      data-testid="order-meta"
      className={className}
      padding="none"
      bodyClassName="flex flex-col gap-3 px-5 py-2"
    >
      <div>
        <Row icon={<Hash size={15} aria-hidden="true" />} label={t("metaId")} testId="meta-id">
          <span className="inline-flex shrink-0 items-center gap-1">
            <span className="tabular-nums">#{meta.id}</span>
            {/* Telefonda 44px nishon, lekin qator balandligi (bir qator) o'zgarmaydi — manfiy chekka. */}
            <IconButton
              size="sm"
              icon={Copy}
              label={t("metaCopyId")}
              onClick={copyId}
              className="-my-1 max-md:-my-2.5"
            />
          </span>
        </Row>

        {meta.soldAt ? (
          <Row icon={<CalendarCheck size={15} aria-hidden="true" />} label={t("metaSoldAt")} testId="meta-sold-at">
            {/* Toshkent vaqti — brauzer zonasidan qat'i nazar (soniyagacha). */}
            <span className="text-[13px] tabular-nums">{formatTrackingDate(meta.soldAt)}</span>
          </Row>
        ) : null}

        {meta.market?.name || meta.market?.phone ? (
          <Row
            icon={<Store size={15} aria-hidden="true" />}
            label={t("metaMarket")}
            testId="meta-market"
            title={[meta.market.name, meta.market.phone ? formatPhone(meta.market.phone) || meta.market.phone : null]
              .filter(Boolean)
              .join(" · ")}
          >
            <Fit>{meta.market.name ?? "—"}</Fit>
            {meta.market.phone ? <PhoneLink phone={meta.market.phone} /> : null}
          </Row>
        ) : null}

        {meta.branch?.name ? (
          <Row
            icon={<Building size={15} aria-hidden="true" />}
            label={t("metaBranch")}
            testId="meta-branch"
            title={meta.branch.name}
          >
            <Fit>{meta.branch.name}</Fit>
          </Row>
        ) : null}

        {meta.postId ? (
          <Row icon={<Mail size={15} aria-hidden="true" />} label={t("metaPost")} testId="meta-post">
            {canOpenMails ? (
              <Link to={`/mails/${meta.postId}`} className={cx("tabular-nums text-action-fg hover:underline", PHONE_TAP)}>
                #{meta.postId}
              </Link>
            ) : (
              <span className="tabular-nums">#{meta.postId}</span>
            )}
          </Row>
        ) : null}

        <Row
          icon={<Truck size={15} aria-hidden="true" />}
          label={t("metaCourier")}
          testId="meta-courier"
          title={
            meta.courierId
              ? [courier?.name ?? `#${meta.courierId}`, courier?.phone ? formatPhone(courier.phone) || courier.phone : null]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
        >
          {meta.courierId ? (
            <>
              <Fit>{courier?.name ?? `#${meta.courierId}`}</Fit>
              {courier?.phone ? <PhoneLink phone={courier.phone} /> : null}
            </>
          ) : (
            <Fit>
              <span className="font-normal text-text-muted">{t("metaCourierNone")}</span>
            </Fit>
          )}
        </Row>

        <Row icon={<PackageCheck size={15} aria-hidden="true" />} label={t("metaHolder")} testId="meta-holder" title={holderValue}>
          {stage ? (
            // Bosqich + joy + vaqt uzun: telefonda kesilmasin — 2 qatorgacha o'raladi (`title` sensorda yordam bermaydi).
            <span className="line-clamp-2 min-w-0 whitespace-normal">{holderValue}</span>
          ) : (
            <Fit>{holderValue}</Fit>
          )}
        </Row>

        {meta.whereDeliver ? (
          <Row icon={<MapPinned size={15} aria-hidden="true" />} label={t("metaDelivery")} testId="meta-delivery">
            {/* Sahifadagi «Yetkazish turi» bilan bir xil yorliq: «Uygacha» / «Markazgacha». */}
            {meta.whereDeliver === "center" ? t("deliveryToCenter") : t("deliveryToHome")}
          </Row>
        ) : null}
      </div>

      {tariffFields.length > 0 ? (
        <div className="mb-3 rounded-xl bg-sunken px-3 py-2.5" data-testid="meta-tariffs">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("metaTariffs")}</span>
            <IconButton
              size="sm"
              icon={showTariffs ? EyeOff : Eye}
              label={showTariffs ? t("metaTariffsHide") : t("metaTariffsShow")}
              aria-pressed={showTariffs}
              onClick={() => setShowTariffs((value) => !value)}
              className="-my-1 -mr-1.5"
            />
          </div>
          <dl className="m-0 flex flex-col gap-1.5">
            {tariffFields.map((field) => {
              const value = meta.tariffs[field];
              return (
                <div key={field} className="flex min-w-0 items-center justify-between gap-3" data-tariff={field}>
                  <dt className="shrink-0 whitespace-nowrap text-[13px] text-text-muted">{t(TARIFF_LABEL[field])}</dt>
                  <dd
                    className={cx(
                      "m-0 whitespace-nowrap text-right text-sm font-bold text-text transition-[filter] duration-150 motion-reduce:transition-none",
                      !showTariffs && "select-none blur-sm",
                    )}
                    aria-hidden={!showTariffs}
                  >
                    {/* O'lchanmagan qiymat "—", hech qachon 0 emas. */}
                    {value === null ? "—" : formatMoneyLocalized(value)}
                  </dd>
                  {!showTariffs ? <span className="sr-only">{t("metaTariffsHidden")}</span> : null}
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}
    </Card>
  );
};

export default memo(OrderMeta);
