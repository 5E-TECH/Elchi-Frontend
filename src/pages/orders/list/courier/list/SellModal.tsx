// dizayn-v2: courier-orders-sell-dialog, courier-orders-sell-partial-dialog, courier-orders-sell-extra-cost-dialog, manager-orders-sell-dialog
import { memo, useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, CircleCheck, Info, LoaderCircle, Minus, PackageCheck, Plus, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getOrderItemName } from "../../../../../shared/lib/orderItemName";
import { useFocusTrap } from "../../../../../shared/lib/useFocusTrap";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../../shared/lib/formatMoney";
import {
  getActivePendingApproval,
  usePendingExtraCostApprovals,
} from "../../../../../entities/orders/extraCostApproval";
import {
  ExtraCostNoticeAlert,
  ExtraCostPendingAlert,
  ExtraCostSentAlert,
} from "../../../../../entities/orders/ui/ExtraCostApprovalAlerts";
import {
  isProofRequiredByConditions,
  toKnownAmount,
} from "../../../../../entities/orders/proofRequirement";
import { getMarketPaidMax, type SellOrderPayload } from "../../../../../entities/orders/sellPayment";

/**
 * SOTISH / QISMAN SOTISH — kuryer, menejer va buyurtma tafsilotida bitta oyna.
 *
 * To'liq sotishda «Marketga to'langan summa» (uguUEhin): kuryer mijozdan
 * olgan puldan marketga o'zi bergan qism. Faqat 0 dan katta bo'lsa
 * yuboriladi; hamkor (`external_id`) buyurtmasida ko'rsatilmaydi.
 *
 * Maket: `courier-orders-sell-dialog` (+ `-partial-`, `-extra-cost-`).
 * «Marketga to'langan summa» maketda yo'q — summa maydoni naqshida.
 */

type OrderItem = {
  id: string;
  quantity: number;
  /**
   * Katalogdagi mahsulot. Ro'yxat javoblari har xil keladi: kuryer ro'yxatida
   * `product` obyekti bor, admin ro'yxatida faqat `product_id`, hamkor
   * (BeePost) posilkalarida esa ikkalasi ham `null` — nom `product_name` da.
   */
  product?: { name?: string | null; image_url?: string | null; id?: string | null } | null;
  product_id?: string | null;
  product_name?: string | null;
};

/**
 * Katalog mahsuloti id'si (katalogsiz hamkor qatorida — `null`). Qisman
 * sotishda qator `order_item_id` bilan yuboriladi; `product_id` katalog
 * qatorlarida qo'shimcha yuboriladi. Ilgari bu yerda `?? item.id` (buyurtma
 * QATORI id'si) zaxirasi bor edi — `product_id` o'rnida ketib, rad etilardi.
 */
const getCatalogProductId = (item: OrderItem): string | null => {
  const id = item.product?.id ?? item.product_id;
  return id ? String(id) : null;
};

const getItemName = (item: OrderItem, index: number): string =>
  getOrderItemName(item, `#${index + 1}`);

type Order = {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  where_deliver: string;
  product_quantity: number;
  market: { name: string; expense_proof_conditions?: string[] | null };
  customer: { name: string; phone_number: string };
  district: { name: string };
  region: { name: string };
  items: OrderItem[];
  sell_requires_media?: boolean;
  cancel_requires_media?: boolean;
  /** Marketga to'lanishi kerak bo'lgan summa — «Marketga to'langan summa» chegarasi uchun. */
  to_be_paid?: number | string | null;
  /** Hamkor (BeePost/API) buyurtmasi — marketga to'lov maydoni ko'rsatilmaydi. */
  external_id?: string | number | null;
};

type PartlySellPayload = {
  order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
  totalPrice: number;
  extraCost: number;
  comment: string;
  proof?: File;
};

type SellModalProps = {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSell: (orderId: string, payload: SellOrderPayload) => void;
  onPartlySell: (orderId: string, payload: PartlySellPayload) => void;
  isLoading?: boolean;
  /** Yuborilgan amal market tasdig'iga tushdi — forma o'rniga holat ko'rsatiladi. */
  awaitingApproval?: boolean;
  /**
   * Kuryer sotuvi: qo'shimcha xarajat FAQAT markazga yetkazishda yoziladi —
   * backend uyga yetkazishda 400 qaytaradi ("uy tarifi allaqachon yuqori").
   * Menejerda bu cheklov yo'q, shuning uchun faqat kuryer sahifasi yoqadi.
   */
  restrictExtraCostToCenter?: boolean;
};

const sanitizeAmountInput = (value: string) => value.replace(/\D/g, "");
const MAX_PROOF_SIZE_MB = 10;
const MAX_PROOF_SIZE_BYTES = MAX_PROOF_SIZE_MB * 1024 * 1024;

// CODE-MAP retseptlari (BTN, INPUT).
const BTN =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11";
const BTN_SECONDARY = `${BTN} border-border-strong bg-surface text-text hover:bg-sunken`;
const BTN_SUCCESS = `${BTN} border-transparent bg-success text-on-solid hover:brightness-110`;
const INPUT =
  "h-10 w-full rounded-[10px] border border-border-strong bg-input px-3 text-base text-text placeholder:text-text-subtle hover:border-text-subtle focus:border-action focus:outline-none focus:ring-3 focus:ring-focus disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-subtle aria-[invalid=true]:border-danger max-md:min-h-11 md:text-sm";
const LABEL = "text-[13px] font-semibold text-text";
const ICON_BTN =
  "inline-flex size-8 flex-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-muted transition-colors hover:bg-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-45 max-md:size-11";

const initials = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

/** Summa maydoni: raqamlar mingliklar bilan, o'ngda valyuta. */
const AmountInput = ({
  id,
  value,
  onChange,
  currency,
  language,
  invalid,
  required,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  language: string;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
}) => (
  <div className="relative flex items-center">
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value ? formatNumberLocalized(value, { language }) : ""}
      onChange={(event) => onChange(sanitizeAmountInput(event.target.value))}
      placeholder="0"
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy}
      className={`${INPUT} pr-14`}
    />
    <span className="pointer-events-none absolute right-3 text-sm text-text-muted">{currency}</span>
  </div>
);

const SellModal = ({
  order,
  open,
  onClose,
  onSell,
  onPartlySell,
  isLoading,
  awaitingApproval,
  restrictExtraCostToCenter = false,
}: SellModalProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const approvals = usePendingExtraCostApprovals();
  const ids = useId();
  const [isPartial, setIsPartial] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [totalPrice, setTotalPrice] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [marketPaid, setMarketPaid] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  const panelRef = useFocusTrap<HTMLDivElement>(open && Boolean(order), { onEscape: onClose, inertAppRoot: true });

  useEffect(() => {
    if (!open) return;

    setIsPartial(false);
    setItemQuantities({});
    setTotalPrice("");
    setExtraCost("");
    setMarketPaid("");
    setNote("");
    setProof(null);
    setProofError("");
  }, [open, order?.id]);

  if (!open || !order || typeof document === "undefined") return null;

  const language = i18n.language;
  const currency = t("currency");
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const id = (suffix: string) => `${ids}-${suffix}`;
  const pendingApproval = getActivePendingApproval(approvals, order);
  const orderFlags = order as Order & Record<string, unknown>;
  const proofConditions = Array.isArray(order.market?.expense_proof_conditions)
    ? order.market.expense_proof_conditions
    : [];
  // Faqat ANIQ "markaz emas" bo'lsa yashiriladi: maydon kelmagan bo'lsa
  // kuryerni bekorga cheklamaymiz — backend baribir tekshiradi.
  const deliveryType = typeof order.where_deliver === "string" ? order.where_deliver.trim() : "";
  const isExtraCostBlocked =
    restrictExtraCostToCenter && deliveryType !== "" && deliveryType !== "center";
  const effectiveExtraCost = isExtraCostBlocked ? 0 : Number(extraCost) || 0;
  const operationTotal = isPartial
    ? totalPrice === "" ? null : Number(totalPrice)
    : toKnownAmount(order.total_price);
  // Bayroq (`*_requires_media`) yoki `sell_any` — avvalgidek; ustiga backend
  // tekshiradigan qolgan shartlar (xarajat yozilganda, 0 summada) qo'shildi.
  const sellRequiresMedia =
    Boolean(
      orderFlags.sell_requires_media ??
      orderFlags.sellRequiresMedia ??
      orderFlags.require_sell_proof ??
      orderFlags.sell_proof_required ??
      proofConditions.includes("sell_any"),
    ) ||
    isProofRequiredByConditions(proofConditions, {
      action: "sell",
      extraCost: effectiveExtraCost,
      totalPrice: operationTotal,
    });
  const isProofMissing = sellRequiresMedia && !proof;

  // Hamkor buyurtmasida marketga to'lov bu yerdan yozilmaydi.
  const isPartnerOrder = order.external_id !== null && order.external_id !== undefined && order.external_id !== "";
  const showMarketPaid = !isPartial && !isPartnerOrder;
  const marketPaidAmount = showMarketPaid ? Number(marketPaid) || 0 : 0;
  const marketPaidMax = getMarketPaidMax(order.to_be_paid, effectiveExtraCost);
  const isMarketPaidAboveMax = marketPaidMax !== null && marketPaidAmount > marketPaidMax;

  const getItemQty = (item: OrderItem) =>
    itemQuantities[item.id] ?? item.quantity;

  const getSelectedItemsCount = () =>
    (order.items ?? []).reduce((sum, item) => sum + getItemQty(item), 0);

  const isAtMinimumSelection = isPartial && getSelectedItemsCount() === 1;

  // Qisman sotish faqat backend haqiqatan qabul qila oladigan buyurtmada
  // ochiladi. Ilgari rejim har doim ochilar va so'rov baribir rad etilardi:
  //  • jami 1 dona — kamida bitta donani kamaytirish shart (backend), kamida
  //    bitta dona qolishi shart (UI qoidasi) — ikkalasi birga bajarilmaydi;
  //  • mahsulot qatorlari umuman yo'q — yuboriladigan narsa yo'q;
  //  • bir xil katalog mahsuloti ikki qatorda — backend har ikkala qatorni
  //    so'rovdagi BIRINCHI yozuv bilan solishtiradi va rad etadi.
  const orderItems = order.items ?? [];
  const totalItemUnits = orderItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  // Katalogsiz qatorlar (id `null`) dublikat hisoblanmaydi — ular
  // `order_item_id` bilan har biri alohida topiladi.
  const catalogIds = orderItems
    .map(getCatalogProductId)
    .filter((itemId): itemId is string => Boolean(itemId));
  const partialUnavailableReason =
    orderItems.length === 0
      ? t("partialSellUnavailableNoItems")
      : orderItems.some((item) => !(Number(item.quantity) >= 0))
        ? t("partialSellUnavailableInvalidQuantity")
        : totalItemUnits < 2
          ? t("partialSellUnavailableSingle")
          : new Set(catalogIds).size !== catalogIds.length
            ? t("partialSellUnavailableDuplicate")
            : null;
  const canSellPartially = partialUnavailableReason === null;
  const hasDecreasedItem = orderItems.some((item) => getItemQty(item) < item.quantity);
  // fix3b M10: qisman sotuv summasi buyurtma summasidan oshmaydi (teng bo'lishi
  // mumkin). Backend ham 400 qaytaradi; xato (masalan ortiqcha nol) market va
  // kuryer kassasini oshirib, rollbackda asl summani yo'qotardi. Buyurtma
  // summasi noma'lum bo'lsa tekshirilmaydi — backend baribir tekshiradi.
  const orderTotalAmount = toKnownAmount(order.total_price);
  const isPartialPriceAboveTotal =
    isPartial &&
    totalPrice !== "" &&
    orderTotalAmount !== null &&
    Number(totalPrice) > orderTotalAmount;
  const partialBlockReason = !isPartial
    ? null
    : !canSellPartially
      // Qisman rejim ochiq turganda ma'lumot yangilanib, qisman sotish
      // mumkin bo'lmay qolsa — tugma jimgina hech narsa qilmasin emas.
      ? partialUnavailableReason
      : !hasDecreasedItem
      ? t("partialSellDecreaseRequired")
      : totalPrice === ""
        ? t("partialSellPriceRequired")
        : isPartialPriceAboveTotal
          ? t("partialSellPriceExceedsTotal")
          : null;
  // Pastdagi izoh — nega «Sotish» o'chiq (maketdagidek tugma yonida).
  const blockReason = partialBlockReason ?? (isProofMissing ? t("sellMediaProofRequiredNotice") : null);

  const canDecreaseItem = (item: OrderItem) => {
    const currentQty = getItemQty(item);

    if (currentQty <= 0) return false;

    return getSelectedItemsCount() - 1 >= 1;
  };

  const setItemQty = (item: OrderItem, val: number) => {
    // Alohida qator 0 gacha tushishi mumkin — jami kamida 1 dona qolishini
    // canDecreaseItem ta'minlaydi.
    const clamped = Math.max(0, Math.min(item.quantity, val));

    if (clamped < getItemQty(item) && !canDecreaseItem(item)) {
      return;
    }

    setItemQuantities((prev) => ({ ...prev, [item.id]: clamped }));
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!order) return;
    if (sellRequiresMedia && !proof) {
      setProofError(t("mediaProofRequired"));
      return;
    }

    if (isPartial) {
      if (!canSellPartially || getSelectedItemsCount() < 1 || partialBlockReason) {
        return;
      }

      // POST /orders/partly-sell/{id}
      onPartlySell(order.id, {
        order_item_info: orderItems.map((item) => {
          const productId = getCatalogProductId(item);
          return {
            order_item_id: String(item.id),
            ...(productId ? { product_id: productId } : {}),
            quantity: getItemQty(item),
          };
        }),
        totalPrice: Number(totalPrice) || 0,
        extraCost: effectiveExtraCost,
        comment: note,
        ...(proof ? { proof } : {}),
      });
    } else {
      // POST /orders/sell/{id}
      onSell(order.id, {
        comment: note,
        extraCost: effectiveExtraCost,
        ...(marketPaidAmount > 0 ? { paidAmount: marketPaidAmount } : {}),
        ...(proof ? { proof } : {}),
      });
    }
  };

  const handleProofChange = (file?: File) => {
    setProofError("");
    if (!file) {
      setProof(null);
      return;
    }
    if (file.size > MAX_PROOF_SIZE_BYTES) {
      setProof(null);
      setProofError(t("mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }));
      return;
    }
    setProof(file);
  };

  const deliverLabel =
    deliveryType === "address" ? t("deliveryToHome") : deliveryType === "center" ? t("deliveryToCenter") : "";
  const subtitle = [`№${order.id}`, order.market?.name, deliverLabel].filter(Boolean).join(" · ");

  const extraCostField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      {isExtraCostBlocked ? (
        <>
          <span id={id("extra-label")} className={LABEL}>
            {t("extraCost")}
          </span>
          <div
            role="note"
            aria-labelledby={id("extra-label")}
            className="flex items-start gap-2 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-text-muted"
          >
            <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <p>{t("extraCostHomeNotAllowed")}</p>
          </div>
        </>
      ) : (
        <>
          <label className={LABEL} htmlFor={id("extra")}>
            {t("extraCost")}
          </label>
          <AmountInput
            id={id("extra")}
            value={extraCost}
            onChange={setExtraCost}
            currency={currency}
            language={language}
            describedBy={Number(extraCost) > 0 ? id("extra-note") : undefined}
          />
          {Number(extraCost) > 0 ? <ExtraCostNoticeAlert id={id("extra-note")} /> : null}
        </>
      )}
    </div>
  );

  const marketPaidField = showMarketPaid ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className={LABEL} htmlFor={id("market-paid")}>
        {t("marketPaidAmount")}
      </label>
      <AmountInput
        id={id("market-paid")}
        value={marketPaid}
        onChange={setMarketPaid}
        currency={currency}
        language={language}
        invalid={isMarketPaidAboveMax}
        describedBy={`${id("market-paid-hint")}${isMarketPaidAboveMax ? ` ${id("market-paid-error")}` : ""}`}
      />
      <span id={id("market-paid-hint")} className="text-xs text-text-muted">
        {t("marketPaidAmountHint")}
        {marketPaidMax !== null ? ` · ${t("amountMaxHint", { amount: money(marketPaidMax) })}` : ""}
      </span>
      {isMarketPaidAboveMax ? (
        <span id={id("market-paid-error")} role="alert" className="text-xs font-semibold text-danger-fg">
          {t("marketPaidAboveMax", { amount: money(marketPaidMax ?? 0) })}
        </span>
      ) : null}
    </div>
  ) : null;

  const noteField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className={LABEL} htmlFor={id("note")}>
        {t("note")} <span className="font-normal text-text-muted">({t("optional", { ns: "common" })})</span>
      </label>
      <textarea
        id={id("note")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("writeNote")}
        rows={2}
        className={`${INPUT} h-auto min-h-[72px] resize-y py-2.5`}
      />
    </div>
  );

  const proofField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={id("proof-label")} className={LABEL}>
        {t("mediaProof")}{" "}
        {sellRequiresMedia ? (
          <span className="text-danger-fg">*</span>
        ) : (
          <span className="font-normal text-text-muted">({t("optional", { ns: "common" })})</span>
        )}
      </span>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-sunken p-3 focus-within:outline-2 focus-within:outline-action ${
          proofError ? "border-danger" : "border-border-strong"
        }`}
      >
        <span
          className={`inline-flex size-8 flex-none items-center justify-center rounded-full ${
            proof ? "bg-success-soft text-success-fg" : "bg-surface text-text-muted"
          }`}
        >
          {proof ? <CircleCheck className="size-4" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-text">{proof ? proof.name : t("mediaProofUpload")}</span>
          <span className="text-xs text-text-muted">
            {proof
              ? `${formatNumberLocalized(proof.size / (1024 * 1024), { language, fractionDigits: 1 })} MB · ${t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}`
              : t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}
          </span>
        </span>
        <span aria-hidden="true" className={`${BTN_SECONDARY} h-8 px-3 text-[13px] max-md:min-h-11`}>
          {proof ? t("mediaProofReplace") : t("mediaProofChoose")}
        </span>
        <input
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          aria-labelledby={id("proof-label")}
          aria-describedby={sellRequiresMedia || proofError ? id("proof-hint") : undefined}
          aria-required={sellRequiresMedia || undefined}
          onChange={(event) => handleProofChange(event.target.files?.[0])}
        />
      </label>
      {proofError ? (
        <span id={id("proof-hint")} className="text-xs font-semibold text-danger-fg">
          {proofError}
        </span>
      ) : sellRequiresMedia ? (
        <span id={id("proof-hint")} className="text-xs text-text-muted">
          {t("sellMediaProofRequiredNotice")}
        </span>
      ) : null}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-overlay p-6 max-md:items-end max-md:p-0">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        aria-describedby={id("desc")}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100dvh-48px)] w-full flex-col gap-4 rounded-[20px] border border-border bg-raised p-6 shadow-xl outline-none max-md:max-h-[92dvh] max-md:max-w-full max-md:rounded-b-none max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom)+24px)] max-md:pt-3 ${
          isPartial ? "max-w-[780px]" : "max-w-[520px]"
        }`}
      >
        <span aria-hidden="true" className="mx-auto -mb-1 h-1 w-10 flex-none rounded-full bg-border-strong md:hidden" />

        {/* Sarlavha */}
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-success-soft text-success-fg">
            <PackageCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={id("title")} className="text-lg font-semibold text-text">
              {isPartial ? t("partialSell") : t("sell")}
            </h2>
            <p id={id("desc")} className="truncate text-[13px] text-text-muted">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close", { ns: "common" })}
            className="-mr-2 -mt-1 inline-flex size-8 flex-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-action max-md:size-11"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tana */}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-0.5">
          {awaitingApproval ? (
            <ExtraCostPendingAlert
              amount={pendingApproval?.amount ?? (Number(extraCost) || 0)}
              action={pendingApproval?.action}
            />
          ) : (
            <>
              {pendingApproval ? <ExtraCostSentAlert approval={pendingApproval} /> : null}

              <div role="group" aria-label={t("customer")} className="flex items-center gap-3 rounded-xl bg-sunken px-4 py-3 text-sm">
                <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-brand text-[13px] font-bold text-surface">
                  {initials(order.customer?.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold text-text">{order.customer?.name ?? "—"}</span>
                  <span className="flex flex-wrap gap-x-3 text-[13px] text-text-muted">
                    {order.customer?.phone_number ? (
                      <span className="whitespace-nowrap">{order.customer.phone_number}</span>
                    ) : null}
                    {order.district?.name ? <span className="whitespace-nowrap">{order.district.name}</span> : null}
                  </span>
                </div>
                <div className="flex flex-none flex-col gap-0.5 text-right">
                  <span className="text-xs text-text-muted">{t("sumLabel")}</span>
                  <span className="whitespace-nowrap font-semibold text-text">{money(Number(order.total_price) || 0)}</span>
                </div>
              </div>

              <form id={id("form")} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Qisman sotish kaliti */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPartial}
                  aria-describedby={id("partial-desc")}
                  disabled={!canSellPartially}
                  onClick={() => setIsPartial((value) => !value)}
                  className={`group flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-action disabled:cursor-not-allowed ${
                    isPartial ? "border-action bg-action-soft" : "border-border bg-transparent hover:bg-sunken"
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-sm font-semibold ${canSellPartially ? "text-text" : "text-text-muted"}`}>
                      {t("partialSell")}
                    </span>
                    <span id={id("partial-desc")} className="text-[13px] text-text-muted">
                      {partialUnavailableReason ?? t("sellSeparately")}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 group-aria-checked:bg-action group-disabled:opacity-45"
                  >
                    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4" />
                  </span>
                </button>

                {isPartial ? (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-6 gap-y-4">
                    {/* Mahsulotlar */}
                    <div className="flex min-w-0 flex-col gap-2">
                      <span id={id("items-label")} className={LABEL}>
                        {t("products")}
                      </span>
                      {orderItems.length > 0 ? (
                        <ul aria-labelledby={id("items-label")} className="flex flex-col rounded-xl bg-sunken">
                          {orderItems.map((item, index) => {
                            const quantity = getItemQty(item);
                            return (
                              <li
                                key={item.id}
                                className="flex items-center gap-3 border-t border-border py-1.5 pl-4 pr-2 first:border-t-0"
                              >
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="truncate text-sm font-semibold text-text">{getItemName(item, index)}</span>
                                  <span className="text-xs text-text-muted">{t("maxQuantity", { count: item.quantity })}</span>
                                </span>
                                <span role="group" aria-label={getItemName(item, index)} className="inline-flex flex-none items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setItemQty(item, quantity - 1)}
                                    disabled={!canDecreaseItem(item)}
                                    aria-label={t("decreaseQuantity", { name: getItemName(item, index) })}
                                    className={ICON_BTN}
                                  >
                                    <Minus className="size-4" aria-hidden="true" />
                                  </button>
                                  <span
                                    aria-live="polite"
                                    className={`min-w-7 text-center text-sm font-semibold ${quantity === 0 ? "text-text-subtle" : "text-text"}`}
                                  >
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setItemQty(item, quantity + 1)}
                                    disabled={quantity >= item.quantity}
                                    aria-label={t("increaseQuantity", { name: getItemName(item, index) })}
                                    className={ICON_BTN}
                                  >
                                    <Plus className="size-4" aria-hidden="true" />
                                  </button>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {isAtMinimumSelection ? (
                        <p className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
                          <TriangleAlert className="size-4 flex-none" aria-hidden="true" />
                          <span>{t("minimumSelectionError")}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <label className={LABEL} htmlFor={id("total")}>
                          {t("paymentAmount")} <span className="text-danger-fg">*</span>
                        </label>
                        <AmountInput
                          id={id("total")}
                          value={totalPrice}
                          onChange={setTotalPrice}
                          currency={currency}
                          language={language}
                          invalid={isPartialPriceAboveTotal}
                          required
                          describedBy={orderTotalAmount !== null ? id("total-hint") : undefined}
                        />
                        {isPartialPriceAboveTotal ? (
                          <span role="alert" className="text-xs font-semibold text-danger-fg">
                            {t("partialSellPriceExceedsTotal")}
                          </span>
                        ) : orderTotalAmount !== null ? (
                          <span id={id("total-hint")} className="text-xs text-text-muted">
                            {t("amountMaxHint", { amount: money(orderTotalAmount) })}
                          </span>
                        ) : null}
                      </div>
                      {extraCostField}
                      {noteField}
                      {proofField}
                    </div>
                  </div>
                ) : (
                  <>
                    {extraCostField}
                    {marketPaidField}
                    {noteField}
                    {proofField}
                  </>
                )}
              </form>
            </>
          )}
        </div>

        {/* Pastki qism */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4 max-md:[&>button]:flex-1">
          {!awaitingApproval && blockReason ? (
            <p className="mr-auto min-w-0 text-[13px] text-text-muted max-md:w-full">{blockReason}</p>
          ) : null}
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {awaitingApproval ? t("close", { ns: "common" }) : t("back", { ns: "common" })}
          </button>
          {awaitingApproval ? null : (
            <button
              type="submit"
              form={id("form")}
              disabled={isLoading || isProofMissing || Boolean(partialBlockReason)}
              aria-busy={isLoading || undefined}
              className={BTN_SUCCESS}
            >
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <PackageCheck className="size-4" aria-hidden="true" />
              )}
              {t("sell")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default memo(SellModal);
