// dizayn-v2: superadmin-orders-detail-edit-address-dialog, admin-orders-edit-address-dialog, manager-orders-detail-edit-address-dialog, registrator-orders-detail-edit-address-dialog
import { memo, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Lock, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../../entities/orders";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../../shared/ui/primitives";
import {
  buildAddressUpdatePayload,
  getAddressUpdateValidationError,
  isOrderSentToBranch,
} from "../newOrderUpdateRules";
import { DialogNote } from "./DialogNote";
import {
  ADDRESS_ERROR_KEYS,
  formatDialogSubtitle,
  notifySaved,
  notifySaveError,
  seedAddressForm,
  type AddressFormState,
  type EditDialogOrder,
  type EditDialogProps,
} from "./editDialogModel";
import { useEditDialogSession } from "./useEditDialogSession";

/**
 * MANZILNI TAHRIRLASH (maket `*-orders-detail-edit-address-dialog`, 480 px; telefonda pastki varaqa).
 *
 * «Viloyat *» → «Tuman *» → «To'liq manzil». Viloyat almashsa tuman bo'shatiladi va ostida «Viloyat
 * o'zgargani uchun tumanni qayta tanlang.» chiqadi. Saqlash — `PATCH /orders/:id/full` (faqat o'zgargan
 * maydonlar, `buildAddressUpdatePayload`); hech narsa o'zgarmagan bo'lsa so'rovsiz yopiladi.
 * Filialga jo'natilgan buyurtmada maydonlar qulf (sahifa tugmani baribir o'chiradi).
 */

type NamedRow = { id?: unknown; name?: unknown };

/** API qatorlari → variantlar (`id` siz qator tashlanadi, nom bo'lmasa id ko'rsatiladi). */
const toOptions = (rows: unknown): SelectOption[] =>
  (Array.isArray(rows) ? (rows as NamedRow[]) : [])
    .filter((row) => row && row.id !== null && row.id !== undefined && row.id !== "")
    .map((row) => ({
      value: String(row.id),
      label: typeof row.name === "string" && row.name.trim() ? row.name : String(row.id),
    }));

/**
 * Joriy qiymat ro'yxatda hali yo'q bo'lsa (so'rov kelmagan) — buyurtmadagi nomi bilan qo'shiladi:
 * maydon ochilishi bilan «Samarqand viloyati» ni ko'rsatadi, namuna matnini emas.
 */
const withCurrent = (options: SelectOption[], id: string, name: string | null | undefined) =>
  !id || !name?.trim() || options.some((option) => option.value === id)
    ? options
    : [{ value: id, label: name.trim() }, ...options];

type LocationFieldsProps = {
  order: EditDialogOrder;
  form: AddressFormState;
  locked: boolean;
  regionChanged: boolean;
  errors: Partial<Record<"region" | "district", string>>;
  regionRef: RefObject<HTMLElement | null>;
  districtRef: RefObject<HTMLElement | null>;
  onRegionChange: (regionId: string) => void;
  onDistrictChange: (districtId: string) => void;
};

/** Viloyat va tuman — ro'yxat so'rovlari faqat oyna ochiq turganda (bu qism shu payt chiziladi). */
const LocationFields = ({
  order,
  form,
  locked,
  regionChanged,
  errors,
  regionRef,
  districtRef,
  onRegionChange,
  onDistrictChange,
}: LocationFieldsProps) => {
  const { t } = useTranslation(["newOrders", "orders"]);
  const { useGetRegions, useGetDistricts } = useLogistics();
  const regionsQuery = useGetRegions();
  const districtsQuery = useGetDistricts(form.region_id || undefined);
  const initial = useMemo(() => seedAddressForm(order), [order]);

  const regionOptions = useMemo(() => {
    const data = regionsQuery.data as { data?: unknown } | unknown[] | undefined;
    const rows = Array.isArray(data) ? data : (data as { data?: unknown } | undefined)?.data;
    return withCurrent(
      toOptions(rows),
      initial.region_id,
      order.district?.region?.name ?? order.region?.name,
    );
  }, [initial.region_id, order, regionsQuery.data]);

  const districtOptions = useMemo(
    () =>
      withCurrent(
        toOptions(districtsQuery.data),
        form.region_id === initial.region_id ? initial.district_id : "",
        order.district?.name,
      ),
    [districtsQuery.data, form.region_id, initial.district_id, initial.region_id, order],
  );

  // Qulflangan buyurtmada sabab oyna tepasida (`DialogNote`) — maydon ostida takrorlanmaydi.
  const reselectHint = regionChanged && !form.district_id ? t("editDialog.districtReselectHint") : undefined;

  return (
    <>
      <Field label={t("region")} labelAs="span" required error={errors.region} disabled={locked}>
        <Select
          ref={regionRef}
          options={regionOptions}
          value={form.region_id || null}
          onChange={(value) => onRegionChange(value ?? "")}
          placeholder={t("selectRegion")}
          loading={regionsQuery.isLoading}
        />
      </Field>
      <Field
        label={t("district")}
        labelAs="span"
        required
        error={errors.district}
        hint={reselectHint}
        hintLive
        disabled={locked}
      >
        <Select
          ref={districtRef}
          options={districtOptions}
          value={form.district_id || null}
          onChange={(value) => onDistrictChange(value ?? "")}
          placeholder={form.region_id ? t("selectDistrict") : t("selectRegionFirst")}
          noOptionsText={form.region_id ? undefined : t("selectRegionFirst")}
          loading={Boolean(form.region_id) && districtsQuery.isLoading}
        />
      </Field>
    </>
  );
};

type AddressDialogProps = Omit<EditDialogProps, "order"> & { order: EditDialogOrder };

const AddressDialog = ({ open, order, onClose, onSaved }: AddressDialogProps) => {
  const { t } = useTranslation(["newOrders", "orders", "common"]);
  const { updateNewOrder } = useOrders();
  const [form, setForm] = useState<AddressFormState>(() => seedAddressForm(order));
  const [errors, setErrors] = useState<Partial<Record<"region" | "district", string>>>({});
  const [regionChanged, setRegionChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const districtRef = useRef<HTMLElement>(null);
  const locked = isOrderSentToBranch(order);
  const subtitle = formatDialogSubtitle(order.id, order.customer?.name);

  const handleRegionChange = (regionId: string) => {
    if (regionId === form.region_id) return;
    setForm((prev) => ({ ...prev, region_id: regionId, district_id: "" }));
    setRegionChanged(true);
    setErrors((prev) => ({ ...prev, region: undefined }));
  };

  const handleDistrictChange = (districtId: string) => {
    setForm((prev) => ({ ...prev, district_id: districtId }));
    setErrors((prev) => ({ ...prev, district: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || locked) return;

    const validationError = getAddressUpdateValidationError(form);
    if (validationError) {
      setErrors({ [validationError]: t(ADDRESS_ERROR_KEYS[validationError]) });
      (validationError === "region" ? regionRef : districtRef).current?.focus();
      return;
    }

    const data = buildAddressUpdatePayload(order, form);
    if (!Object.keys(data).length) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateNewOrder.mutateAsync({ orderId: String(order.id), data });
      notifySaved("newOrders:editDialog.addressSaved", subtitle);
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
      size="md"
      title={t("editAddress")}
      description={subtitle}
      icon={MapPin}
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
      <LocationFields
        order={order}
        form={form}
        locked={locked}
        regionChanged={regionChanged}
        errors={errors}
        regionRef={regionRef}
        districtRef={districtRef}
        onRegionChange={handleRegionChange}
        onDistrictChange={handleDistrictChange}
      />
      <Field label={t("fullAddress")} disabled={locked}>
        <TextInput
          value={form.address}
          onValueChange={(address) => setForm((prev) => ({ ...prev, address }))}
          placeholder={t("enterAddress")}
          autoComplete="street-address"
        />
      </Field>
    </Dialog>
  );
};

/**
 * Manzilni tahrirlash oynasi.
 *
 *   <EditAddressDialog open={isAddressOpen} order={order} onClose={() => setAddressOpen(false)} />
 *
 * Har ochilishda forma buyurtmadan qayta to'ldiriladi; so'rov, xato/natija xabari — oyna ichida.
 */
export const EditAddressDialog = memo(({ open, order, onClose, onSaved }: EditDialogProps) => {
  const session = useEditDialogSession(open, order);
  if (!session.order) return null;
  return (
    <AddressDialog key={session.session} open={session.open} order={session.order} onClose={onClose} onSaved={onSaved} />
  );
});

EditAddressDialog.displayName = "EditAddressDialog";
