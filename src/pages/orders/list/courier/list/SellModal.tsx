// dizayn-v2: courier-orders-sell-dialog, courier-orders-sell-partial-dialog, courier-orders-sell-extra-cost-dialog, courier-orders-action-approval-pending, manager-orders-sell-dialog
import { memo, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, Clock, Info, Minus, PackageCheck, Plus, Tag, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../../shared/lib/cx";
import { getOrderItemName } from "../../../../../shared/lib/orderItemName";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import {
  Button,
  Dialog,
  Field,
  IconButton,
  Pressable,
  TextInput,
} from "../../../../../shared/ui/primitives";
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
import { OrderCustomerSummary, ProofField } from "./OrderActionParts";
import {
  getDeliveryLabelKey,
  isProofFileTooLarge,
  MAX_PROOF_SIZE_MB,
  toAmount,
  type ActionOrder,
  type ActionOrderItem,
  type OrderActionVariant,
} from "./orderActionModel";
import { useActionDialogSession, useApprovalStateFocus } from "./useActionDialogSession";

/**
 * SOTISH / QISMAN SOTISH — kuryer, menejer va buyurtma tafsilotida bitta oyna (`Dialog`: telefonda
 * pastki varaqa, fokus tuzog'i, Esc, so'rov ketayotganda yopilmaydi).
 *
 * Maketlar: `courier-orders-sell-dialog` (+ `-partial-`, `-extra-cost-`, `-action-approval-pending`) —
 * `variant="courier"` (sukut); `manager-orders-sell-dialog` — `variant="manager"` (menejer ro'yxati va
 * buyurtma tafsiloti — u yerda sotishni faqat hududiy menejer qiladi).
 *
 * To'liq sotishda «Marketga to'langan summa» (uguUEhin): kuryer mijozdan olgan puldan marketga o'zi
 * bergan qism. Faqat 0 dan katta bo'lsa yuboriladi; hamkor (`external_id`) buyurtmasida ko'rsatilmaydi.
 * Maketda yo'q — summa maydoni naqshida.
 */

type OrderItem = ActionOrderItem;

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

type PartlySellPayload = {
  order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
  totalPrice: number;
  extraCost: number;
  comment: string;
  proof?: File;
};

type SellModalProps = {
  order: ActionOrder | null;
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
  /** Maket varianti (sukut `courier`; menejer ro'yxati — `manager`). */
  variant?: OrderActionVariant;
};

/** `.el-label` — `Field` siz yorliq (qo'shimcha xarajat yozilmaydigan holat, mahsulotlar ro'yxati). */
const LABEL = "text-[13px] font-semibold text-text";

/** Qisman sotish kaliti (`.el-switch`, CODE-MAP 2.2): butun qator — `role="switch"` tugma. */
const PartialSwitch = ({
  checked,
  disabled,
  description,
  descriptionId,
  onToggle,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  description: ReactNode;
  descriptionId: string;
  onToggle: () => void;
  label: string;
}) => (
  <Pressable
    role="switch"
    aria-checked={checked}
    aria-describedby={descriptionId}
    disabled={disabled}
    onClick={onToggle}
    className={cx(
      "group flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed",
      checked ? "border-action bg-action-soft" : "border-border bg-transparent not-disabled:hover:bg-sunken",
    )}
  >
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cx("text-sm font-semibold", disabled ? "text-text-muted" : "text-text")}>{label}</span>
      <span id={descriptionId} className="text-[13px] text-text-muted">
        {description}
      </span>
    </span>
    <span
      aria-hidden="true"
      className="relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 group-aria-checked:bg-action group-disabled:opacity-45 motion-reduce:transition-none"
    >
      <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
    </span>
  </Pressable>
);

type SellDialogProps = Omit<SellModalProps, "order"> & { order: ActionOrder; variant: OrderActionVariant };

const SellDialog = ({
  order,
  open,
  onClose,
  onSell,
  onPartlySell,
  isLoading = false,
  awaitingApproval = false,
  restrictExtraCostToCenter = false,
  variant,
}: SellDialogProps) => {
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
  const approvalCloseRef = useApprovalStateFocus(awaitingApproval);
  // «−» bosilib o'zi o'chsa (0 ga yoki jami 1 donaga yetdi) fokus `body` ga tushmasin — shu qatordagi «+» ga.
  const focusAfterRender = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfterRender.current) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  });

  const isManager = variant === "manager";
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const id = (suffix: string) => `${ids}-${suffix}`;
  const pendingApproval = getActivePendingApproval(approvals, order);
  const orderFlags = order as ActionOrder & Record<string, unknown>;
  const proofConditions = Array.isArray(order.market?.expense_proof_conditions)
    ? order.market.expense_proof_conditions
    : [];
  // Faqat ANIQ "markaz emas" bo'lsa yashiriladi: maydon kelmagan bo'lsa
  // kuryerni bekorga cheklamaymiz — backend baribir tekshiradi.
  const deliveryType = typeof order.where_deliver === "string" ? order.where_deliver.trim() : "";
  const isExtraCostBlocked =
    restrictExtraCostToCenter && deliveryType !== "" && deliveryType !== "center";
  const effectiveExtraCost = isExtraCostBlocked ? 0 : toAmount(extraCost);
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
  const marketPaidAmount = showMarketPaid ? toAmount(marketPaid) : 0;
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
    if (isLoading) return;
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
        totalPrice: toAmount(totalPrice),
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
    if (isProofFileTooLarge(file)) {
      setProof(null);
      setProofError(t("mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }));
      return;
    }
    setProof(file);
  };

  const deliveryKey = getDeliveryLabelKey(order.where_deliver);
  const subtitle = [`№${order.id}`, order.market?.name, deliveryKey ? t(deliveryKey) : null].filter(Boolean).join(" · ");
  const showExtraNotice = !isExtraCostBlocked && toAmount(extraCost) > 0;

  // ── Market tasdig'i kutilmoqda (maket `courier-orders-action-approval-pending`) ──────────────
  if (awaitingApproval) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        size="md"
        className={isManager ? undefined : "md:max-w-[500px]"}
        title={t("extraCostApprovalPendingTitle")}
        description={subtitle}
        icon={Clock}
        iconTone="warning"
        footer={
          <Button ref={approvalCloseRef} variant="secondary" className="md:min-w-[120px]" onClick={onClose}>
            {t("close", { ns: "common" })}
          </Button>
        }
      >
        <OrderCustomerSummary order={order} variant={variant} />
        <ExtraCostPendingAlert
          amount={pendingApproval?.amount ?? effectiveExtraCost}
          action={pendingApproval?.action}
          requestedAt={pendingApproval?.requestedAt}
        />
      </Dialog>
    );
  }

  // ── Maydonlar ─────────────────────────────────────────────────────────────────────────────
  const extraCostField = isExtraCostBlocked ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={id("extra-label")} className={LABEL}>
        {t("extraCost")}
      </span>
      <div
        role="note"
        aria-labelledby={id("extra-label")}
        className="flex items-start gap-2 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-text-muted"
      >
        <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="min-w-0">{t("extraCostHomeNotAllowed")}</p>
      </div>
    </div>
  ) : (
    <Field
      label={t("extraCost")}
      // Menejer maketi: maydon ostida qisqa eslatma; summa yozilgach — to'liq ogohlantirish bloki.
      hint={isManager && !showExtraNotice ? t("extraCostApprovalHint") : undefined}
    >
      <TextInput
        mode="money"
        value={extraCost}
        onValueChange={setExtraCost}
        placeholder="0"
        aria-describedby={showExtraNotice ? id("extra-note") : undefined}
      />
    </Field>
  );
  const extraNotice = showExtraNotice ? <ExtraCostNoticeAlert id={id("extra-note")} /> : null;

  const marketPaidField = showMarketPaid ? (
    <Field
      label={t("marketPaidAmount")}
      hint={`${t("marketPaidAmountHint")}${marketPaidMax !== null ? ` · ${t("amountMaxHint", { amount: money(marketPaidMax) })}` : ""}`}
      error={
        isMarketPaidAboveMax ? (
          <span role="alert">{t("marketPaidAboveMax", { amount: money(marketPaidMax ?? 0) })}</span>
        ) : undefined
      }
    >
      <TextInput mode="money" value={marketPaid} onValueChange={setMarketPaid} placeholder="0" />
    </Field>
  ) : null;

  const totalField = (
    <Field
      label={isManager ? t("paidAmount") : t("paymentAmount")}
      required
      hint={orderTotalAmount !== null ? t("amountMaxHint", { amount: money(orderTotalAmount) }) : undefined}
      error={
        isPartialPriceAboveTotal ? <span role="alert">{t("partialSellPriceExceedsTotal")}</span> : undefined
      }
    >
      <TextInput mode="money" value={totalPrice} onValueChange={setTotalPrice} placeholder="0" />
    </Field>
  );

  const noteField = (
    <Field label={t("note")} optional>
      <TextInput multiline rows={2} value={note} onValueChange={setNote} placeholder={t("writeNote")} />
    </Field>
  );

  const proofField = (
    <ProofField
      variant={variant}
      file={proof}
      required={sellRequiresMedia}
      hint={sellRequiresMedia ? t("sellMediaProofRequiredNotice") : undefined}
      error={proofError || undefined}
      onFileChange={handleProofChange}
    />
  );

  const itemsField = (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={id("items-label")} className={LABEL}>
        {t("products")}
      </span>
      {orderItems.length > 0 ? (
        <ul
          aria-labelledby={id("items-label")}
          className={cx("m-0 flex list-none flex-col p-0", isManager ? "gap-2" : "rounded-xl bg-sunken")}
        >
          {orderItems.map((item, index) => {
            const name = getItemName(item, index);
            const quantity = getItemQty(item);
            return (
              <li
                key={item.id}
                className={cx(
                  "flex items-center gap-3",
                  isManager
                    ? "flex-wrap gap-y-2 rounded-xl bg-sunken py-2 pl-2 pr-3"
                    : "border-t border-border py-1.5 pl-4 pr-2 first:border-t-0",
                )}
              >
                <span className={cx("flex min-w-0 items-center gap-3", isManager ? "flex-[1_1_180px]" : "flex-1")}>
                  {isManager ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
                    >
                      <Tag size={18} strokeWidth={2} />
                    </span>
                  ) : null}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">{name}</span>
                    <span className="text-xs text-text-muted">{t("maxQuantity", { count: item.quantity })}</span>
                  </span>
                </span>
                <span
                  role="group"
                  aria-label={t("itemQuantityGroup", { name })}
                  className="inline-flex flex-none items-center gap-1"
                >
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={Minus}
                    label={t("decreaseQuantity", { name })}
                    onClick={() => {
                      if (quantity - 1 <= 0 || getSelectedItemsCount() - 1 <= 1) focusAfterRender.current = id(`inc-${index}`);
                      setItemQty(item, quantity - 1);
                    }}
                    disabled={!canDecreaseItem(item)}
                  />
                  <span
                    aria-live="polite"
                    className={cx("min-w-7 text-center text-sm font-semibold", quantity === 0 ? "text-text-subtle" : "text-text")}
                  >
                    {quantity}
                  </span>
                  <IconButton
                    id={id(`inc-${index}`)}
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    label={t("increaseQuantity", { name })}
                    onClick={() => setItemQty(item, quantity + 1)}
                    disabled={quantity >= item.quantity}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {isAtMinimumSelection ? (
        <p role="alert" className="m-0 flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
          <TriangleAlert size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
          <span>{t("minimumSelectionError")}</span>
        </p>
      ) : null}
    </div>
  );

  /** Ikki maydon yonma-yon (menejer maketi), telefonda ustma-ust. */
  const pair = (first: ReactNode, second: ReactNode) =>
    second ? (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] items-start gap-4">
        {first}
        {second}
      </div>
    ) : (
      first
    );

  let fields: ReactNode;
  if (isPartial && isManager) {
    fields = (
      <>
        {itemsField}
        {pair(totalField, extraCostField)}
        {extraNotice}
        {noteField}
        {proofField}
      </>
    );
  } else if (isPartial) {
    fields = (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-6 gap-y-4">
        {itemsField}
        <div className="flex min-w-0 flex-col gap-4">
          {totalField}
          <div className="flex min-w-0 flex-col gap-2">
            {extraCostField}
            {extraNotice}
          </div>
          {noteField}
          {proofField}
        </div>
      </div>
    );
  } else if (isManager) {
    fields = (
      <>
        {pair(extraCostField, marketPaidField)}
        {extraNotice}
        {noteField}
        {proofField}
      </>
    );
  } else {
    fields = (
      <>
        <div className="flex min-w-0 flex-col gap-2">
          {extraCostField}
          {extraNotice}
        </div>
        {marketPaidField}
        {noteField}
        {proofField}
      </>
    );
  }

  const SubmitIcon = isManager ? CircleCheck : PackageCheck;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={isLoading}
      // Ochilganda fokus panelda (sarlavha o'qiladi): telefonda klaviatura o'zi ochilib, varaqani yopmasin.
      initialFocus="panel"
      size={isManager ? "lg" : "md"}
      className={isManager ? undefined : isPartial ? "md:max-w-[780px]" : "md:max-w-[520px]"}
      title={isManager ? t("sellOrderTitle") : isPartial ? t("partialSell") : t("sell")}
      description={subtitle}
      icon={SubmitIcon}
      iconTone="success"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      footer={
        // Bitta o'ram: telefonda sabab o'z qatorida (maket), tugmalar teng enli ikkinchi qatorda.
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 max-md:[&>button]:flex-1">
          {blockReason ? (
            <p
              id={id("block")}
              className="m-0 mr-auto min-w-0 text-[13px] text-text-muted max-md:basis-full max-md:text-center"
            >
              {blockReason}
            </p>
          ) : null}
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            {t("back", { ns: "common" })}
          </Button>
          <Button
            type="submit"
            variant={isManager ? "primary" : "success"}
            leftIcon={SubmitIcon}
            loading={isLoading}
            disabled={isProofMissing || Boolean(partialBlockReason)}
            aria-describedby={blockReason ? id("block") : undefined}
          >
            {t("sell")}
          </Button>
        </div>
      }
    >
      {pendingApproval ? <ExtraCostSentAlert approval={pendingApproval} /> : null}
      <OrderCustomerSummary order={order} variant={variant} />
      <PartialSwitch
        checked={isPartial}
        disabled={!canSellPartially}
        label={t("partialSell")}
        description={partialUnavailableReason ?? t("sellSeparately")}
        descriptionId={id("partial-desc")}
        onToggle={() => setIsPartial((value) => !value)}
      />
      {fields}
    </Dialog>
  );
};

const SellModal = ({ order, open, variant = "courier", ...rest }: SellModalProps) => {
  const session = useActionDialogSession(open, order);
  if (!session.order) return null;
  return <SellDialog key={session.session} {...rest} order={session.order} open={session.open} variant={variant} />;
};

export default memo(SellModal);
