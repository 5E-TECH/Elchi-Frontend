import { memo, useState, useMemo, type FormEvent } from "react";
import HeaderName from "../../../shared/components/headerName";
import {
  BookMarked,
  Package,
  Plus,
  ScanLine,
  SquarePen,
  Trash2,
} from "lucide-react"; // Added BookMarked
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import PopupSelect from "../../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom"; // Added useNavigate
import { useProducts } from "../../../entities/product";
import { useMarkets } from "../../../entities/markets";
import SelectInput from "../../../features/Select/selectInput";
import { GlobalSearchInput } from "../../../features/search";
import { useSelector } from "react-redux";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import type { RootState } from "../../../app/config/store";
import PopupUpdate from "../../../shared/components/popupUpdate";

interface Product {
  id: number;
  name: string;
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

const ProductTable = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const filterOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "out_of_stock", label: "Out of Stock" },
  ];

  const { getMarkets } = useMarkets();
  const { data } = getMarkets();

  const markets =
    data?.data?.items?.map((item: any, index: number) => ({
      ...item,
      index: index + 1,
      phone: item.phone_number,
    })) || [];

  const handleSelectMarket = (market: Market) => {
    navigate(`/products/create-product/${market.id}`);
    setShow(false);
  };

  const { getAllParams } = useQueryParams();
  const searchFilters = useSelector((state: RootState) => state.search);
  const urlParams = getAllParams();

  const apiParams = useMemo(() => {
    const params: any = {};

    // Search (URL params or Redux)
    const search = urlParams.product_search || searchFilters.product_search;
    if (search) params.search = search;

    // Filter value (Local state for now)
    if (filterValue) params.status = filterValue;

    return params;
  }, [urlParams, searchFilters, filterValue]);

  const { getProducts, deleteProduct, updateProduct } = useProducts();
  const { data: products, isLoading } = getProducts(apiParams);
  const productData = products?.data || [];

  const handleDelete = (id: number) => {
    deleteProduct.mutate(id);
  };

  const columns: ColumnConfig<Product>[] = [
    {
      key: "name",
      label: "Product name",
      width: "40%",
      sortable: true,
    },
    {
      key: "market",
      label: "Market name",
      width: "40%",
      render: (value: Product["market"]) => value?.name || "—",
    },
    {
      key: "id", // using 'id' as key for action column since 'action' is not in Product
      label: "Action",
      width: "20%",
      render: (_: number, __: Product) => (
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
            <SquarePen size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(__.id);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-red-500 transition-colors cursor-pointer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  const [form, setForm] = useState({
    name: "",
  });

  // const processedData = data.map((element: any) => {
  //   let imgUrl = element.img;
  //   if (imgUrl && !/^https?:\/\//.test(imgUrl)) {
  //     imgUrl = `${BASE_ASSETS_URL}${imgUrl.startsWith("/") ? "" : "/"
  //       }${imgUrl}`;
  //   }
  //   return { ...element, img: imgUrl };
  // });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // const handleSave = (e: FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();
  //   setErrorMessage(null);

  //   if (!selectedId) return;

  //   const formData = new FormData();
  //   formData.append("name", form.name);
  //   if (image) formData.append("img", image);

  //   updateProduct.mutate(
  //     { id: selectedId, data: formData },
  //     {
  //       onSuccess: () => {
  //         setShow(false);
  //         setErrorMessage(null);
  //       },
  //       onError: (error: any) => {
  //         setDisable(false);
  //         const serverError =
  //           error?.response?.data?.message ||
  //           "Something went wrong. Please try again.";
  //         setErrorMessage(serverError);
  //       },
  //     },
  //   );
  // };

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      <div className="flex justify-between items-center mb-6">
        <div>
          <HeaderName
            name="Create Product"
            description="Create a new product"
            icon={<ScanLine />}
          />
        </div>
        <div>
          <Button
            label="Create Product"
            icon={<Plus />}
            onClick={() => setShow(true)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl border border-white/5 bg-white/2 dark:bg-white/3">
        <div className="w-full">
          <GlobalSearchInput
            searchKey="product_search"
            placeholder="Search..." // Rasmdagi kabi text
            className="w-full"
          />
        </div>

        <div className="w-[30%]">
          <SelectInput
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            options={filterOptions}
            placeholder="Select market" // Rasmdagi kabi text
          />
        </div>

        <div className="flex items-center gap-3 px-6 py-2 rounded-xl border border-white/10 min-w-fit">
          <div className="p-2.5 rounded-lg bg-maindark text-purple-400">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium">Jami</span>
            <span className="text-lg font-bold text-white leading-tight">
              {products?.total_count || 0} ta
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <Table<Product>
          data={productData}
          columns={columns}
          keyExtractor={(item) => item.id}
          hoverable
          loading={isLoading}
        />
      </div>

      <PopupSelect<Market>
        isOpen={show}
        onClose={() => setShow(false)}
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

      {/* <PopupUpdate
        isOpen={true}
        onClose={handleClose}
        onSave={handleUpdate}
        title="Mahsulotni tahrirlash"
        imageProps={{
          label: "Mahsulot rasmi",
          value: currentImageUrl, // Eskisi
          previewUrl: preview, // Yangi tanlangan preview
          onChange: (file) => setFile(file),
        }}
      >
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Nomi</label>
          <input className="w-full bg-[#161624] border border-white/10 rounded-xl py-3 px-4 text-white" />
        </div>
      </PopupUpdate> */}
    </div>
  );
};

export default memo(ProductTable);
