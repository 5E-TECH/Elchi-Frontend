import { memo, useState } from "react";
import HeaderName from "../../../shared/components/headerName";
import { BookMarked, Plus, ScanLine } from "lucide-react"; // Added BookMarked
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import PopupSelect from "../../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom"; // Added useNavigate
import { useProducts } from "../../../entities/product";

interface Product {
  id: number;
  name: string;
  market_name: string;
}

interface Market {
  id: number;
  name: string;
  phone: string;
}

const mockMarkets: Market[] = [
  { id: 1, name: "Vaveon", phone: "+998990271111" },
  { id: 2, name: "0.13", phone: "+998775261313" },
  { id: 3, name: "1700", phone: "+998936188383" },
  { id: 4, name: "2555", phone: "+998976302555" },
  { id: 5, name: "076", phone: "+998935735733" },
  { id: 6, name: "4292", phone: "+998993774292" },
];

const ProductTable = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  const handleSelectMarket = (market: Market) => {
    navigate(`/products/create-product?marketId=${market.id}`);
    setShow(false);
  };

  const { getProducts } = useProducts();
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
        <div className="flex gap-2">
          <Button label="Edit" icon={<Plus />} />
          <Button label="Delete" icon={<ScanLine />} />
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
        data={mockMarkets}
        onSelect={handleSelectMarket}
        keyExtractor={(item) => item.id}
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
