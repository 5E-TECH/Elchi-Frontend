// dizayn-v2: superadmin-orders-detail-edit-customer-dialog, admin-orders-edit-customer-dialog
import { memo, useRef, useState, type FormEvent } from "react";
import { Info, Lock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../../../entities/user/api/userApi";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import {
  buildCustomerUpdatePayload,
  getCustomerUpdateValidationError,
  isOrderSentToBranch,
} from "../newOrderUpdateRules";
import { DialogNote } from "./DialogNote";
import {
  CUSTOMER_ERROR_KEYS,
  formatDialogSubtitle,
  notifySaved,
  notifySaveError,
  readMarketName,
  seedCustomerForm,
  toCustomerRulesInput,
  type CustomerFormState,
  type EditDialogOrder,
  type EditDialogProps,
} from "./editDialogModel";
import { useEditDialogSession } from "./useEditDialogSession";

/**
 * MIJOZ MA'LUMOTINI TAHRIRLASH (maket `superadmin-orders-detail-edit-customer-dialog`, 460 px; telefonda
 * pastki varaqa). Izohda «№ · market», maydonlar «Ism *» va «Telefon *» (`+998` o'zgarmaydi), ostida
 * eslatma: o'zgarish mijoz profiliga yoziladi.
 *
 * Saqlash — `PATCH /users/:id` (faqat superadmin/admin; tugma ruxsatini sahifa boshqaradi), keyin
 * buyurtmalar keshi yangilanadi. Hech narsa o'zgarmagan bo'lsa so'rovsiz yopiladi.
 */

type FieldKey = "name" | "phone";

type CustomerDialogProps = Omit<EditDialogProps, "order"> & { order: EditDialogOrder };

const CustomerDialog = ({ open, order, onClose, onSaved }: CustomerDialogProps) => {
  const { t } = useTranslation(["newOrders", "orders", "common"]);
  const { updateUser } = useUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerFormState>(() => seedCustomerForm(order));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const locked = isOrderSentToBranch(order);
  const customerId = order.customer?.id ? String(order.customer.id) : null;
  const subtitle = formatDialogSubtitle(order.id, readMarketName(order.market));

  const update = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || locked) return;

    const rulesInput = toCustomerRulesInput(form);
    const validationError = getCustomerUpdateValidationError(rulesInput);
    if (validationError) {
      const key: FieldKey = validationError === "name" ? "name" : "phone";
      setErrors({ [key]: t(CUSTOMER_ERROR_KEYS[validationError]) });
      (key === "name" ? nameRef : phoneRef).current?.focus();
      return;
    }

    const data = buildCustomerUpdatePayload(order, rulesInput);
    if (!Object.keys(data).length) {
      onClose();
      return;
    }
    // Mijozsiz buyurtma (id kelmagan) — saqlab bo'lmaydi; jim qolmasin.
    if (!customerId) {
      notifySaveError(null);
      return;
    }

    setSaving(true);
    try {
      await updateUser.mutateAsync({ id: customerId, data });
      // Mijoz nomi/telefoni buyurtma javobida — sahifa va ro'yxatlar qayta so'raladi (kutilmaydi).
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      notifySaved("newOrders:editDialog.customerSaved", formatDialogSubtitle(order.id, data.name ?? order.customer?.name));
      onSaved?.();
      onClose();
    } catch (error) {
      notifySaveError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      // Maket 460 px: `sm` (440) ustidan aniq kenglik — telefonda varaqa to'liq enli qoladi.
      size="sm"
      className="md:max-w-[460px]"
      title={t("editCustomer")}
      description={subtitle}
      icon={User}
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" loading={saving} disabled={locked}>
            {t("save", { ns: "common" })}
          </Button>
        </>
      }
    >
      {locked ? <DialogNote icon={Lock}>{t("destinationLockReason")}</DialogNote> : null}
      <Field label={t("name")} required error={errors.name} disabled={locked}>
        <TextInput
          ref={nameRef}
          value={form.name}
          onValueChange={(value) => update("name", value)}
          placeholder={t("customerNamePlaceholder")}
          autoComplete="off"
        />
      </Field>
      <Field label={t("phone")} required error={errors.phone} disabled={locked}>
        <TextInput ref={phoneRef} mode="phone" value={form.phone} onValueChange={(value) => update("phone", value)} />
      </Field>
      <DialogNote icon={Info}>{t("editDialog.customerNote")}</DialogNote>
    </Dialog>
  );
};

/**
 * Mijoz ma'lumotini tahrirlash oynasi.
 *
 *   <EditCustomerDialog open={isCustomerOpen} order={order} onClose={() => setCustomerOpen(false)} />
 */
export const EditCustomerDialog = memo(({ open, order, onClose, onSaved }: EditDialogProps) => {
  const session = useEditDialogSession(open, order);
  if (!session.order) return null;
  return (
    <CustomerDialog key={session.session} open={session.open} order={session.order} onClose={onClose} onSaved={onSaved} />
  );
});

EditCustomerDialog.displayName = "EditCustomerDialog";
