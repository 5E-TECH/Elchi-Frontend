import { memo, useState, useMemo, useCallback } from "react";
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
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import type { RootState } from "../../../app/config/store";
import { BASE_URL } from "../../../shared/const";
import type { AxiosError } from "axios";

interface Product {
  id: number;
  name: string;
  image?: string | null;
  image_url?: string | null;
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

// ─── Main Component ─────────────────────────────────────────────────────────────

const ProductTable = () => {
  const navigate = useNavigate();
  const [showMarketSelect, setShowMarketSelect] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // ─── Edit State ─────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | undefined>(undefined);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | undefined>(undefined);

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
      const baseOrigin = new URL(BASE_URL).origin;
      if (trimmed.startsWith("/")) return `${baseOrigin}${trimmed}`;
      return `${baseOrigin}/${trimmed}`;
    } catch {
      return trimmed;
    }
  }, []);

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

  const { getAllParams } = useQueryParams();
  const searchFilters = useSelector((state: RootState) => state.search);
  const urlParams = getAllParams();

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {};

    const search = urlParams.product_search || searchFilters.product_search;
    if (search) params.search = search;
    if (filterValue) params.market_id = filterValue;

    return params;
  }, [urlParams, searchFilters, filterValue]);

  const { getProducts, deleteProduct, updateProduct } = useProducts();
  const { data: products, isLoading, isFetching } = getProducts(apiParams);
  const productData = products?.data || [];

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
    setEditName(product.name);
    setEditImageFile(undefined);
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
  }, []);

  const handleEditImageChange = useCallback((file: File) => {
    setEditImageFile(file);
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editTarget) return;
    const buildFormData = (nameKey: "name" | "product_name") => {
      const formData = new FormData();
      formData.append(nameKey, editName);
      if (editImageFile) formData.append("image", editImageFile);
      return formData;
    };

    const isNameNotAllowed = (err: unknown): boolean => {
      const axiosErr = err as AxiosError<{ message?: unknown }>;
      const msg = axiosErr?.response?.data?.message;
      if (typeof msg === "string") return msg.includes("property name should not exist");
      if (Array.isArray(msg)) return msg.some((m) => String(m).includes("property name should not exist"));
      return false;
    };

    try {
      await updateProduct.mutateAsync({ id: editTarget.id, data: buildFormData("name") });
      setEditTarget(null);
    } catch (err) {
      if (!isNameNotAllowed(err)) return;
      await updateProduct.mutateAsync({ id: editTarget.id, data: buildFormData("product_name") });
      setEditTarget(null);
    }
  }, [editTarget, editName, editImageFile, updateProduct]);

  const handleEditCancel = useCallback(() => {
    setEditTarget(null);
    setEditImageFile(undefined);
    setEditPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
  }, []);

  // ─── Table Columns ─────────────────────────────────────────────────────

  const columns: ColumnConfig<Product>[] = useMemo(
    () => [
      {
        key: "id",
        label: "#",
        width: "5%",
        render: (_: number, _row: Product, index: number) => (
          <span className="font-semibold text-gray-400 dark:text-gray-500">{index + 1}</span>
        ),
      },
      {
        key: "name",
        label: "Product name",
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
        label: "Market name",
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
        label: "Action",
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
              aria-label="Edit product"
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
              aria-label="Delete product"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ),
      },
    ],
    [handleDeleteRequest, handleEditRequest],
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      <div className="flex justify-between items-center mb-6">
        <HeaderName
          name="Products"
          description="Mahsulotlar ro'yxati"
          icon={<ScanLine />}
        />
        <Button
          label="Create Product"
          icon={<Plus />}
          onClick={() => setShowMarketSelect(true)}
        />
      </div>

      {/* Filter Bar */}
      <div className={`flex items-center gap-4 mb-6 p-4 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-primarydark`}>
        <div className="w-full">
          <GlobalSearchInput
            searchKey="product_search"
            placeholder="Search..."
            className="w-full"
          />
        </div>

        <div className="w-[30%]">
          <SelectInput
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            options={marketOptions}
            placeholder="Market tanlang..."
          />
        </div>

        <div className="flex items-center gap-3 px-6 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-maindark min-w-fit">
          <div className="p-2.5 rounded-lg bg-main/10 dark:bg-maindark text-main dark:text-purple-400">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Jami
            </span>
            <span className="text-lg font-bold text-gray-800 dark:text-white leading-tight">
              {products?.total || 0} ta
            </span>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <Table<Product>
        data={productData}
        columns={columns}
        keyExtractor={(item) => item.id}
        hoverable
        loading={isLoading || isFetching}
      />

      {/* Market Selection Popup */}
      <PopupSelect<Market>
        isOpen={showMarketSelect}
        onClose={() => setShowMarketSelect(false)}
        title="Select Market"
        data={markets}
        onSelect={handleSelectMarket}
        keyExtractor={(item) => item.index}
        searchKeys={["name"]}
        icon={<BookMarked />}
        selectLabel="Select"
        cancelLabel="Bekor qilish"
        labelKey="name"
        secondaryLabelKey="phone"
      />

      {/* Delete Confirmation Popup */}
      <PopupConfirm
        isOpen={!!deleteTarget}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="O'chirishni tasdiqlang"
        message={
          <>
            <strong className="text-gray-700 dark:text-gray-200">
              "{deleteTarget?.name}"
            </strong>{" "}
            ni rostdan o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
          </>
        }
        isLoading={deleteProduct.isPending}
      />

      {/* Edit Product Popup */}
      <UpdatePopup
        isOpen={!!editTarget}
        onClose={handleEditCancel}
        onSave={handleEditSave}
        title="Mahsulotni tahrirlash"
        icon={<Pencil size={20} />}
        isLoading={updateProduct.isPending}
        imageProps={{
          label: "Rasm",
          value: resolveImageUrl(editTarget?.image_url ?? editTarget?.image),
          onChange: handleEditImageChange,
          previewUrl: editPreviewUrl,
        }}
      >
        {/* Mahsulot nomi */}
        <div className="space-y-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            Mahsulot nomi
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-main/40 transition-all"
            placeholder="Mahsulot nomini kiriting..."
          />
        </div>
      </UpdatePopup>
    </div>
  );
};

export default memo(ProductTable);
