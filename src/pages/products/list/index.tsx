// Migrated to React Hook Form
import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import HeaderName from "../../../shared/components/headerName";
import {
  BookMarked,
  Package,
  Pencil,
  Plus,
  ScanLine,
  SquarePen,
  Store,
  Trash2,
} from "lucide-react";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import PopupSelect from "../../../shared/components/popupSelect";
import PopupConfirm from "../../../shared/components/popupConfirm";
import UpdatePopup from "../../../shared/components/popupUpdate";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../../entities/product";
import { useMarkets } from "../../../entities/markets";
import SelectInput from "../../../features/Select/selectInput";
import { GlobalSearchInput } from "../../../features/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { BASE_URL } from "../../../shared/const";
import type { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { usePagination } from "../../../shared/lib/usePagination";
import Pagination from "../../../shared/components/pagination";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

interface Product {
  id: number;
  name: string;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  photo?: string | null;
  photo_url?: string | null;
  file?: string | null;
  url?: string | null;
  actions?: undefined;
  market: {
    id: number;
    name: string;
  };
}

interface Market {
  id: number;
  name: string;
  phone: string;
  index: number;
}

interface ProductFilterFormValues {
  market_id: string;
}

interface EditProductFormValues {
  name: string;
  image: File | null;
}

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const productFilterSchema: yup.ObjectSchema<ProductFilterFormValues> = yup.object({
  market_id: yup.string().defined(),
});

const editProductSchema: yup.ObjectSchema<EditProductFormValues> = yup.object({
  name: yup.string().trim().required("validationNameRequired"),
  image: yup.mixed<File>().nullable().defined(),
});

const getBackendErrorMessage = (err: unknown): string | undefined => {
  const axiosErr = err as AxiosError<{
    message?: unknown;
    error?: unknown;
    detail?: unknown;
  }>;
  const payload = axiosErr?.response?.data;
  const rawMessage = payload?.message ?? payload?.error ?? payload?.detail ?? axiosErr?.message;

  if (Array.isArray(rawMessage)) {
    const message = rawMessage.map(String).filter(Boolean).join(", ");
    return message || undefined;
  }

  if (typeof rawMessage === "string") {
    const message = rawMessage.trim();
    return message || undefined;
  }

  return undefined;
};

const getProductPayload = (response: unknown): Product | null => {
  const responseData = response as {
    data?: Product | { data?: Product };
  } | Product | undefined;

  if (!responseData) return null;
  if ("id" in responseData) return responseData as Product;
  if (responseData.data && "id" in responseData.data) return responseData.data as Product;
  if (
    responseData.data
    && "data" in responseData.data
    && responseData.data.data
  ) {
    return responseData.data.data;
  }

  return null;
};

// ─── Main Component ─────────────────────────────────────────────────────────────

const ProductTable = () => {
  const { t } = useTranslation("products");
  const { api: notificationApi } = useAppNotification();
  const navigate = useNavigate();
  const [showMarketSelect, setShowMarketSelect] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // ─── Edit State ─────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | undefined>(undefined);
  const {
    control: filterControl,
    watch: watchFilter,
  } = useForm<ProductFilterFormValues>({
    defaultValues: {
      market_id: "",
    },
    resolver: yupResolver(productFilterSchema) as Resolver<ProductFilterFormValues>,
  });
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<EditProductFormValues>({
    defaultValues: {
      name: "",
      image: null,
    },
    resolver: yupResolver(editProductSchema) as Resolver<EditProductFormValues>,
  });
  const filterValue = watchFilter("market_id");

  const resolveImageUrl = useCallback((raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const trimmed = String(raw).trim();
    if (!trimmed) return undefined;
    if (
      trimmed.startsWith("http://")
      || trimmed.startsWith("https://")
      || trimmed.startsWith("data:")
      || trimmed.startsWith("blob:")
    ) {
      return trimmed;
    }

    try {
      if (BASE_URL.startsWith("/")) {
        if (trimmed.startsWith("/")) return trimmed;
        return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
      }

      const base = new URL(`${BASE_URL.replace(/\/+$/, "")}/`);
      return new URL(trimmed.replace(/^\/+/, ""), base).toString();
    } catch {
      return trimmed;
    }
  }, []);

  const getProductImageUrl = useCallback((product?: Product | null): string | undefined => {
    if (!product) return undefined;
    return resolveImageUrl(
      product.image_url
        ?? product.imageUrl
        ?? product.image
        ?? product.photo_url
        ?? product.photo
        ?? product.file
        ?? product.url,
    );
  }, [resolveImageUrl]);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const { getMarkets } = useMarkets();
  const { data } = getMarkets();

  const markets: Market[] =
    (data?.data?.items ?? []).map(
      (item: { id: number; name: string; phone_number?: string }, index: number) => ({
        id: item.id,
        name: item.name,
        phone: item.phone_number ?? "",
        index: index + 1,
      }),
    );

  // SelectInput uchun market options
  const marketOptions = markets.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  const handleSelectMarket = useCallback(
    (market: Market) => {
      navigate(`/products/create-product/${market.id}`);
      setShowMarketSelect(false);
    },
    [navigate],
  );

  const searchFilters = useSelector((state: RootState) => state.search);
  const searchValue = searchFilters.product_search;
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "products",
    defaultLimit: 10,
  });
  const previousFilterSyncRef = useRef({
    filterValue,
    searchValue,
  });

  const apiParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };

    if (searchValue) params.search = searchValue;
    if (filterValue) params.market_id = filterValue;

    return params;
  }, [filterValue, limit, page, searchValue]);

  const { getProducts, getProductById, deleteProduct, updateProduct } = useProducts();
  const { data: products, isLoading } = getProducts(apiParams);
  const { data: editProductResponse } = getProductById(editTarget?.id, Boolean(editTarget));
  const editProductDetail = useMemo(
    () => getProductPayload(editProductResponse),
    [editProductResponse],
  );
  const productData = products?.data?.items ?? products?.data ?? [];
  const rawPagination = products?.data?.meta
    ?? products?.data?.pagination
    ?? products?.meta
    ?? products?.pagination
    ?? {};

  const responsePage = toPositiveNumber(
    products?.page ?? rawPagination?.page,
  ) ?? page;
  const responseLimit = toPositiveNumber(
    products?.limit ?? rawPagination?.limit,
  ) ?? limit;
  const productTotal = toPositiveNumber(
    products?.total ?? rawPagination?.total,
  ) ?? productData.length;

  useEffect(() => {
    const previous = previousFilterSyncRef.current;
    const hasFilterChanged =
      previous.filterValue !== filterValue ||
      previous.searchValue !== searchValue;

    if (!hasFilterChanged) {
      return;
    }

    previousFilterSyncRef.current = {
      filterValue,
      searchValue,
    };

    resetPagination(limit);
  }, [filterValue, limit, resetPagination, searchValue]);

  // ─── Delete Handlers ────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((product: Product) => {
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

  // ─── Edit Handlers ──────────────────────────────────────────────────────

  const handleEditRequest = useCallback((product: Product) => {
    setEditTarget(product);
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
  }, []);

  useEffect(() => {
    if (!editTarget) {
      resetEditForm({
        name: "",
        image: null,
      });
      return;
    }

    resetEditForm({
      name: editTarget.name,
      image: null,
    });
  }, [editTarget, resetEditForm]);

  const handleEditImageChange = useCallback((file: File) => {
    setEditValue("image", file, { shouldValidate: true });
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, [setEditValue]);

  const closeEditPopup = useCallback(() => {
    setEditTarget(null);
    setEditValue("image", null);
    resetEditForm({
      name: "",
      image: null,
    });
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
  }, [resetEditForm, setEditValue]);

  const handleEditSave = useCallback(async (values: EditProductFormValues) => {
    if (!editTarget) return;

    const productName = values.name.trim();
    if (!productName) {
      notificationApi.warning({
        message: t("validationNameRequired"),
        placement: "topRight",
      });
      return;
    }

    const buildFormData = () => {
      const formData = new FormData();
      formData.append("name", productName);
      if (values.image instanceof File) formData.append("image", values.image);
      return formData;
    };

    const notifySuccess = () => {
      notificationApi.success({
        message: t("updateSuccess"),
        placement: "topRight",
      });
    };

    const notifyError = (err: unknown) => {
      notificationApi.error({
        message: t("updateError"),
        description: getBackendErrorMessage(err),
        placement: "topRight",
      });
    };

    try {
      await updateProduct.mutateAsync({ id: editTarget.id, data: buildFormData() });
      notifySuccess();
      closeEditPopup();
    } catch (err) {
      notifyError(err);
    }
  }, [closeEditPopup, editTarget, notificationApi, t, updateProduct]);

  const handleEditCancel = closeEditPopup;

  // ─── Table Columns ─────────────────────────────────────────────────────

  const columns: ColumnConfig<Product>[] = useMemo(
    () => [
      {
        key: "id",
        label: "#",
        width: "5%",
        render: (_: number, _row: Product, index: number) => (
          <span className="font-semibold text-gray-400 dark:text-gray-500">
            {(responsePage - 1) * responseLimit + index + 1}
          </span>
        ),
      },
      {
        key: "name",
        label: t("name"),
        width: "35%",
        sortable: true,
        render: (v: string) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-main/10 dark:bg-main/20 flex items-center justify-center shrink-0">
              <Package size={14} className="text-main" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">{v}</span>
          </div>
        ),
      },
      {
        key: "market",
        label: t("marketName"),
        width: "40%",
        render: (value: Product["market"]) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Store size={14} className="text-emerald-500" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">{value?.name || "—"}</span>
          </div>
        ),
      },
      {
        key: "actions",
        label: t("action"),
        width: "20%",
        render: (_: unknown, row: Product) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEditRequest(row);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors cursor-pointer"
              aria-label={t("editProductAria")}
            >
              <SquarePen size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRequest(row);
              }}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-red-500 transition-colors cursor-pointer"
              aria-label={t("deleteProductAria")}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ),
      },
    ],
    [handleDeleteRequest, handleEditRequest, responseLimit, responsePage, t],
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HeaderName
          name={t("title")}
          description={t("pageDescription")}
          icon={<ScanLine />}
        />
        <Button
          label={t("create")}
          icon={<Plus />}
          onClick={() => setShowMarketSelect(true)}
        />
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-primarydark dark:bg-primarydark lg:flex-row lg:items-center">
        <div className="w-full lg:flex-1">
          <GlobalSearchInput
            searchKey="product_search"
            placeholder={t("searchInputPlaceholder")}
            className="w-full"
          />
        </div>

        <div className="w-full lg:w-72">
          <Controller
            control={filterControl}
            name="market_id"
            render={({ field }) => (
              <SelectInput
                value={field.value}
                onChange={field.onChange}
                options={marketOptions}
                placeholder={t("selectMarket")}
              />
            )}
          />
        </div>

        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-maindark lg:ml-auto lg:min-w-fit">
          <div className="p-2.5 rounded-lg bg-main/10 dark:bg-maindark text-main dark:text-purple-400">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {t("productCountLabel")}
            </span>
            <span className="text-lg font-bold text-gray-800 dark:text-white leading-tight">
              {t("totalCount", { count: productTotal })}
            </span>
          </div>
        </div>
      </div>

      <Table<Product>
        data={productData}
        columns={columns}
        keyExtractor={(item) => item.id}
        hoverable
        loading={isLoading}
      />

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-primarydark/60 dark:bg-primarydark/60 sm:px-5">
        <Pagination
          totalItems={productTotal}
          itemsPerPage={responseLimit}
          currentPage={responsePage}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          className="pt-0"
        />
      </div>

      {/* Market Selection Popup */}
      <PopupSelect<Market>
        isOpen={showMarketSelect}
        onClose={() => setShowMarketSelect(false)}
        title={t("selectMarket")}
        data={markets}
        onSelect={handleSelectMarket}
        keyExtractor={(item) => item.index}
        searchKeys={["name"]}
        icon={<BookMarked />}
        selectLabel={t("select")}
        cancelLabel={t("cancel")}
        labelKey="name"
        secondaryLabelKey="phone"
      />

      {/* Delete Confirmation Popup */}
      <PopupConfirm
        isOpen={!!deleteTarget}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage", { name: deleteTarget?.name ?? "" })}
        isLoading={deleteProduct.isPending}
      />

      {/* Edit Product Popup */}
      <UpdatePopup
        isOpen={!!editTarget}
        onClose={handleEditCancel}
        onSave={handleEditSubmit(handleEditSave)}
        title={t("edit")}
        icon={<Pencil size={20} />}
        isLoading={updateProduct.isPending}
        imageProps={{
          label: t("image"),
          value: getProductImageUrl(editProductDetail ?? editTarget),
          onChange: handleEditImageChange,
          previewUrl: editPreviewUrl,
        }}
      >
        {/* Mahsulot nomi */}
        <div className="space-y-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            {t("name")}
          </label>
          <input
            type="text"
            {...registerEdit("name")}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-main/40 transition-all"
            placeholder={t("namePlaceholder")}
          />
          {editErrors.name && (
            <p className="text-xs text-red-500">
              {editErrors.name.message === "validationNameRequired"
                ? t("validationNameRequired")
                : editErrors.name.message}
            </p>
          )}
        </div>
      </UpdatePopup>
    </div>
  );
};

export default memo(ProductTable);
