import { memo, useState } from "react";
import {
    User, Phone, MapPin, Home,
    ShoppingBag, Plus, Minus, Trash2,
    Search, Building2,
} from "lucide-react";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { useProducts } from "../../../../entities/product";
import type { DeliveryType, OrderItem } from "../../../../entities/order/types/order";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerFormData {
    phone: string;
    extra_phone: string;
    name: string;
    region_id: string;
    district_id: string;
    address: string;
}

export interface OrderDetailData {
    items: OrderItem[];
    total_price: string;
    where_deliver: DeliveryType;
    operator: string;
    comment: string;
}

interface Step2CombinedProps {
    marketId: string;
    customer: CustomerFormData;
    onCustomerChange: (data: CustomerFormData) => void;
    details: OrderDetailData;
    onDetailsChange: (data: OrderDetailData) => void;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = `
  w-full px-3.5 py-2.5 rounded-xl text-sm
  bg-primary dark:bg-primarydark
  border border-gray-200 dark:border-primarydark/80
  text-maindark dark:text-primary placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
  transition-all duration-200
`;

interface FieldProps {
    label: string;
    required?: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
    wide?: boolean;
}

const Field = ({ label, required, icon, children, wide }: FieldProps) => (
    <div className={`flex flex-col gap-1.5${wide ? " col-span-2" : ""}`}>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {icon}
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const SectionHeader = ({
    icon,
    title,
    sub,
}: {
    icon: React.ReactNode;
    title: string;
    sub?: string;
}) => (
    <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center shrink-0">
            {icon}
        </div>
        <div>
            <h3 className="font-semibold text-maindark dark:text-primary text-base leading-tight">
                {title}
            </h3>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// XX XXX XX XX formatter (9 ta raqam, O'zbekiston formati)
const formatPhone = (raw: string): string => {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
};

// Narxni inson o'qishi uchun formatlash: 1000000 → "1 000 000"
const formatPrice = (raw: string): string => {
    const num = raw.replace(/\D/g, "");
    if (!num) return "";
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};
const stripPrice = (val: string): string => val.replace(/\D/g, "");

// onChange da faqat raqamlarni olib state ga yozamiz
const stripPhone = (val: string) => val.replace(/\D/g, "").slice(0, 9);

// ── Component ─────────────────────────────────────────────────────────────────

const Step2Combined = memo(
    ({
        marketId,
        customer,
        onCustomerChange,
        details,
        onDetailsChange,
    }: Step2CombinedProps) => {
        const [productSearch, setProductSearch] = useState("");

        // ── Logistics ────────────────────────────────────────────────────────
        const { getRegions, getDistricts } = useLogistics();
        const { data: regions, isLoading: regLoading } = getRegions();
        const { data: districts, isLoading: distLoading } = getDistricts(
            customer.region_id
        );

        // ── Products ─────────────────────────────────────────────────────────
        const { getByMarketId } = useProducts();
        const { data: productsData, isLoading: prodLoading } =
            getByMarketId(marketId);

        const toArray = (val: any): any[] => {
            if (Array.isArray(val)) return val;
            if (val?.data && Array.isArray(val.data)) return val.data;
            if (val?.items && Array.isArray(val.items)) return val.items;
            if (val?.results && Array.isArray(val.results)) return val.results;
            return [];
        };

        const regionList = toArray(regions);
        const districtList = toArray(districts);
        const allProducts = toArray(productsData);
        const filteredProducts = allProducts.filter((p: any) =>
            p.name?.toLowerCase().includes(productSearch.toLowerCase())
        );

        // ── Customer handlers ─────────────────────────────────────────────────
        const updateCustomer = (
            field: keyof CustomerFormData,
            value: string
        ) => {
            const next = { ...customer, [field]: value };
            if (field === "region_id") next.district_id = "";
            onCustomerChange(next);
        };

        // ── Order item handlers ───────────────────────────────────────────────
        const updateDetails = (field: keyof OrderDetailData, value: any) =>
            onDetailsChange({ ...details, [field]: value });

        const addProduct = (product: any) => {
            const existing = details.items.find(
                (i) => i.product_id === String(product.id)
            );
            if (existing) {
                updateDetails(
                    "items",
                    details.items.map((i) =>
                        i.product_id === String(product.id)
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    )
                );
            } else {
                updateDetails("items", [
                    ...details.items,
                    { product_id: String(product.id), quantity: 1 },
                ]);
            }
        };

        const changeQty = (productId: string, delta: number) => {
            updateDetails(
                "items",
                details.items
                    .map((i) =>
                        i.product_id === productId
                            ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                            : i
                    )
                    .filter((i) => i.quantity > 0)
            );
        };

        const removeItem = (productId: string) =>
            updateDetails(
                "items",
                details.items.filter((i) => i.product_id !== productId)
            );

        const getProduct = (id: string) =>
            allProducts.find((p: any) => String(p.id) === id);

        // ── Render ────────────────────────────────────────────────────────────
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ══ LEFT: Mijoz ma'lumotlari ══════════════════════════════════ */}
                <div className="flex flex-col gap-5 bg-primary dark:bg-primarydark/30 rounded-2xl border border-gray-200 dark:border-primarydark p-5">
                    <SectionHeader
                        icon={<User size={18} className="text-main" />}
                        title="Mijoz ma'lumotlari"
                        sub="Yetkazib berish uchun ma'lumotlar"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Phone */}
                        <Field label="Telefon" required icon={<Phone size={12} />}>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono z-10">
                                    +998
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="XX XXX XX XX"
                                    value={formatPhone(customer.phone)}
                                    onChange={(e) =>
                                        updateCustomer("phone", stripPhone(e.target.value))
                                    }
                                    className={`${inputCls} pl-14 font-mono tracking-wider`}
                                />
                            </div>
                        </Field>

                        {/* Extra phone */}
                        <Field label="Qo'shimcha raqam" icon={<Phone size={12} />}>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono z-10">
                                    +998
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="XX XXX XX XX"
                                    value={formatPhone(customer.extra_phone)}
                                    onChange={(e) =>
                                        updateCustomer("extra_phone", stripPhone(e.target.value))
                                    }
                                    className={`${inputCls} pl-14 font-mono tracking-wider`}
                                />
                            </div>
                        </Field>

                        {/* Name */}
                        <Field label="Ism" required icon={<User size={12} />}>
                            <input
                                type="text"
                                placeholder="Ism kiriting"
                                value={customer.name}
                                onChange={(e) => updateCustomer("name", e.target.value)}
                                className={inputCls}
                            />
                        </Field>

                        {/* Region */}
                        <Field label="Viloyat" required icon={<MapPin size={12} />}>
                            <select
                                value={customer.region_id}
                                onChange={(e) =>
                                    updateCustomer("region_id", e.target.value)
                                }
                                disabled={regLoading}
                                className={`${inputCls} cursor-pointer`}
                            >
                                <option value="">
                                    {regLoading ? "Yuklanmoqda..." : "Viloyat tanlang"}
                                </option>
                                {regionList.map((r: any) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {/* District */}
                        <Field label="Tuman" required icon={<MapPin size={12} />}>
                            <select
                                value={customer.district_id}
                                onChange={(e) =>
                                    updateCustomer("district_id", e.target.value)
                                }
                                disabled={!customer.region_id || distLoading}
                                className={`${inputCls} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <option value="">
                                    {!customer.region_id
                                        ? "Avval viloyat tanlang"
                                        : distLoading
                                            ? "Yuklanmoqda..."
                                            : "Tuman tanlang"}
                                </option>
                                {districtList.map((d: any) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {/* Address — full width */}
                        <Field label="Manzil" required icon={<Home size={12} />} wide>
                            <textarea
                                rows={2}
                                placeholder="To'liq manzil kiriting..."
                                value={customer.address}
                                onChange={(e) =>
                                    updateCustomer("address", e.target.value)
                                }
                                className={`${inputCls} resize-none`}
                            />
                        </Field>
                    </div>
                </div>

                {/* ══ RIGHT: Buyurtma tafsilotlari ══════════════════════════════ */}
                <div className="flex flex-col gap-5 bg-primary dark:bg-primarydark/30 rounded-2xl border border-gray-200 dark:border-primarydark p-5">
                    <SectionHeader
                        icon={<ShoppingBag size={18} className="text-main" />}
                        title="Buyurtma tafsilotlari"
                        sub={`${details.items.length} ta mahsulot tanlangan`}
                    />

                    {/* Product picker + selected */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Product search list */}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Mahsulot qo'shish
                            </p>
                            <div className="relative">
                                <Search
                                    size={13}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    type="text"
                                    placeholder="Qidiring..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className={`${inputCls} pl-8`}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-0.5">
                                {prodLoading
                                    ? Array.from({ length: 3 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-12 rounded-xl bg-gray-100 dark:bg-primarydark animate-pulse"
                                        />
                                    ))
                                    : filteredProducts.length === 0
                                        ? (
                                            <div className="py-6 flex flex-col items-center gap-1.5 text-gray-400">
                                                <ShoppingBag size={26} strokeWidth={1} />
                                                <p className="text-xs">Topilmadi</p>
                                            </div>
                                        )
                                        : filteredProducts.map((product: any) => {
                                            const isAdded = details.items.some(
                                                (i) => i.product_id === String(product.id)
                                            );
                                            return (
                                                <button
                                                    key={product.id}
                                                    onClick={() => addProduct(product)}
                                                    className={`
                            flex items-center gap-2.5 px-3 py-2 rounded-xl text-left
                            border-2 transition-all duration-200 group
                            ${isAdded
                                                            ? "border-main/40 bg-main/5 dark:bg-main/10"
                                                            : "border-gray-200 dark:border-primarydark bg-primary dark:bg-primarydark hover:border-main/30"
                                                        }
                          `}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0 overflow-hidden">
                                                        {product.image ? (
                                                            <img
                                                                src={product.image}
                                                                alt={product.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <ShoppingBag
                                                                size={13}
                                                                className="text-main/50"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-maindark dark:text-primary truncate">
                                                            {product.name}
                                                        </p>
                                                        <p className="text-xs text-main font-mono">
                                                            {product.price?.toLocaleString()} so'm
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isAdded
                                                            ? "bg-main text-primary"
                                                            : "bg-sidebar dark:bg-background text-main"
                                                            }`}
                                                    >
                                                        <Plus size={12} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                            </div>
                        </div>

                        {/* Selected items */}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Tanlangan
                            </p>
                            {details.items.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2 text-gray-400 border-2 border-dashed border-gray-200 dark:border-primarydark rounded-xl">
                                    <ShoppingBag size={26} strokeWidth={1} />
                                    <p className="text-xs text-center">
                                        Mahsulot tanlang
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-0.5">
                                    {details.items.map((item) => {
                                        const product = getProduct(item.product_id);
                                        return (
                                            <div
                                                key={item.product_id}
                                                className="flex items-center gap-2 p-2.5 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark/60"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0">
                                                    <ShoppingBag
                                                        size={12}
                                                        className="text-main/50"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-maindark dark:text-primary truncate">
                                                        {product?.name ?? `#${item.product_id}`}
                                                    </p>
                                                    <p className="text-xs text-main font-mono">
                                                        {product?.price?.toLocaleString()} so'm
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            changeQty(item.product_id, -1)
                                                        }
                                                        className="w-6 h-6 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors"
                                                    >
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="w-5 text-center text-xs font-bold text-maindark dark:text-primary">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() =>
                                                            changeQty(item.product_id, 1)
                                                        }
                                                        className="w-6 h-6 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors"
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.product_id)}
                                                    className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delivery + payment */}
                    <div className="border-t border-gray-200 dark:border-primarydark pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Delivery type */}
                        <div className="sm:col-span-2 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Yetkazib berish
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {(
                                    [
                                        { value: "center" as DeliveryType, label: "Markaz", icon: Building2 },
                                        { value: "address" as DeliveryType, label: "Uy", icon: Home },
                                    ] as const
                                ).map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => updateDetails("where_deliver", value)}
                                        className={`
                      flex items-center justify-center gap-2 py-2.5 rounded-xl
                      border-2 font-semibold text-sm transition-all duration-200
                      ${details.where_deliver === value
                                                ? "border-main bg-main text-primary shadow-md shadow-main/20"
                                                : "border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/40"
                                            }
                    `}
                                    >
                                        <Icon size={15} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Total price */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Umumiy summa *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={formatPrice(details.total_price)}
                                    onChange={(e) =>
                                        updateDetails("total_price", stripPrice(e.target.value))
                                    }
                                    className={`${inputCls} font-mono tracking-wider`}
                                />
                                {details.total_price && (
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                        so'm
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Operator */}
                        <div className="flex flex-col gap-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                <User size={12} /> Operator
                            </label>
                            <input
                                type="text"
                                placeholder="Operator ismi"
                                value={details.operator}
                                onChange={(e) =>
                                    updateDetails("operator", e.target.value)
                                }
                                className={inputCls}
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
                                value={details.comment}
                                onChange={(e) =>
                                    updateDetails("comment", e.target.value)
                                }
                                className={`${inputCls} resize-none`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

Step2Combined.displayName = "Step2Combined";
export default Step2Combined;
