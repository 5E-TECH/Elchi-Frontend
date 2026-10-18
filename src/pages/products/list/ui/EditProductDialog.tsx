// dizayn-v2: superadmin-products-edit-dialog, admin-products-edit-dialog, manager-products-edit-dialog, registrator-products-edit-dialog, market-products-edit-dialog
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useProducts } from "../../../../entities/product";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { getProductImageUrl, getProductMarketName, getProductPayload, type Product } from "../../model/productView";
import { usePickedImage } from "../../model/usePickedImage";
import { ProductImageField } from "../../ui/ProductImageField";

type EditFormValues = { name: string };

export type EditProductDialogProps = {
  /** Tahrirlanayotgan mahsulot (`null` — oyna yopiq). */
  product: Product | null;
  /** Market roli: izoh (market nomi) yo'q, yorliq «Mahsulot rasmi», so'rov `PATCH product/my/:id`. */
  isMarketRole: boolean;
  onClose: () => void;
};

/**
 * MAHSULOTNI TAHRIRLASH — maket `*-products-edit-dialog` (`market-products-edit-dialog`): `Dialog` md (telefonda
 * pastki varaqa), `Pencil`, izoh — market nomi (market rolida yo'q); «Mahsulot nomi *», «Rasm» / «Mahsulot rasmi»
 * (zona + oldindan ko'rish), «Bekor qilish» / «Saqlash».
 *
 * Xulq (avvalgidek): ochilganda `GET product/:id` (yangi rasm manzili), FormData `name` (+ `image` fayl tanlangan
 * bo'lsa); muvaffaqiyat — «Mahsulot muvaffaqiyatli yangilandi» va oyna yopiladi, xato — backend matni bilan.
 * So'rov: xodim — `PATCH product/:id`, market — `PATCH product/my/:id` (backend `PATCH :id` ga marketni
 * qo'ymaydi; yaratish sahifasidagi tahrir ham shunday).
 */
export const EditProductDialog = ({ product, isMarketRole, onClose }: EditProductDialogProps) => {
  const { t } = useTranslation("products");
  // Yopilish harakati paytida ham oxirgi mahsulot ko'rinib tursin (oyna bo'shab qolmasin).
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);
  const target = product ?? shown;

  const { useGetProductById, updateProduct, updateMyProduct } = useProducts();
  const mutation = isMarketRole ? updateMyProduct : updateProduct;
  const { data: detailResponse } = useGetProductById(product?.id, Boolean(product));
  const detail = getProductPayload(detailResponse);
  const [picked, pick] = usePickedImage();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({ defaultValues: { name: product?.name ?? "" } });

  // Har ochilishda forma shu mahsulot nomi bilan qayta to'ladi (oldingi yozilgan, saqlanmagan matn qolmaydi).
  useEffect(() => {
    if (product) reset({ name: product.name });
  }, [product, reset]);

  const submit = handleSubmit(async ({ name }) => {
    if (!product) return;
    const productName = name.trim();
    const formData = new FormData();
    formData.append("name", productName);
    if (picked) formData.append("image", picked.file);

    try {
      await mutation.mutateAsync({ id: product.id, data: formData });
      notify.success(t("updateSuccess"));
      onClose();
    } catch (error) {
      notify.error(t("updateError"), { description: getBackendErrorMessage(error) });
    }
  });

  const busy = mutation.isPending;

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      onExited={() => pick(null)}
      busy={busy}
      icon={Pencil}
      title={t("v2.edit.title")}
      description={isMarketRole ? undefined : (getProductMarketName(detail ?? target) ?? undefined)}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("v2.edit.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("v2.edit.saving")}>
            {t("v2.edit.save")}
          </Button>
        </>
      }
    >
      <Controller
        control={control}
        name="name"
        rules={{ validate: (value) => value.trim().length > 0 || t("validationNameRequired") }}
        render={({ field }) => (
          <Field label={t("v2.edit.name")} required error={errors.name?.message}>
            <TextInput
              name={field.name}
              ref={field.ref}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={t("v2.edit.namePlaceholder")}
              autoComplete="off"
              readOnly={busy}
            />
          </Field>
        )}
      />
      <ProductImageField
        label={isMarketRole ? t("v2.edit.imageMarket") : t("v2.edit.image")}
        picked={picked}
        existingUrl={getProductImageUrl(detail ?? target)}
        onPick={pick}
        disabled={busy}
      />
    </Dialog>
  );
};
