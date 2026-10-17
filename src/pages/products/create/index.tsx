// dizayn-v2: superadmin-products-create, admin-products-create, manager-products-create, registrator-products-create, market-products-create
import { memo, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Store, Tag, Trash2, TriangleAlert } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useProducts } from "../../../entities/product";
import { useMarkets } from "../../../entities/markets";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
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
import { PRODUCT_LIST_MAX_LIMIT, useMarketProductsList, useMyProductsList } from "../model/productQueries";
import { getProductImageUrl, getProductList, getProductMarketName, getProductMeta, type Product } from "../model/productView";
import { usePickedImage } from "../model/usePickedImage";
import { ProductImageField } from "../ui/ProductImageField";
import { ProductThumb } from "../ui/ProductThumb";
import { useDeleteProductConfirm } from "../ui/useDeleteProductConfirm";

type CreateFormValues = { name: string };

/** O'ng ro'yxat — sahifalashsiz (maket), bitta so'rovda hammasi. */
const LIST_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

/**
 * MAHSULOT YARATISH — `/products/create-product/:id` (`:id` — market), dizayn v2.
 *
 * Maketlar: `superadmin-products-create` (= admin, menejer, registrator), `market-products-create`.
 * «← Mahsulotlar», sarlavha: xodim «Yangi mahsulot» + market nomi, market «Mahsulot yaratish» + «Tanlangan market: …».
 * Ikki ustun (telefonda ustma-ust): chapda forma («Mahsulot ma'lumotlari» / market «Yangi mahsulot»: nom, rasm;
 * «Tozalash» / «Saqlash»), o'ngda ro'yxat («Market mahsulotlari» + «N ta» / market «Mavjud mahsulotlar» + izoh +
 * «Jami N ta»): qalam — mahsulot formada tahrirlanadi («Bekor qilish» tahrirdan chiqadi), savat — o'chirish tasdig'i.
 *
 * Xulq (avvalgidek): FormData `name` + xodimda `market_id` (yangi mahsulotda) + tanlangan `image`; tahrir — xodim
 * `PATCH product/:id`, market `PATCH product/my/:id`; nofaol market — ogohlantirish, maydonlar va «Saqlash» o'chiq,
 * yuborilsa `notify.warning`. Ro'yxat: xodim `GET product/market/:id`, market `GET product/my-products`.
 */
const CreateProductPage = () => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const roleState = useSelector((state: RootState) => state.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const isMarketRole = roleState.role === "market";
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [picked, pick] = usePickedImage();
  const confirmDelete = useDeleteProductConfirm();

  const { createProduct, updateProduct, updateMyProduct } = useProducts();
  const { id } = useParams<{ id: string }>();
  const marketIdFromState = roleState.id ?? profile?.id;
  const effectiveMarketId = id ?? (marketIdFromState ? String(marketIdFromState) : "");

  // ─── Ro'yxat va market ───────────────────────────────────────────────────────
  const marketListQuery = useMarketProductsList(effectiveMarketId || undefined, LIST_PARAMS, !isMarketRole);
  const myListQuery = useMyProductsList(LIST_PARAMS, isMarketRole);
  const listQuery = isMarketRole ? myListQuery : marketListQuery;
  const listResponse = listQuery.data;
  const rows = useMemo(() => (listResponse === undefined ? undefined : getProductList(listResponse)), [listResponse]);
  const listTotal = getProductMeta(listResponse, { page: 1, limit: PRODUCT_LIST_MAX_LIMIT })?.total;

  const { useGetMarketById } = useMarkets();
  const { data: selectedMarketData, isLoading: isMarketStatusLoading } = useGetMarketById(
    Number(effectiveMarketId),
    !isMarketRole && Boolean(effectiveMarketId),
  );
  const selectedMarket = unwrapMarketPayload<{ status?: string | null; name?: string | null }>(selectedMarketData);
  const selectedMarketStatus = isMarketRole ? profile?.status : selectedMarket?.status;
  const isInactiveMarket = isInactiveMarketStatus(selectedMarketStatus);
  const marketName: string | null = isMarketRole
    ? (profile?.name ?? roleState.name ?? null)
    : (selectedMarket?.name?.trim() || (rows?.length ? getProductMarketName(rows[0]) : null));

  // ─── Forma ───────────────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<CreateFormValues>({ defaultValues: { name: "" } });

  const isPending = createProduct.isPending || updateProduct.isPending || updateMyProduct.isPending;
  const blocked = isMarketStatusLoading || isInactiveMarket;

  const resetForm = useCallback(() => {
    setEditTarget(null);
    reset({ name: "" });
    pick(null);
  }, [pick, reset]);

  const handleEdit = useCallback(
    (product: Product) => {
      setEditTarget(product);
      reset({ name: product.name });
      pick(null);
      // Telefonda forma ro'yxatdan yuqorida — fokus nom maydoniga (ko'rinishga ham shu olib keladi).
      window.requestAnimationFrame(() => setFocus("name"));
    },
    [pick, reset, setFocus],
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

  const onSubmit = handleSubmit(async ({ name }) => {
    if (isPending || isMarketStatusLoading) return;

    if (isInactiveMarket) {
      notify.warning(t("inactiveMarketCreateBlocked"));
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    if (!editTarget && !isMarketRole && effectiveMarketId) {
      formData.append("market_id", effectiveMarketId);
    }
    if (picked) formData.append("image", picked.file);

    try {
      if (editTarget) {
        const mutation = isMarketRole ? updateMyProduct : updateProduct;
        await mutation.mutateAsync({ id: editTarget.id, data: formData });
        notify.success(t("updateSuccess"));
      } else {
        await createProduct.mutateAsync(formData);
        notify.success(t("createSuccess"));
      }
      resetForm();
    } catch (error) {
      notify.error(t(editTarget ? "updateError" : "createError"), {
        description: getBackendErrorMessage(error),
      });
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

  const nameCell = useCallback(
    (product: Product) => (
      <span className="flex min-w-0 items-center gap-3">
        <ProductThumb product={product} />
        {/* Tor ekranda «Tahrirlanmoqda» belgisi nom ostiga o'tadi. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-semibold text-text wrap-break-word">{product.name}</span>
          {editTarget?.id === product.id ? (
            <Badge tone="info" size="sm" className="shrink-0">
              {t("v2.create.editing")}
            </Badge>
          ) : null}
        </span>
      </span>
    ),
    [editTarget?.id, t],
  );

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: "index",
        header: t("v2.list.columns.index"),
        className: "w-16",
        cell: (_product, index) => <span className="font-semibold text-text-subtle">{index + 1}</span>,
      },
      { id: "name", header: t("v2.list.columns.name"), cell: nameCell },
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

  const renderCard = useCallback(
    (product: Product) => (
      <div className="flex min-h-14 items-center gap-3 py-2 pl-4 pr-2 text-sm">
        <span className="min-w-0 flex-1">{nameCell(product)}</span>
        {actions(product)}
      </div>
    ),
    [actions, nameCell],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const goBack = () => {
    // Ro'yxatdan kelingan bo'lsa — o'sha filtrlar bilan orqaga; havoladan ochilgan bo'lsa — ro'yxatga.
    if (location.key !== "default") navigate(-1);
    else navigate("/products");
  };

  const marketLabel = marketName ? (
    isMarketRole ? (
      <>
        {t("v2.create.selectedMarket")} <span className="font-semibold text-text">{marketName}</span>
      </>
    ) : (
      <span className="inline-flex items-center gap-2">
        <Store size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        {marketName}
      </span>
    )
  ) : listQuery.isLoading || isMarketStatusLoading ? (
    <Skeleton width={128} height={14} className="inline-block align-middle" />
  ) : null;

  const formTitle = editTarget
    ? t("v2.create.formTitleEdit")
    : isMarketRole
      ? t("v2.create.formTitleMarket")
      : t("v2.create.formTitle");

  const count =
    listTotal !== undefined
      ? t(isMarketRole ? "v2.create.countMarket" : "v2.create.count", {
          value: formatNumberLocalized(listTotal, { language }),
        })
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={goBack}
        backLabel={t("v2.create.back")}
        title={isMarketRole ? t("v2.create.titleMarket") : t("v2.create.title")}
        description={marketLabel}
      />

      <div className="flex min-w-0 flex-wrap items-start gap-6 max-md:gap-4">
        <form onSubmit={onSubmit} noValidate className="min-w-0 flex-[1_1_340px]">
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
          title={isMarketRole ? t("v2.create.listTitleMarket") : t("v2.create.listTitle")}
          description={isMarketRole ? t("v2.create.listHintMarket") : undefined}
          actions={count ? <Badge>{count}</Badge> : undefined}
          className="min-w-0 flex-[999_1_480px]"
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
              <SkeletonTable framed={false} columns={[t("v2.list.columns.index"), t("v2.list.columns.name")]} rows={6} />
            }
            empty={<EmptyState icon={Tag} title={t("v2.create.empty")} description={t("v2.create.emptyDescription")} />}
            error={(error, retry) => <ErrorState error={error} title={t("v2.create.loadFailed")} onRetry={retry} />}
          >
            {(list, { isRefetching }) => (
              <DataTable
                rows={list}
                columns={columns}
                getRowKey={(product) => String(product.id)}
                label={isMarketRole ? t("v2.create.listTitleMarket") : t("v2.create.listTitle")}
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
