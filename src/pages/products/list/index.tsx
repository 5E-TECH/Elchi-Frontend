import { memo, useState } from "react";
import HeaderName from "../../../shared/components/headerName";
import { BookMarked, Plus, ScanLine, SquarePen, Trash2 } from "lucide-react"; // Added BookMarked
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import PopupSelect from "../../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom"; // Added useNavigate
import { useProducts } from "../../../entities/product";
import { useMarkets } from "../../../entities/markets";

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

  const { getMarkets } = useMarkets();
  const { data } = getMarkets();

  const markets = data?.data?.items?.map((item: any, index: number) => ({
    ...item,
    index: index + 1,
    phone: item.phone_number,
  })) || [];

  const handleSelectMarket = (market: Market) => {
    navigate(`/products/create-product?marketId=${market.id}`);
    setShow(false);

  };

  const { getProducts, deleteProduct } = useProducts();
  const { data: products } = getProducts();
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
          <button onClick={() => deleteProduct.mutate(__.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-red-500 transition-colors cursor-pointer">
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
