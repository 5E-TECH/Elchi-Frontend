// dizayn-v2: superadmin-orders-detail-edit-order-dialog, admin-orders-edit-order-dialog, manager-orders-detail-edit-products-dialog, registrator-orders-detail-edit-order-dialog
import { memo, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../../entities/orders";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../../shared/ui/primitives";
import { ORDER_AMOUNT_ERROR_KEYS, readOrderAmountInput } from "../../../orders/lib/orderAmountInput";
import {
  buildOrderUpdatePayload,
  isOrderReceivedOrLater,
  isOrderSentToBranch,
  parseOrderTotalPrice,
} from "../newOrderUpdateRules";
import {
  formatDialogSubtitle,
  notifySaved,
  notifySaveError,
  seedOrderForm,
  toRulesTotalPrice,
  type EditDialogOrder,
  type EditDialogProps,
  type OrderFormState,
} from "./editDialogModel";
import { OrderItemsEditor } from "./OrderItemsEditor";
import { useEditDialogSession } from "./useEditDialogSession";

/**
 * BUYURTMANI TAHRIRLASH (maketlar `superadmin-orders-detail-edit-order-dialog`,
 * `manager-orders-detail-edit-products-dialog` — bir xil; 600 px, telefonda pastki varaqa).
 *
 * «Mahsulotlar» (son − / +, olib tashlash) → «Yetkazish turi» + «Umumiy summa *» (yonma-yon, tor joyda
 * ustma-ust) → «Izoh». Saqlash — `PATCH /orders/:id/full`, faqat o'zgargan va qulflanmagan maydonlar
 * (`buildOrderUpdatePayload`): HQ qabul qilgan buyurtmada mahsulot va summa, filialga jo'natilganda
 * yetkazish turi yuborilmaydi va maydoni qulf (sababi ostida).
 *
 * Kamida bitta mahsulot qoladi (D-01, `OrderItemsEditor`); summa maydoni kasr / minus / 12 xonadan uzun sonni
 * jimgina o'zgartirmaydi — rad etadi va sababini aytadi (D-17, yaratish formasidagi bilan bir xil).
 */

const DELIVERY_OPTIONS = [
  { value: "address", labelKey: "deliveryToHome" },
  { value: "center", labelKey: "deliveryToCenter" },
] as const;

type OrderDialogProps = Omit<EditDialogProps, "order"> & { order: EditDialogOrder };

const OrderDialog = ({ open, order, onClose, onSaved }: OrderDialogProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders", "common"]);
  const ids = useId();
  const { updateNewOrder } = useOrders();
  const [initial] = useState<OrderFormState>(() => seedOrderForm(order));
  const [form, setForm] = useState<OrderFormState>(initial);
  const [totalError, setTotalError] = useState<string | undefined>();
  const [itemsError, setItemsError] = useState<string | undefined>();
  /** Rad etilgan belgi sababi (D-17) — o'chirilguncha yoki maydondan chiqilguncha ko'rinib turadi. */
  const [amountHint, setAmountHint] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const totalRef = useRef<HTMLInputElement>(null);
  const productsLocked = isOrderReceivedOrLater(order.status ?? "");
  const destinationLocked = isOrderSentToBranch(order);
  const subtitle = formatDialogSubtitle(order.id, order.customer?.name);
  const hasItems = (order.items ?? []).length > 0;

  const deliveryOptions = useMemo<SelectOption[]>(
    () => DELIVERY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey, { ns: "orders" }) })),
    [t],
  );

  const setQuantity = (itemId: string, quantity: number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item)),
    }));

  const removeItem = (itemId: string) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== itemId) }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    // Mahsulotsiz buyurtma saqlanmaydi (`items: []` ketmasin) — oyna buni o'zi ham yo'l qo'ymaydi (D-01).
    if (!productsLocked && hasItems && form.items.length === 0) {
      setItemsError(t("editDialog.itemsMinOne"));
      return;
    }

    const totalPrice = toRulesTotalPrice(order, initial.total_price, form.total_price);
    if (!productsLocked && parseOrderTotalPrice(totalPrice) === null) {
      setTotalError(t("totalAmountValidation"));
      totalRef.current?.focus();
      return;
    }

    const data = buildOrderUpdatePayload(
      order,
      { ...form, total_price: totalPrice },
      { products: productsLocked, destination: destinationLocked },
    );
    if (!Object.keys(data).length) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateNewOrder.mutateAsync({ orderId: String(order.id), data });
      notifySaved("newOrders:editDialog.orderSaved", subtitle);
      onSaved?.();
      onClose();
    } catch (error) {
      notifySaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const itemsFieldId = `${ids}-items`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      // Maket 600 px: `xl` (640) ustidan aniq kenglik — telefonda varaqa to'liq enli qoladi.
      size="xl"
      className="md:max-w-[600px]"
      title={t("editOrder")}
      description={subtitle}
      icon={ShoppingBag}
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" loading={saving}>
            {t("save", { ns: "common" })}
          </Button>
        </>
      }
    >
      {hasItems ? (
        <Field id={itemsFieldId} label={t("products", { ns: "orders" })} labelAs="span" error={itemsError}>
          <OrderItemsEditor
            items={form.items}
            labelledBy={`${itemsFieldId}-label`}
            readOnly={productsLocked}
            disabled={saving}
            onQuantityChange={setQuantity}
            onRemove={removeItem}
          />
        </Field>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] items-start gap-4">
        <Field
          label={t("deliveryType")}
          labelAs="span"
          disabled={destinationLocked}
          hint={destinationLocked ? t("destinationLockReason") : undefined}
        >
          <Select
            options={deliveryOptions}
            value={form.where_deliver || null}
            onChange={(value) => setForm((prev) => ({ ...prev, where_deliver: value ?? "" }))}
            placeholder={t("selectType")}
          />
        </Field>
        <Field
          label={t("totalAmount")}
          required={!productsLocked}
          error={totalError}
          disabled={productsLocked}
          hint={productsLocked ? t("productsLockReason") : amountHint}
          hintLive
        >
          <TextInput
            ref={totalRef}
            mode="money"
            value={form.total_price}
            // Xom matn tekshiriladi (`onValueChange` belgilarni jimgina tashlab yuboradi): «12.5» → 125 emas.
            onChange={(event) => {
              const result = readOrderAmountInput(event.target.value, i18n.resolvedLanguage ?? i18n.language);
              if (result.error) {
                setAmountHint(t(ORDER_AMOUNT_ERROR_KEYS[result.error]));
                return;
              }
              if (result.digits.length < form.total_price.length) setAmountHint(undefined);
              setForm((prev) => ({ ...prev, total_price: result.digits }));
              setTotalError(undefined);
            }}
            onBlur={() => setAmountHint(undefined)}
            placeholder={t("enterPrice")}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <TextInput
          multiline
          rows={3}
          value={form.comment}
          onValueChange={(comment) => setForm((prev) => ({ ...prev, comment }))}
          placeholder={t("enterNote")}
        />
      </Field>
    </Dialog>
  );
};

/**
 * Buyurtmani (mahsulotlar, yetkazish turi, summa, izoh) tahrirlash oynasi.
 *
 *   <EditOrderDialog open={isOrderOpen} order={order} onClose={() => setOrderOpen(false)} />
 */
export const EditOrderDialog = memo(({ open, order, onClose, onSaved }: EditDialogProps) => {
  const session = useEditDialogSession(open, order);
  if (!session.order) return null;
  return (
    <OrderDialog key={session.session} open={session.open} order={session.order} onClose={onClose} onSaved={onSaved} />
  );
});

EditOrderDialog.displayName = "EditOrderDialog";
