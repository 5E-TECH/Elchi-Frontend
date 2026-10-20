// dizayn-v2: superadmin-products-edit-dialog, admin-products-edit-dialog, manager-products-edit-dialog, registrator-products-edit-dialog
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useProducts } from "../../../../entities/product";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { describeProductError } from "../../model/productErrors";
import {
  getProductImageUrl,
  getProductMarketName,
  getProductPayload,
  isPriceInputValid,
  toPriceInput,
  type Product,
} from "../../model/productView";
import { usePickedImage } from "../../model/usePickedImage";
import { FormErrorSummary } from "../../ui/FormErrorSummary";
import { ProductImageField } from "../../ui/ProductImageField";
import { ProductPriceField } from "../../ui/ProductPriceField";

type EditFormValues = { name: string; price: string };

export type EditProductDialogProps = {
  /** Tahrirlanayotgan mahsulot (`null` — oyna yopiq). */
  product: Product | null;
  onClose: () => void;
};

/**
 * MAHSULOTNI TAHRIRLASH — maket `*-products-edit-dialog` (faqat xodim: superadmin, admin, menejer, registrator):
 * `Dialog` md (telefonda pastki varaqa), `Pencil`, izoh — market nomi; «Mahsulot nomi *», «Narx» (ixtiyoriy,
 * `mode="money"`), «Mahsulot rasmi» (zona + oldindan ko'rish), «Bekor qilish» / «Saqlash». «Saqlash» bosilganda
 * xato maydon bo'lsa — tepada «Saqlab bo'lmadi · N ta maydonda xato» (maket `*-products-create-errors`).
 * «Og'irlik va o'lcham» bo'limi — maket taklifi (backend kerak, MH-2), chizilmaydi.
 *
 * Xulq: ochilganda `GET product/:id` (yangi rasm manzili), FormData `name` (+ `price` — faqat o'zgargan bo'lsa:
 * bo'sh — narx tozalanadi, backend `null`; + `image` fayl tanlangan bo'lsa) → `PATCH product/:id`; muvaffaqiyat —
 * «Mahsulot muvaffaqiyatli yangilandi» va oyna yopiladi, xato — i18n izoh bilan (xom backend matni emas). Market va
 * market operatori mahsulotni tahrirlamaydi (MH-1) — `PATCH product/my/:id` ishlatilmaydi.
 */
export const EditProductDialog = ({ product, onClose }: EditProductDialogProps) => {
  const { t } = useTranslation("products");
  // Yopilish harakati paytida ham oxirgi mahsulot ko'rinib tursin (oyna bo'shab qolmasin).
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);
  const target = product ?? shown;

  const { useGetProductById, updateProduct } = useProducts();
  const { data: detailResponse } = useGetProductById(product?.id, Boolean(product));
  const detail = getProductPayload(detailResponse);
  const [picked, pick] = usePickedImage();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitted, dirtyFields },
  } = useForm<EditFormValues>({ defaultValues: { name: product?.name ?? "", price: toPriceInput(product) } });

  // Har ochilishda forma shu mahsulot qiymatlari bilan qayta to'ladi (oldingi yozilgan, saqlanmagan matn qolmaydi).
  useEffect(() => {
    if (product) reset({ name: product.name, price: toPriceInput(product) });
  }, [product, reset]);

  const submit = handleSubmit(async ({ name, price }) => {
    if (!product) return;
    const formData = new FormData();
    formData.append("name", name.trim());
    // Narx faqat o'zgargan bo'lsa yuboriladi: kasrli eski narx (125000.50) bekorga yaxlitlanmasin.
    if (dirtyFields.price) formData.append("price", price);
    if (picked) formData.append("image", picked.file);

    try {
      await updateProduct.mutateAsync({ id: product.id, data: formData });
      notify.success(t("updateSuccess"));
      onClose();
    } catch (error) {
      notify.error(t("updateError"), { description: describeProductError(error, t) });
    }
  });

  const busy = updateProduct.isPending;
  const errorCount = isSubmitted ? Object.keys(errors).length : 0;

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      onExited={() => pick(null)}
      busy={busy}
      icon={Pencil}
      title={t("v2.edit.title")}
      description={getProductMarketName(detail ?? target) ?? undefined}
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
      <FormErrorSummary count={errorCount} />
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
      <Controller
        control={control}
        name="price"
        rules={{ validate: (value) => isPriceInputValid(value) || t("validationPriceTooLarge") }}
        render={({ field }) => (
          <ProductPriceField
            id="product-edit-price"
            name={field.name}
            inputRef={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.price?.message}
            readOnly={busy}
          />
        )}
      />
      <ProductImageField
        label={t("v2.edit.image")}
        picked={picked}
        existingUrl={getProductImageUrl(detail ?? target)}
        onPick={pick}
        disabled={busy}
      />
    </Dialog>
  );
};
