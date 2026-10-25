// dizayn-v2: superadmin-products-edit-dialog, admin-products-edit-dialog, manager-products-edit-dialog, registrator-products-edit-dialog, superadmin-products-edit-dialog-barcode
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useProducts } from "../../../../entities/product";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { describeProductError, isDuplicateNameError } from "../../model/productErrors";
import {
  appendProductMeasure,
  getProductMeasureView,
  toProductMeasureForm,
  type ProductFormValues,
} from "../../model/productMeasure";
import {
  getProductImageUrl,
  getProductMarketName,
  getProductPayload,
  isPriceInputValid,
  toPriceInput,
  type Product,
} from "../../model/productView";
import { usePickedImage } from "../../model/usePickedImage";
import { appendProductBarcode, checkBarcodeInput, isDuplicateBarcodeError } from "../../model/productCode";
import { useBarcodeCamera } from "../../model/useBarcodeCamera";
import { FormErrorSummary } from "../../ui/FormErrorSummary";
import { ProductCodeSection } from "../../ui/ProductCodeSection";
import { ProductImageField } from "../../ui/ProductImageField";
import { ProductMeasureFields } from "../../ui/ProductMeasureFields";
import { ProductPriceField } from "../../ui/ProductPriceField";

/** Forma qiymatlari — mahsulot qatoridan (ro'yxat javobida o'lchov ham bor, MH-3). */
const toFormValues = (product: Product | null, language?: string | null): ProductFormValues => ({
  name: product?.name ?? "",
  price: toPriceInput(product),
  ...toProductMeasureForm(product, language),
});

export type EditProductDialogProps = {
  /** Tahrirlanayotgan mahsulot (`null` — oyna yopiq). */
  product: Product | null;
  onClose: () => void;
};

/**
 * MAHSULOTNI TAHRIRLASH — maket `*-products-edit-dialog` (faqat xodim: superadmin, admin, menejer, registrator):
 * `Dialog` md (telefonda pastki varaqa), `Pencil`, izoh — market nomi; «Mahsulot nomi *», «Narx» (ixtiyoriy,
 * `mode="money"`), «Og'irlik va o'lcham» (yaratish sahifasi bilan AYNI maydonlar — 6FLyjO6j; narx — uchta katak),
 * «Mahsulot rasmi» (zona + oldindan ko'rish), «Bekor qilish» / «Saqlash». «Saqlash» bosilganda xato maydon bo'lsa —
 * tepada «Saqlab bo'lmadi · N ta maydonda xato» (maket `*-products-create-errors`).
 *
 * Xulq: ochilganda `GET product/:id` (yangi rasm manzili), FormData `name` (+ `price` — faqat o'zgargan bo'lsa:
 * bo'sh — narx tozalanadi, backend `null`; + o'lchov — faqat o'zgargan maydonlar, U / K / B uchalasi birga, shuning
 * uchun saqlangan o'lchov o'chib ketmaydi; o'lchovsiz eski mahsulotda o'lchov ixtiyoriy — bo'sh maydon yuborilmaydi; + `image` fayl tanlangan bo'lsa) → `PATCH product/:id`; muvaffaqiyat —
 * «Mahsulot muvaffaqiyatli yangilandi» va oyna yopiladi, xato — i18n izoh bilan (xom backend matni emas), 409 (nom band) —
 * «Mahsulot nomi» maydoni ostida. Market va market operatori mahsulotni tahrirlamaydi (MH-1) — `PATCH product/my/:id` ishlatilmaydi.
 */
export const EditProductDialog = ({ product, onClose }: EditProductDialogProps) => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  // Yopilish harakati paytida ham oxirgi mahsulot ko'rinib tursin (oyna bo'shab qolmasin).
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);
  const target = product ?? shown;

  const { useGetProductById, updateProduct } = useProducts();
  const { data: detailResponse } = useGetProductById(product?.id, Boolean(product));
  const detail = getProductPayload(detailResponse);
  const [picked, pick] = usePickedImage();
  // yXC91RRx: «Mahsulot kodi» — zavod shtrix kodi (forma tashqarisida; har ochilishda mahsulotdagi qiymat).
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeFor, setBarcodeFor] = useState<number | null>(null);
  if (product && barcodeFor !== product.id) {
    setBarcodeFor(product.id);
    setBarcode(product.barcode ?? "");
    setBarcodeError(null);
  }
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitted, dirtyFields },
  } = useForm<ProductFormValues>({ defaultValues: toFormValues(product, language) });

  // Har ochilishda forma shu mahsulot qiymatlari bilan qayta to'ladi (oldingi yozilgan, saqlanmagan matn qolmaydi).
  // Til almashsa qayta to'ldirilmaydi (yozilgan matn yo'qolmasin) — til ochilish paytidagisi.
  useEffect(() => {
    if (product) reset(toFormValues(product, i18n.resolvedLanguage ?? i18n.language));
  }, [i18n, product, reset]);

  const submit = handleSubmit(async (values) => {
    const { name, price } = values;
    // Enter bilan takroriy yuborish (tugma `loading` bo'lsa ham) — ikkinchi PATCH ketmasin.
    if (!product || updateProduct.isPending) return;
    const barcodeIssue = checkBarcodeInput(barcode);
    if (barcodeIssue) {
      setBarcodeError(t(`productCode.errors.${barcodeIssue}`, { ns: "warehouses" }));
      return;
    }
    const formData = new FormData();
    formData.append("name", name.trim());
    // Narx faqat o'zgargan bo'lsa yuboriladi: kasrli eski narx (125000.50) bekorga yaxlitlanmasin.
    if (dirtyFields.price) formData.append("price", price);
    // O'lchov — faqat o'zgargani (o'zgarmagan / bo'sh maydon yuborilmaydi — backend 400 bermasin, qiymat o'chmasin).
    appendProductMeasure(formData, values, dirtyFields);
    appendProductBarcode(formData, barcode, product.barcode);
    if (picked) formData.append("image", picked.file);

    try {
      await updateProduct.mutateAsync({ id: product.id, data: formData });
      notify.success(t("updateSuccess"));
      onClose();
    } catch (error) {
      // 409 «… shtrix kod … biriktirilgan» — kod shu marketning boshqa mahsulotida (nom dublikati emas).
      if (isDuplicateBarcodeError(error)) {
        setBarcodeError(t("productCode.errors.duplicate", { ns: "warehouses" }));
        return;
      }
      // 409 — shu marketda shu nomli mahsulot bor: «Mahsulot nomi» qizil + tepadagi xulosa (qayta urinish foydasiz).
      if (isDuplicateNameError(error)) {
        setError("name", { type: "server", message: t("v2.errors.duplicateName") }, { shouldFocus: true });
        return;
      }
      notify.error(t("updateError"), { description: describeProductError(error, t) });
    }
  });

  const busy = updateProduct.isPending;
  const changeBarcode = (value: string) => {
    setBarcode(value);
    setBarcodeError(null);
  };
  // CO66kcoB: «Shtrix kod» maydoni — kamera (zavod EAN/UPC/Code128 yoki QR), kod maydonga yoziladi.
  const openBarcodeCamera = useBarcodeCamera({
    enabled: Boolean(product) && !busy,
    productName: (detail ?? target)?.name ?? "",
    onCode: changeBarcode,
  });
  // O'lchovsiz (yoki chala o'lchovli) eski mahsulot — o'lchov ixtiyoriy, bo'sh qoldirib saqlanadi (ega qarori 2026-10-24).
  const measureOptional = target ? !getProductMeasureView(target).complete : false;
  const errorCount = isSubmitted ? Object.keys(errors).length : 0;

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      onExited={() => pick(null)}
      busy={busy}
      icon={Pencil}
      size="lg"
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
      <ProductMeasureFields
        control={control}
        errors={errors}
        idPrefix="product-edit"
        quoteVariant="tiles"
        readOnly={busy}
        optional={measureOptional}
      />
      <ProductCodeSection
        barcode={barcode}
        onBarcodeChange={changeBarcode}
        barcodeError={barcodeError}
        skuCode={(detail ?? target)?.sku_code ?? null}
        productName={(detail ?? target)?.name ?? ""}
        marketName={getProductMarketName(detail ?? target) ?? null}
        readOnly={busy}
        onCamera={openBarcodeCamera}
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
