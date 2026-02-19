import { memo, useState, useMemo } from "react";
import HeaderName from "../../../shared/components/headerName";
import { BookMarked, Plus, ScanLine, SquarePen, Trash2 } from "lucide-react"; // Added BookMarked
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

interface Product {
  id: number;
  name: string;
  market_name: string;
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

  const { getProducts, deleteProduct } = useProducts();
  const { data: products } = getProducts(apiParams);
  const productData = products?.data || [];

  const columns: ColumnConfig<Product>[] = [
    {
      key: "name",
      label: "Product name",
      width: "40%",
      sortable: true,
    },
    {
      key: "market_name",
      label: "Market name",
      width: "40%",
      sortable: true,
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
            onClick={() => deleteProduct.mutate(__.id)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-red-500 transition-colors cursor-pointer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

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

      <div className="flex items-center gap-10 mb-6">
        <div className="w-full">
          <GlobalSearchInput
            searchKey="product_search"
            placeholder="Search products..."
            className="md:col-span-3"
          />
        </div>
        <div className="w-[45%]">
          <SelectInput
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            options={filterOptions}
            placeholder="Filter by Status"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <Table<Product>
          data={productData}
          columns={columns}
          keyExtractor={(item) => item.id}
          hoverable
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
    </div>
  );
};

export default memo(ProductTable);
