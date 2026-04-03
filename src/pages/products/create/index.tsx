// Migrated to React Hook Form
import {
  memo,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Image, X, Trash2, Edit, MoveLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useProducts } from "../../../entities/product";
import PopupConfirm from "../../../shared/components/popupConfirm";
import i18n from "../../../i18n";

interface ExistingProduct {
  id: number;
  name: string;
  image: string;
}

interface CreateProductFormValues {
  name: string;
  image: File | null;
}

const createProductSchema: yup.ObjectSchema<CreateProductFormValues> = yup.object({
  name: yup.string().trim().required(i18n.t("products:validationNameRequired")),
  image: yup.mixed<File>().nullable().defined(),
});

// ─── Cell Components ────────────────────────────────────────────────────────────

const ProductNameCell = memo(({ item }: { item: ExistingProduct }) => (
  <div className="flex items-center gap-2">
    {item.image ? (
      <img
        src={item.image}
        alt={item.name}
        className="w-8 h-8 rounded object-cover"
        loading="lazy"
      />
    ) : (
      <Box className="w-8 h-8 text-gray-400" />
    )}
    <span>{item.name}</span>
  </div>
));
ProductNameCell.displayName = "ProductNameCell";


// ─── Main Component ─────────────────────────────────────────────────────────────

const CreateProductPage = () => {
  const { t } = useTranslation("products");
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExistingProduct | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevPreviewRef = useRef<string | null>(null);

  const { createProduct, getByMarketId, deleteProduct } = useProducts();
  const { id } = useParams<{ id: string }>();

  const { data: marketD } = getByMarketId(id);
  const marketData = marketD?.data || [];
  const marketName: string | null = marketD?.data?.[0]?.market?.name ?? null;

  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateProductFormValues>({
    defaultValues: {
      name: "",
      image: null,
    },
    resolver: yupResolver(createProductSchema) as Resolver<CreateProductFormValues>,
  });

  const isPending = createProduct.isPending;

  useEffect(() => {
    const prev = prevPreviewRef.current;
    return () => {
      if (prev) URL.revokeObjectURL(prev);
    };
  }, [preview]);

  useEffect(() => {
    prevPreviewRef.current = preview;
  }, [preview]);

  // ─── Delete Handlers ────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((product: ExistingProduct) => {
    setDeleteTarget(product);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteProduct]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleEdit = useCallback((_id: number) => {
    // TODO: implement edit
  }, []);

  // ─── Table Columns ─────────────────────────────────────────────────────

  const columns = useMemo<ColumnConfig<ExistingProduct>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "5%",
        render: (_: number, __: ExistingProduct, index: number) => index + 1,
      },
      {
        key: "name",
        label: t("name"),
        width: "45%",
        render: (_: string, item: ExistingProduct) => (
          <ProductNameCell item={item} />
        ),
      },
      {
        key: "actions" as keyof ExistingProduct,
        label: t("action"),
        width: "20%",
        render: (_: unknown, item: ExistingProduct) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleEdit(item.id)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
              aria-label={t("editProductAria")}
            >
              <Edit size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRequest(item)}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
              aria-label={t("deleteProductAria")}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteRequest, t],
  );

  const keyExtractor = useCallback((item: ExistingProduct) => item.id, []);

  // ─── Form Handlers ─────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    reset({
      name: "",
      image: null,
    });
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  const handleImageChange = useCallback(
    (file: File | null) => {
      if (!file) return;

      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setValue("image", file, { shouldValidate: true });
    },
    [setValue],
  );

  const handleRemoveImage = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setValue("image", null, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setValue]);

  const onSubmit = useCallback(
    async (values: CreateProductFormValues) => {
      if (!id || isPending) return;

      const formData = new FormData();
      formData.append("name", values.name.trim());
      formData.append("market_id", id);
      if (values.image) formData.append("image", values.image);

      await createProduct.mutateAsync(formData, {
        onSuccess: () => {
          resetForm();
        },
      });
    },
    [id, isPending, createProduct, resetForm],
  );

  return (
    <div className="space-y-8">
      {/* Product Information Section */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-sidebar dark:bg-maindark rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800"
      >
        {/* Header with gradient bar */}
        <div
          onClick={() => navigate(-1)}
          className="cursor-pointer px-6 py-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(90deg, #576adb 0%, #4c5798 100%)',
          }}
        >
          <div className="p-2 rounded-lg bg-white/10">
            <MoveLeft size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white m-0">{t("createTitle")}</h2>
            <p className="text-white/60 text-sm m-0">
              {marketName ?? t("createSubtitleFallback")}
            </p>
          </div>
        </div>

        {/* Form content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Name Input */}
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-gray-300 font-medium text-sm">
              {t("name")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Box
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                id="product-name"
                disabled={isPending}
                placeholder={t("namePlaceholder")}
                {...register("name")}
                className="w-full bg-gray-50 dark:bg-primarydark text-gray-900 dark:text-white pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-main transition-colors disabled:opacity-50"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Product Image Upload */}
          <div className="flex flex-col">
            <label className="text-sm mb-2 font-medium text-gray-700 dark:text-gray-300">
              {t("categoryImage")}
            </label>
            <Controller
              control={control}
              name="image"
              render={() => (
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl h-30 md:h-37.5 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-primarydark transition overflow-hidden relative">
                  {preview ? (
                    <>
                      <img
                        src={preview}
                        alt="preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1 bg-white/80 dark:bg-black/50 rounded-full hover:bg-white dark:hover:bg-black/70 transition-colors"
                      >
                        <X size={16} className="text-red-500" />
                      </button>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                      <div className="flex flex-col items-center gap-1">
                        <Image size={24} className="text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t("uploadImage")}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                        ref={fileInputRef}
                        disabled={isPending}
                      />
                    </label>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-white dark:bg-maindark">
          <Button
            label={t("clear")}
            type="button"
            className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5"
            icon={<X size={18} />}
            onClick={resetForm}
          />
          <Button
            label={isPending ? t("saving") : t("save")}
            icon={<Box size={18} />}
            type="submit"
            disabled={isPending}
          />
        </div>
      </form>

      {/* Existing Products Table Section */}
      <Table<ExistingProduct>
        data={marketData}
        columns={columns}
        keyExtractor={keyExtractor}
        hoverable
        className="border-none"
      />

      {/* Delete Confirmation Popup */}
      <PopupConfirm
        isOpen={!!deleteTarget}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle")}
        message={
          <>
            {t("deleteConfirmMessage", { name: deleteTarget?.name ?? "" })}
          </>
        }
        isLoading={deleteProduct.isPending}
      />
    </div>
  );
};

export default memo(CreateProductPage);
