import {
  memo,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Image, X, Trash2, Edit, MoveLeft } from "lucide-react";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useProducts } from "../../../entities/product";
import HeaderName from "../../../shared/components/headerName";

interface ExistingProduct {
  id: number;
  name: string;
  image: string;
  market_name: string;
}

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

const MarketNameCell = memo(({ value }: { value: string }) => (
  <div className="flex items-center gap-1">
    <Image className="w-4 h-4 text-gray-500" />
    <span>{value}</span>
  </div>
));
MarketNameCell.displayName = "MarketNameCell";

const ActionCell = memo(
  ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
        aria-label="Edit product"
      >
        <Edit size={18} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-red-500 transition-colors"
        aria-label="Delete product"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
);
ActionCell.displayName = "ActionCell";

// ─── Main Component ────────────────────────────────────────────────────────────

const CreateProductPage = () => {
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [img, setImage] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevPreviewRef = useRef<string | null>(null);

  const { createProduct, getByMarketId } = useProducts();
  const { id } = useParams<{ id: string }>();

  const { data: marketD } = getByMarketId(id);
  const marketData = marketD?.data || []




  const navigate = useNavigate();


  useEffect(() => {
    const prev = prevPreviewRef.current;
    return () => {
      if (prev) URL.revokeObjectURL(prev);
    };
  }, [preview]);

  const handleEdit = useCallback((_id: number) => {

  }, []);

  const handleDelete = useCallback((_id: number) => {

  }, []);

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
        label: "Product name",
        width: "45%",
        render: (_: string, item: ExistingProduct) => (
          <ProductNameCell item={item} />
        ),
      },
      {
        key: "market_name",
        label: "Market name",
        width: "30%",
        render: (value: string) => <MarketNameCell value={value} />,
      },
      {
        key: "actions" as keyof ExistingProduct,
        label: "Action",
        width: "20%",
        render: (_: unknown, item: ExistingProduct) => (
          <ActionCell
            onEdit={() => handleEdit(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        ),
      },
    ],
    [handleEdit, handleDelete],
  );

  const keyExtractor = useCallback((item: ExistingProduct) => item.id, []);

  const resetForm = useCallback(() => {
    setName("");
    setImage(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setImage(file);
    },
    [],
  );

  const handleRemoveImage = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim() || !id || isPending) return;

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("market_id", id);
      if (img) formData.append("image", img);

      setIsPending(true);

      createProduct.mutate(formData, {
        onSuccess: () => {
          resetForm();
        },
        onSettled: () => {
          setIsPending(false);
        },
      });
    },
    [name, id, img, isPending, createProduct, resetForm],
  );

  return (
    <div className="space-y-8">
      {/* Product Information Section */}
      <form
        onSubmit={handleSubmit}
        className="bg-sidebar dark:bg-maindark rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800"
      >
        <div onClick={() => navigate(-1)}>
          <HeaderName
            name="Create Product"
            description="Yangi mahsulot ma'lumotlarini kiriting"
            icon={<MoveLeft size={20} className="text-white" />}
          />
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Name Input */}
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-gray-300 font-medium text-sm">
              Product name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Box
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                id="product-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
                placeholder="Product name..."
                className="w-full bg-gray-50 dark:bg-primarydark text-gray-900 dark:text-white pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-main transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Product Image Upload */}
          <div className="flex flex-col">
            <label className="text-helpertext text-md mb-2 font-medium text-gray-700 dark:text-gray-300">
              Category Image
            </label>
            <div className="border-2 border-dashed border-[#E8E9EB] dark:border-gray-700 rounded-2xl h-30 md:h-37.5 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-primarydark transition overflow-hidden relative">
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
                    <span className="text-helpertext text-xs text-gray-500 dark:text-gray-400">
                      Upload Image
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    disabled={isPending}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-white dark:bg-maindark">
          <Button
            label="Clear"
            type="button"
            className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5"
            icon={<X size={18} />}
            onClick={resetForm}
          />
          <Button
            label={isPending ? "Saving..." : "Save"}
            icon={<Box size={18} />}
            type="submit"
            disabled={isPending}
          />
        </div>
      </form>

      {/* Existing Products Table Section */}
      <div>
        <Table<ExistingProduct>
          data={marketData}
          columns={columns}
          keyExtractor={keyExtractor}
          hoverable
          className="border-none"
        />
      </div>
    </div >
  );
};

export default memo(CreateProductPage);
