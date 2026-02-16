import { memo, useState } from "react";
import { Box, Image, X, Trash2, Edit } from "lucide-react";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";

// Mock data for existing products
interface ExistingProduct {
  id: number;
  name: string;
  image: string; // URL or placeholder
  market_name: string;
}

const mockExistingProducts: ExistingProduct[] = [
  { id: 1, name: "bolalar uchun kollegrafik da...", image: "", market_name: "Adosh.uz" },
  { id: 2, name: "zikr uzuk 3 ta razmerli", image: "", market_name: "Adosh.uz" },
];

const CreateProductPage = () => {
  const [productName, setProductName] = useState("");

  const columns: ColumnConfig<ExistingProduct>[] = [
    {
      key: "id",
      label: "#",
      width: "5%",
    },
    {
      key: "name",
      label: "Product name",
      width: "45%",
      render: (_: string, item: ExistingProduct) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" /> : <Box className="text-gray-400" size={20} />}
          </div>
          <span className="font-medium text-gray-900 dark:text-white truncate">{item.name}</span>
        </div>
      )
    },
    {
      key: "market_name",
      label: "Market name",
      width: "30%",
      render: (value: string) => (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Box size={16} />
          {value}
        </div>
      )
    },
    {
      key: "id",
      label: "Action",
      width: "20%",
      render: () => (
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
            <Edit size={18} />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
      )
    }
  ];


  return (
    <div className="space-y-8">
      {/* Product Information Section */}
      <div className="bg-sidebar dark:bg-maindark rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="bg-main px-6 py-4">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Box className="text-primary" /> Product information
          </h2>
          <p className="text-primary/80 text-sm">Yangi mahsulot ma'lumotlarini kiriting</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Name Input */}
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-gray-300 font-medium text-sm">Product name <span className="text-red-500">*</span></label>
            <div className="relative">
              <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Product name..."
                className="w-full bg-gray-50 dark:bg-primarydark text-gray-900 dark:text-white pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-main transition-colors"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
          </div>

          {/* Product Image Upload */}
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-gray-300 font-medium text-sm">Product image</label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-40">
              <div className="w-12 h-12 bg-main/10 rounded-xl flex items-center justify-center mb-3 text-main">
                <Image size={24} />
              </div>
              <p className="text-primarydark dark:text-gray-300 text-sm mb-2">Drag and drop your image here</p>
              <p className="text-gray-400 text-xs mb-4">or</p>
              <button className="px-4 py-2 bg-main/10 text-primarydark rounded-lg text-sm font-medium hover:bg-main/20 transition-colors">
                Choose image
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
          <Button label="Clear" className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5" icon={<X size={18} />} />
          <Button label="Save" icon={<Box size={18} />} />
        </div>
      </div>

      {/* Existing Products Table Section */}
      <div className="bg-white dark:bg-maindark rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="bg-primarydark px-6 py-4">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Box className="text-white" /> Mavjud mahsulotlar
          </h2>
          <p className="text-white/80 text-sm">Bu marketga tegishli barcha mahsulotlar</p>
        </div>

        <div>
          <Table<ExistingProduct>
            data={mockExistingProducts}
            columns={columns}
            keyExtractor={(item) => item.id}
            hoverable
            className="border-none"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(CreateProductPage);
