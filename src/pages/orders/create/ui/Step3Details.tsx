import { memo, useState } from "react";
import { ShoppingBag, Plus, Minus, Trash2, Search, Home, Building2, User } from "lucide-react";
import { useProducts } from "../../../../entities/product";
import type { DeliveryType, OrderItem } from "../../../../entities/order/types/order";

interface OrderDetail {
    items: OrderItem[];
    total_price: string;
    to_be_paid: string;
    where_deliver: DeliveryType;
    operator: string;
    comment: string;
}

interface Step3DetailsProps {
    marketId: string;
    data: OrderDetail;
    onChange: (data: OrderDetail) => void;
}

const Step3Details = ({ marketId, data, onChange }: Step3DetailsProps) => {
    const [productSearch, setProductSearch] = useState("");
    const { getByMarketId } = useProducts();
    const { data: productsData, isLoading } = getByMarketId(marketId);

    const toArray = (val: any): any[] => {
        if (Array.isArray(val)) return val;
        if (val && Array.isArray(val.data)) return val.data;
        if (val && Array.isArray(val.items)) return val.items;
        if (val && Array.isArray(val.results)) return val.results;
        return [];
    };

    const allProducts = toArray(productsData);


    const filtered = allProducts.filter((p: any) =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const update = (field: keyof OrderDetail, value: any) =>
        onChange({ ...data, [field]: value });

    // Items CRUD
    const addProduct = (product: any) => {
        const existing = data.items.find((i) => i.product_id === String(product.id));
        if (existing) {
            update("items", data.items.map((i) =>
                i.product_id === String(product.id) ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            update("items", [...data.items, { product_id: String(product.id), quantity: 1 }]);
        }
    };

    const changeQty = (productId: string, delta: number) => {
        const next = data.items.map((i) =>
            i.product_id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
        ).filter((i) => i.quantity > 0);
        update("items", next);
    };

    const removeItem = (productId: string) =>
        update("items", data.items.filter((i) => i.product_id !== productId));

    const getProduct = (productId: string) =>
        allProducts.find((p: any) => String(p.id) === productId);

    return (
        <div className="flex flex-col gap-6">
            {/* ── Products Section Header ── */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
                    <ShoppingBag size={18} className="text-main" />
                </div>
                <div>
                    <h3 className="font-semibold text-maindark dark:text-primary text-base">
                        Buyurtma tafsilotlari
                    </h3>
                    <p className="text-xs text-gray-400">
                        {data.items.length} ta mahsulot tanlangan
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT — Product picker */}
                <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Mahsulot qo'shish
                    </p>

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Mahsulot qidiring..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="
                w-full pl-9 pr-3 py-2 rounded-xl text-sm
                bg-primary dark:bg-primarydark
                border border-gray-200 dark:border-primarydark
                text-maindark dark:text-primary placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                transition-all duration-200
              "
                        />
                    </div>

                    {/* Product list */}
                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-primarydark animate-pulse" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
                                <ShoppingBag size={30} strokeWidth={1} />
                                <p className="text-xs">Mahsulot topilmadi</p>
                            </div>
                        ) : (
                            filtered.map((product: any) => {
                                const isAdded = data.items.some((i) => i.product_id === String(product.id));
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => addProduct(product)}
                                        className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                      border-2 transition-all duration-200 group
                      ${isAdded
                                                ? "border-main/40 bg-main/5 dark:bg-main/10"
                                                : "border-gray-200 dark:border-primarydark bg-primary dark:bg-primarydark hover:border-main/30 hover:shadow-sm"
                                            }
                    `}
                                    >
                                        {/* Product image / placeholder */}
                                        <div className="w-10 h-10 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {product.image ? (
                                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag size={16} className="text-main/50" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                                                {product.name}
                                            </p>
                                            <p className="text-xs text-main font-mono">
                                                {product.price?.toLocaleString()} so'm
                                            </p>
                                        </div>
                                        <div className={`
                      w-7 h-7 rounded-lg flex items-center justify-center transition-all
                      ${isAdded
                                                ? "bg-main text-primary"
                                                : "bg-sidebar dark:bg-background text-main group-hover:bg-main/10"
                                            }
                    `}>
                                            <Plus size={14} />
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT — Selected items */}
                <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Tanlangan mahsulotlar
                    </p>

                    {data.items.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-gray-400 border-2 border-dashed border-gray-200 dark:border-primarydark rounded-xl">
                            <ShoppingBag size={32} strokeWidth={1} />
                            <p className="text-xs text-center">
                                Chap tomondagi mahsulotlardan tanlang
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                            {data.items.map((item) => {
                                const product = getProduct(item.product_id);
                                return (
                                    <div
                                        key={item.product_id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark/60"
                                    >
                                        {/* Img placeholder */}
                                        <div className="w-9 h-9 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center flex-shrink-0">
                                            <ShoppingBag size={14} className="text-main/50" />
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                                                {product?.name ?? `Mahsulot #${item.product_id}`}
                                            </p>
                                            <p className="text-xs text-main font-mono">
                                                {product?.price?.toLocaleString()} so'm
                                            </p>
                                        </div>
                                        {/* Qty control */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => changeQty(item.product_id, -1)}
                                                className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-6 text-center text-sm font-bold text-maindark dark:text-primary">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => changeQty(item.product_id, 1)}
                                                className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        {/* Remove */}
                                        <button
                                            onClick={() => removeItem(item.product_id)}
                                            className="ml-1 text-gray-300 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delivery & payment ── */}
            <div className="border-t border-gray-200 dark:border-primarydark pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Delivery type */}
                <div className="sm:col-span-2 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Yetkazib berish
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: "center" as DeliveryType, label: "Markaz", icon: Building2 },
                            { value: "home" as DeliveryType, label: "Uy", icon: Home },
                        ].map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                onClick={() => update("where_deliver", value)}
                                className={`
                  flex items-center justify-center gap-2 py-3 rounded-xl
                  border-2 font-semibold text-sm transition-all duration-200
                  ${data.where_deliver === value
                                        ? "border-main bg-main text-primary shadow-md shadow-main/20"
                                        : "border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/40"
                                    }
                `}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Total price */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Umumiy summa
                    </label>
                    <input
                        type="number"
                        placeholder="0"
                        value={data.total_price}
                        onChange={(e) => update("total_price", e.target.value)}
                        className="
              w-full px-3.5 py-2.5 rounded-xl text-sm font-mono
              bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
              text-maindark dark:text-primary placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
              transition-all duration-200
            "
                    />
                </div>

                {/* To be paid */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        To'lanadigan summa
                    </label>
                    <input
                        type="number"
                        placeholder="0"
                        value={data.to_be_paid}
                        onChange={(e) => update("to_be_paid", e.target.value)}
                        className="
              w-full px-3.5 py-2.5 rounded-xl text-sm font-mono
              bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
              text-maindark dark:text-primary placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
              transition-all duration-200
            "
                    />
                </div>

                {/* Operator */}
                <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <User size={12} /> Operator
                    </label>
                    <input
                        type="text"
                        placeholder="Operator ismi"
                        value={data.operator}
                        onChange={(e) => update("operator", e.target.value)}
                        className="
              w-full px-3.5 py-2.5 rounded-xl text-sm
              bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
              text-maindark dark:text-primary placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
              transition-all duration-200
            "
                    />
                </div>

                {/* Comment */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Izoh (ixtiyoriy)
                    </label>
                    <textarea
                        rows={2}
                        placeholder="Izoh..."
                        value={data.comment}
                        onChange={(e) => update("comment", e.target.value)}
                        className="
              w-full px-3.5 py-2.5 rounded-xl text-sm resize-none
              bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
              text-maindark dark:text-primary placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
              transition-all duration-200
            "
                    />
                </div>
            </div>
        </div>
    );
};

export default memo(Step3Details);
