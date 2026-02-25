import { memo, useState, useRef, useEffect, useCallback } from "react";
import HeaderName from "../../../shared/components/headerName";
import {
  MoveLeft,
  Printer,
  Globe,
  FileText,
  ChevronDown,
  Phone,
  MapPin,
  SquarePen,
  Trash2,
  CheckCircle2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlobalSearchInput } from "../../../features/search";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OrderProduct {
  name: string;
  quantity: number;
}

interface Order {
  id: number;
  status: "new" | "processing" | "completed";
  type: string;
  customerName: string;
  phone: string;
  address: string;
  products: OrderProduct[];
  totalPrice: string;
  date: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_ORDERS: Order[] = [
  {
    id: 1,
    status: "new",
    type: "Markaz",
    customerName: "Dilfuza",
    phone: "+998 33 658 91 86",
    address: "Toshkent viloyati, O'rtachirchiq tumani",
    products: [
      { name: "Chernika Premium 401", quantity: 1 },
      { name: "Asal 200gr", quantity: 2 }
    ],
    totalPrice: "220,000 so'm",
    date: "21.02.2026 12:37",
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────────

const printOptions = [
  {
    key: "thermal",
    icon: <Printer size={18} />,
    iconBg: "bg-blue-500/10 text-blue-500",
    title: "Termal printer",
    subtitle: "MQTT orqali",
  },
  {
    key: "browser",
    icon: <Globe size={18} />,
    iconBg: "bg-emerald-500/10 text-emerald-500",
    title: "Brauzer orqali",
    subtitle: "Istalgan printer",
  },
  {
    key: "pdf",
    icon: <FileText size={18} />,
    iconBg: "bg-amber-500/10 text-amber-500",
    title: "PDF (60x100mm)",
    subtitle: "Gainscha printer uchun",
  },
];

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  new: {
    label: "Yangi",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  processing: {
    label: "Jarayonda",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Tayyor",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
};

// ─── Sub-Components ─────────────────────────────────────────────────────────────

const StatusBadge = memo(({ status }: { status: string }) => {
  const config = statusConfig[status] || statusConfig.new;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </span>
  );
});

const TypeBadge = memo(({ type }: { type: string }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10">
    📦 {type}
  </span>
));

const Checkbox = memo(({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className="focus:outline-none"
  >
    {checked ? (
      <div className="bg-main rounded-md p-0.5 shadow-sm shadow-main/40">
        <CheckSquare size={18} className="text-white" />
      </div>
    ) : (
      <Square size={22} className="text-gray-300 dark:text-gray-600 hover:text-main transition-colors" />
    )}
  </button>
));

// ─── Order Card ─────────────────────────────────────────────────────────────────

const OrderCard = memo(({ order, isSelected, onToggle, onEdit, onDelete }: any) => (
  <div
    onClick={onToggle}
    className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 ${isSelected
      ? "border-main/40 bg-main/5 dark:bg-main/10 shadow-lg shadow-main/10"
      : "border-gray-100 dark:border-white/5 bg-white dark:bg-primarydark hover:border-gray-200 dark:hover:border-white/10 shadow-sm"
      }`}
  >
    <div className="p-5 flex gap-5">
      {/* Left: Selection & ID */}
      <div className="flex flex-col items-center justify-between py-1">
        <Checkbox checked={isSelected} onChange={onToggle} />
        <div className="w-px h-full bg-gray-100 dark:bg-white/5 my-3" />
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase [writing-mode:vertical-lr] rotate-180">
          ID-{order.id}
        </span>
      </div>

      {/* Middle: Info */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <TypeBadge type={order.type} />
          <span className="ml-auto text-[11px] font-medium text-gray-400 bg-gray-50 dark:bg-black/20 px-2 py-1 rounded-lg">
            {order.date}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-main transition-colors">
              {order.customerName}
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="p-1 rounded-md bg-gray-100 dark:bg-white/5 text-gray-400"><Phone size={14} /></div>
                {order.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="p-1 rounded-md bg-gray-100 dark:bg-white/5 text-gray-400"><MapPin size={14} /></div>
                {order.address}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap content-end gap-2">
            {order.products.map((p: any) => (
              <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{p.name}</span>
                <span className="text-[10px] bg-main/10 text-main px-1.5 py-0.5 rounded-md font-black">x{p.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Price & Actions */}
      <div className="flex flex-col items-end justify-between border-l border-gray-100 dark:border-white/5 pl-5">
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter mb-1">Jami summa</p>
          <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
            {order.totalPrice.split(' ')[0]}
            <span className="text-xs ml-1 text-main font-bold">UZS</span>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(order.id); }}
            className="p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-main transition-all shadow-sm active:scale-90"
          >
            <SquarePen size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(order.id); }}
            className="p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-all shadow-sm active:scale-90"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  </div>
));

// ─── Main Component ─────────────────────────────────────────────────────────────

const NewOrderDetail = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const orders = MOCK_ORDERS;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrint = useCallback((key: string) => {
    console.log(`Printing via: ${key}`);
    setIsOpen(false);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === orders.length) return new Set();
      return new Set(orders.map((o) => o.id));
    });
  }, [orders]);

  const allSelected = selectedIds.size === orders.length && orders.length > 0;

  const handleEdit = (id: number) => console.log("Edit:", id);
  const handleDelete = (id: number) => console.log("Delete:", id);
  const handleAccept = () => console.log("Accepted:", [...selectedIds]);

  return (
    <div className="flex flex-col rounded-2xl bg-sidebar dark:bg-maindark overflow-hidden">

      {/* ── Header ── */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-center">
          <div onClick={() => navigate(-1)} className="cursor-pointer">
            <HeaderName
              name="Today's Order / Viver"
              description={`${orders.length} ta buyurtma • 220,000 so'm`}
              icon={<MoveLeft />}
            />
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearchInput
              searchKey="new_order_detail_search"
              placeholder="Buyurtma izlash..."
            />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-main hover:bg-main/90 text-white font-semibold text-sm transition-all duration-200 whitespace-nowrap shadow-md shadow-main/20 cursor-pointer"
              >
                <Printer size={16} />
                Chop etish
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-primarydark shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {printOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => handlePrint(option.key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className={`p-2 rounded-lg ${option.iconBg} shrink-0`}>
                          {option.icon}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-gray-800 dark:text-white">
                            {option.title}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {option.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Select All Toolbar */}
        <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-white/5">
          <div
            onClick={toggleSelectAll}
            className="flex items-center gap-3 cursor-pointer"
          >
            <Checkbox checked={allSelected} onChange={toggleSelectAll} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {allSelected ? "Barchasini bekor qilish" : "Barchasini tanlash"}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <span className="text-xs font-bold text-white bg-main px-2.5 py-1 rounded-lg">
              {selectedIds.size} ta tanlangan
            </span>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="overflow-y-auto px-6 pb-4 space-y-3">
        {orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={selectedIds.has(order.id)}
              onToggle={() => toggleSelect(order.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm opacity-50">Ma'lumot topilmadi</p>
          </div>
        )}
      </div>

      {/* Accept Button */}
      <div className="p-6 pt-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={selectedIds.size === 0}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 cursor-pointer
            ${selectedIds.size > 0
              ? "bg-linear-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/35 hover:-translate-y-0.5"
              : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
        >
          <CheckCircle2 size={20} />
          {selectedIds.size > 0
            ? `Accept (${selectedIds.size} ta buyurtma)`
            : "Buyurtmalarni tanlang"}
        </button>
      </div>
    </div>
  );
};

export default memo(NewOrderDetail);