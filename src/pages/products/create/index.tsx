// dizayn-v2: superadmin-products-create, admin-products-create, manager-products-create, registrator-products-create, superadmin-products-create-errors, admin-products-create-errors, manager-products-create-errors, registrator-products-create-errors
import { memo, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Store, Tag, Trash2, TriangleAlert } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../entities/product";
import { ProductThumb } from "../../../entities/product/ui/ProductThumb";
import { useMarkets } from "../../../entities/markets";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { isInactiveMarketStatus, unwrapMarketPayload } from "../../../shared/lib/marketStatus";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  TextInput,
  TONE_SOFT,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { describeProductError, isDuplicateNameError } from "../model/productErrors";
import {
  appendProductMeasure,
  EMPTY_PRODUCT_FORM,
  toProductMeasureForm,
  type ProductFormValues,
} from "../model/productMeasure";
import {
  getProductImageUrl,
  getProductList,
  getProductMarketName,
  getProductMeta,
  isPriceInputValid,
  toPriceInput,
  type Product,
} from "../model/productView";
import { usePickedImage } from "../model/usePickedImage";
import { FormErrorSummary } from "../ui/FormErrorSummary";
import { ProductImageField } from "../ui/ProductImageField";
import { ProductBillable } from "../ui/ProductMeasureCells";
import { ProductMeasureFields } from "../ui/ProductMeasureFields";
import { ProductPrice } from "../ui/ProductPrice";
import { ProductPriceField } from "../ui/ProductPriceField";
import { useDeleteProductConfirm } from "../ui/useDeleteProductConfirm";

const EMPTY_FORM: ProductFormValues = EMPTY_PRODUCT_FORM;

/**
 * O'ng ro'yxat — sahifalashsiz (maket «Jami N ta»), bitta so'rovda hammasi: `limit` bermasak server 10 tasini
 * berardi va 11-mahsulot ko'rinmasdi (3qDsJpfW); 500 — server chegarasi.
 */
const LIST_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

/** «Narx» katagi (jadval va karta). */
const priceCell = (product: Product) => <ProductPrice product={product} />;

/**
 * MAHSULOT YARATISH — `/products/create-product/:id` (`:id` — market), dizayn v2. Faqat xodim (superadmin, admin,
 * menejer, registrator — `canCreateProducts`); market va market operatori mahsulot yaratmaydi (MH-1).
 *
 * Maketlar: `superadmin-products-create` (= admin, menejer, registrator), `*-products-create-errors`.
 * «← Mahsulotlar», sarlavha «Yangi mahsulot» + market nomi. Ikki ustun (telefonda ustma-ust): chapda forma
 * («Mahsulot ma'lumotlari»: nom, «Narx» — ixtiyoriy, `mode="money"`, «Og'irlik va o'lcham» — og'irlik + U × K × B
 * majburiy, «Hajmga qarab hisoblash», jonli hisob vazni va «Taxminiy yetkazish narxi» (6FLyjO6j), rasm «Mahsulot
 * rasmi»; «Tozalash» / «Saqlash»; «Saqlash» bosilganda xato maydon bo'lsa tepada «Saqlab bo'lmadi · N ta maydonda
 * xato»), o'ngda ro'yxat («Market mahsulotlari» + «N ta»; «# · Mahsulot nomi · hisob vazni · Narx», o'lchovsiz —
 * «Kiritilmagan»): qalam — mahsulot formada tahrirlanadi («Bekor qilish» tahrirdan chiqadi), savat — o'chirish tasdig'i.
 *
 * Xulq: FormData `name` + `market_id` (yangi mahsulotda) + `price` (yangi — kiritilgan bo'lsa; tahrir — o'zgargan
 * bo'lsa, bo'sh — narx tozalanadi) + o'lchov (yangi — `weight_kg`, `length_cm`, `width_cm`, `height_cm`,
 * `volumetric_enabled`; tahrir — faqat o'zgarganlari, U / K / B uchalasi birga) + tanlangan `image`; tahrir —
 * `PATCH product/:id`; nofaol market — ogohlantirish,
 * maydonlar va «Saqlash» o'chiq, yuborilsa `notify.warning`. Ro'yxat: `GET product/market/:id`. Xato — i18n izoh
 * (xom backend matni ko'rsatilmaydi); 409 (shu nomli mahsulot bor) — «Mahsulot nomi» maydoni ostida.
 */
const CreateProductPage = () => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [picked, pick] = usePickedImage();
  const confirmDelete = useDeleteProductConfirm();

  const { createProduct, updateProduct, useGetByMarketId } = useProducts();
  const { id } = useParams<{ id: string }>();
  const effectiveMarketId = id ?? "";

  // ─── Ro'yxat va market ───────────────────────────────────────────────────────
  // Xato ro'yxat kartasida (`ErrorState`) — global xabar takrorlanmaydi.
  const listQuery = useGetByMarketId(effectiveMarketId || undefined, true, LIST_PARAMS, { silentError: true });
  const listResponse = listQuery.data;
  const rows = useMemo(() => (listResponse === undefined ? undefined : getProductList(listResponse)), [listResponse]);
  const listTotal = getProductMeta(listResponse, { page: 1, limit: PRODUCT_LIST_MAX_LIMIT })?.total;

  const { useGetMarketById } = useMarkets();
  const { data: selectedMarketData, isLoading: isMarketStatusLoading } = useGetMarketById(
    Number(effectiveMarketId),
    Boolean(effectiveMarketId),
  );
  const selectedMarket = unwrapMarketPayload<{ status?: string | null; name?: string | null }>(selectedMarketData);
  const isInactiveMarket = isInactiveMarketStatus(selectedMarket?.status);
  const marketName: string | null =
    selectedMarket?.name?.trim() || (rows?.length ? getProductMarketName(rows[0]) : null);

  // ─── Forma ───────────────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitted, dirtyFields },
  } = useForm<ProductFormValues>({ defaultValues: EMPTY_FORM });

  const isPending = createProduct.isPending || updateProduct.isPending;
  const blocked = isMarketStatusLoading || isInactiveMarket;

  const resetForm = useCallback(() => {
    setEditTarget(null);
    reset(EMPTY_FORM);
    pick(null);
  }, [pick, reset]);

  const handleEdit = useCallback(
    (product: Product) => {
      setEditTarget(product);
      reset({ name: product.name, price: toPriceInput(product), ...toProductMeasureForm(product, language) });
      pick(null);
      // Telefonda forma ro'yxatdan yuqorida — fokus nom maydoniga (ko'rinishga ham shu olib keladi).
      window.requestAnimationFrame(() => setFocus("name"));
    },
    [language, pick, reset, setFocus],
  );

  const handleDelete = useCallback(
    async (product: Product) => {
      if (!(await confirmDelete(product, getProductMarketName(product) ?? marketName))) return;
      if (editTarget?.id === product.id) resetForm();
      // `deleteProduct` faqat `[products]` ni yangilaydi — xodim ro'yxati (`["market", id, …]`) ham yangilansin.
      void queryClient.invalidateQueries({ queryKey: ["market"] });
      notify.success(t("deleteSuccess"));
    },
    [confirmDelete, editTarget?.id, marketName, queryClient, resetForm, t],
  );

  const onSubmit = handleSubmit(async (values) => {
    const { name, price } = values;
    if (isPending || isMarketStatusLoading) return;

    if (isInactiveMarket) {
      notify.warning(t("inactiveMarketCreateBlocked"));
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    if (!editTarget && effectiveMarketId) formData.append("market_id", effectiveMarketId);
    // Yangi mahsulot — narx kiritilgan bo'lsa; tahrir — o'zgargan bo'lsa (bo'sh satr — narxni tozalaydi).
    if (editTarget ? dirtyFields.price : price) formData.append("price", price);
    // O'lchov: yangi mahsulot — hammasi (backend majburiy qiladi); tahrir — faqat o'zgarganlari.
    appendProductMeasure(formData, values, editTarget ? dirtyFields : undefined);
    if (picked) formData.append("image", picked.file);

    try {
      if (editTarget) {
        await updateProduct.mutateAsync({ id: editTarget.id, data: formData });
        notify.success(t("updateSuccess"));
      } else {
        await createProduct.mutateAsync(formData);
        notify.success(t("createSuccess"));
      }
      resetForm();
    } catch (error) {
      // 409 — shu nomli mahsulot bor: qayta urinish yordam bermaydi, «Mahsulot nomi» qizil + tepadagi xulosa.
      if (isDuplicateNameError(error)) {
        setError("name", { type: "server", message: t("v2.errors.duplicateName") }, { shouldFocus: true });
        return;
      }
      notify.error(t(editTarget ? "updateError" : "createError"), { description: describeProductError(error, t) });
    }
  });

  // ─── Ro'yxat ustunlari ───────────────────────────────────────────────────────
  const actions = useCallback(
    (product: Product) => (
      <span className="flex shrink-0 items-center justify-end gap-1 max-md:gap-0">
        <IconButton
          size="sm"
          icon={Pencil}
          label={t("v2.list.editAria", { name: product.name })}
          aria-pressed={editTarget?.id === product.id}
          onClick={() => handleEdit(product)}
        />
        <IconButton
          size="sm"
          variant="danger"
          icon={Trash2}
          label={t("v2.list.deleteAria", { name: product.name })}
          onClick={() => void handleDelete(product)}
        />
      </span>
    ),
    [editTarget?.id, handleDelete, handleEdit, t],
  );

  // Nom (+ «Tahrirlanmoqda»; tor ekranda belgi nom ostiga o'tadi) — jadvalda rasm yonida, kartada rasm ostidagi ustunda.
  const nameLine = useCallback(
    (product: Product) => (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 font-semibold text-text wrap-break-word">{product.name}</span>
        {editTarget?.id === product.id ? (
          <Badge tone="info" size="sm" className="shrink-0">
            {t("v2.create.editing")}
          </Badge>
        ) : null}
      </span>
    ),
    [editTarget?.id, t],
  );

  // Jadval: nom ostida hisob vazni (maket «Mahsulot nomi · hisob vazni»: «0,2 kg · og'irlik bo'yicha» / «Kiritilmagan»).
  const nameCell = useCallback(
    (product: Product) => (
      <span className="flex min-w-0 items-center gap-3">
        <ProductThumb imageUrl={getProductImageUrl(product)} />
        <span className="flex min-w-0 flex-col gap-0.5">
          {nameLine(product)}
          <span className="flex text-[13px] text-text-muted">
            <ProductBillable product={product} layout="inline" emphasis={false} />
          </span>
        </span>
      </span>
    ),
    [nameLine],
  );

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: "index",
        header: t("v2.list.columns.index"),
        className: "w-16",
        cell: (_product, index) => <span className="font-semibold text-text-subtle">{index + 1}</span>,
      },
      { id: "name", header: t("v2.create.columns.nameWithBillable"), cell: nameCell },
      { id: "price", header: t("v2.list.columns.price"), align: "end", className: "w-[148px]", cell: priceCell },
      {
        id: "actions",
        header: <span className="sr-only">{t("v2.list.columns.actions")}</span>,
        className: "w-[104px]",
        cellClassName: "text-right",
        cell: actions,
      },
    ],
    [actions, nameCell, t],
  );

  // Telefon kartasi (maket `.el-list-item`, `/products` kartasi kabi): rasm tepaga tekislangan · ustun (nom
  // + «Tahrirlanmoqda», narx) · tahrirlash, o'chirish. Uzun nom 3–4 qatorga o'tsa ham rasm o'rtada suzib qolmaydi.
  const renderCard = useCallback(
    (product: Product) => (
      <div className="flex min-h-14 items-start gap-3 py-2.5 pl-4 pr-2 text-sm">
        <ProductThumb imageUrl={getProductImageUrl(product)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {nameLine(product)}
          <span className="flex flex-col items-start gap-1 text-[13px] text-text-muted">
            <span className="whitespace-nowrap">
              <ProductPrice product={product} />
            </span>
            <ProductBillable product={product} layout="inline" />
          </span>
        </span>
        {actions(product)}
      </div>
    ),
    [actions, nameLine],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const goBack = () => {
    // Ro'yxatdan kelingan bo'lsa — o'sha filtrlar bilan orqaga; havoladan ochilgan bo'lsa — ro'yxatga.
    if (location.key !== "default") navigate(-1);
    else navigate("/products");
  };

  const marketLabel = marketName ? (
    <span className="inline-flex items-center gap-2">
      <Store size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      {marketName}
    </span>
  ) : listQuery.isLoading || isMarketStatusLoading ? (
    <Skeleton width={128} height={14} className="inline-block align-middle" />
  ) : null;

  const formTitle = editTarget ? t("v2.create.formTitleEdit") : t("v2.create.formTitle");
  const count =
    listTotal !== undefined ? t("v2.create.count", { value: formatNumberLocalized(listTotal, { language }) }) : null;
  const errorCount = isSubmitted ? Object.keys(errors).length : 0;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={goBack}
        backLabel={t("v2.create.back")}
        title={t("v2.create.title")}
        description={marketLabel}
      />

      <div className="flex min-w-0 flex-wrap items-start gap-6 max-md:gap-4">
        <form onSubmit={onSubmit} noValidate className="min-w-0 flex-[1_1_400px]">
          <Card
            as="div"
            padding="none"
            title={formTitle}
            footer={
              <div className="flex w-full justify-end gap-3 max-md:grid max-md:grid-cols-2">
                <Button variant="secondary" onClick={resetForm} disabled={isPending}>
                  {editTarget ? t("v2.create.cancelEdit") : t("v2.create.clear")}
                </Button>
                <Button type="submit" loading={isPending} loadingText={t("v2.create.saving")} disabled={blocked}>
                  {t("v2.create.save")}
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-5 p-5 max-md:p-4">
              <FormErrorSummary count={errorCount} />
              {isInactiveMarket ? (
                <div
                  role="status"
                  className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
                >
                  <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
                  <span className="min-w-0 text-[13px] leading-[18px] text-text">
                    {t("inactiveMarketCreateBlocked")}
                  </span>
                </div>
              ) : null}
              <Controller
                control={control}
                name="name"
                rules={{ validate: (value) => value.trim().length > 0 || t("validationNameRequired") }}
                render={({ field }) => (
                  <Field id="product-name" label={t("v2.create.name")} required error={errors.name?.message}>
                    <TextInput
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t("v2.create.namePlaceholder")}
                      autoComplete="off"
                      disabled={blocked}
                      readOnly={isPending}
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
                    id="product-price"
                    name={field.name}
                    inputRef={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.price?.message}
                    disabled={blocked}
                    readOnly={isPending}
                  />
                )}
              />
              <ProductMeasureFields
                control={control}
                errors={errors}
                idPrefix="product"
                quoteVariant="list"
                disabled={blocked}
                readOnly={isPending}
              />
              <ProductImageField
                label={t("v2.create.image")}
                picked={picked}
                existingUrl={getProductImageUrl(editTarget)}
                onPick={pick}
                disabled={blocked || isPending}
              />
            </div>
          </Card>
        </form>

        <Card
          as="section"
          padding="none"
          title={t("v2.create.listTitle")}
          actions={count ? <Badge>{count}</Badge> : undefined}
          className="min-w-0 flex-[1_1_440px]"
        >
          <QueryBoundary
            query={{
              data: rows,
              isLoading: listQuery.isLoading,
              isError: listQuery.isError,
              error: listQuery.error,
              refetch: listQuery.refetch,
            }}
            loadingLabel={t("v2.create.listLoading")}
            loading={
              <SkeletonTable
                framed={false}
                columns={[t("v2.list.columns.index"), t("v2.create.columns.nameWithBillable"), t("v2.list.columns.price")]}
                rows={6}
              />
            }
            empty={<EmptyState icon={Tag} title={t("v2.create.empty")} description={t("v2.create.emptyDescription")} />}
            error={(error, retry) => <ErrorState error={error} title={t("v2.create.loadFailed")} onRetry={retry} />}
          >
            {(list, { isRefetching }) => (
              <DataTable
                rows={list}
                columns={columns}
                getRowKey={(product) => String(product.id)}
                label={t("v2.create.listTitle")}
                rowClassName={(product) => (editTarget?.id === product.id ? "bg-action-soft" : null)}
                renderCard={renderCard}
                busy={isRefetching}
              />
            )}
          </QueryBoundary>
        </Card>
      </div>
    </div>
  );
};

export default memo(CreateProductPage);
