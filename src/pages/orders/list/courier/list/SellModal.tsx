import { memo, useEffect, useState } from "react";
import {
  X, MapPin, Phone, User, Info, Plus, Minus,
  MessageSquare, CheckCircle,
} from "lucide-react";

type OrderItem = {
  id: string;
  quantity: number;
  product: { name: string; image_url: string | null; id?: string };
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  where_deliver: string;
  product_quantity: number;
  market: { name: string };
  customer: { name: string; phone_number: string };
  district: { name: string };
  region: { name: string };
  items: OrderItem[];
};

type SellPayload = {
  comment: string;
  extraCost: number;
};

type PartlySellPayload = {
  order_item_info: { product_id: string; quantity: number }[];
  totalPrice: number;
  extraCost: number;
  comment: string;
};

type SellModalProps = {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSell: (orderId: string, payload: SellPayload) => void;
  onPartlySell: (orderId: string, payload: PartlySellPayload) => void;
  isLoading?: boolean;
};

const formatAmountInput = (value: string) => {
  if (!value) return "";

  return Number(value).toLocaleString("uz-UZ");
};

const sanitizeAmountInput = (value: string) => value.replace(/\D/g, "");

const SellModal = ({ order, open, onClose, onSell, onPartlySell, isLoading }: SellModalProps) => {
  const [isPartial, setIsPartial] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [totalPrice, setTotalPrice] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;

    setIsPartial(false);
    setItemQuantities({});
    setTotalPrice("");
    setExtraCost("");
    setNote("");
  }, [open, order?.id]);

  if (!open || !order) return null;

  const getItemQty = (item: OrderItem) =>
    itemQuantities[item.id] ?? item.quantity;

  const getSelectedItemsCount = () =>
    order.items.reduce((sum, item) => sum + getItemQty(item), 0);

  const isAtMinimumSelection = isPartial && getSelectedItemsCount() === 1;

  const canDecreaseItem = (item: OrderItem) => {
    const currentQty = getItemQty(item);

    if (currentQty <= 0) return false;

    return getSelectedItemsCount() - 1 >= 1;
  };

  const setItemQty = (item: OrderItem, val: number) => {
    const minAllowed = order.product_quantity <= 1 ? 1 : 0;
    const clamped = Math.max(minAllowed, Math.min(item.quantity, val));

    if (clamped < getItemQty(item) && !canDecreaseItem(item)) {
      return;
    }

    setItemQuantities((prev) => ({ ...prev, [item.id]: clamped }));
  };

  const handleSubmit = () => {
    if (!order) return;

    if (isPartial) {
      if (getSelectedItemsCount() < 1) {
        return;
      }

      // POST /orders/partly-sell/{id}
      onPartlySell(order.id, {
        order_item_info: order.items.map((item) => ({
          product_id: item.product?.id ?? item.id,
          quantity: getItemQty(item),
        })),
        totalPrice: Number(totalPrice) || 0,
        extraCost: Number(extraCost) || 0,
        comment: note,
      });
    } else {
      // POST /orders/sell/{id}
      onSell(order.id, {
        comment: note,
        extraCost: Number(extraCost) || 0,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-500 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg">
              {isPartial ? "Qisman sotish" : "Sotish"}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-white" />
            </button>
          </div>

          {/* Customer card */}
          <div className="bg-white/20 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center shrink-0">
              <User size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{order.customer?.name}</p>
              <p className="text-white/80 text-xs flex items-center gap-1">
                <Phone size={11} />
                {order.customer?.phone_number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">Jami summa</p>
              <p className="text-white font-bold text-base">
                {Number(order.total_price).toLocaleString("uz-UZ")} so'm
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 text-white/80 text-xs">
            <MapPin size={12} />
            <span>{order.district?.name}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Qisman sotish toggle */}
          <div
            onClick={() => setIsPartial((p) => !p)}
            className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all select-none ${
              isPartial
                ? "border-orange-400 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-600"
                : "border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Info size={15} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Qisman sotish
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mahsulotlarni alohida tanlash
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isPartial
                  ? "bg-orange-500 border-orange-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {isPartial && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* Items — qisman rejimda */}
          {isPartial && order.items?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Mahsulotlar
              </p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">
                        {item.product?.name}
                      </p>
                      <p className="text-xs text-gray-400">Max: {item.quantity} ta</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setItemQty(item, getItemQty(item) - 1)}
                        disabled={!canDecreaseItem(item)}
                        className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {getItemQty(item)}
                      </span>
                      <button
                        onClick={() => setItemQty(item, getItemQty(item) + 1)}
                        className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center hover:bg-green-200 transition-colors"
                      >
                        <Plus size={12} className="text-green-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {isAtMinimumSelection && (
                <div className="mt-3 rounded-xl border border-error/20 bg-error/10 px-3 py-2">
                  <p className="text-sm font-bold text-error">
                    Bundan ortiq kamaytirib bo'lmaydi. Kamida 1 ta mahsulot qolishi kerak, aks holda bekor qilishdan foydalaning.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* totalPrice — faqat qisman rejimda */}
          {isPartial && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                To'lov summasi <span className="text-red-400">*</span>
              </p>
              <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(totalPrice)}
                  onChange={(e) =>
                    setTotalPrice(sanitizeAmountInput(e.target.value))
                  }
                  placeholder="0"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100"
                />
                <span className="text-sm text-gray-400">so'm</span>
              </div>
            </div>
          )}

          {/* extraCost — har doim ko'rsatiladi */}
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              <Plus size={12} className="text-green-500" />
              Qo'shimcha to'lov
            </p>
            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <input
                type="text"
                inputMode="numeric"
                value={formatAmountInput(extraCost)}
                onChange={(e) =>
                  setExtraCost(sanitizeAmountInput(e.target.value))
                }
                placeholder="0"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100"
              />
              <span className="text-sm text-gray-400">so'm</span>
            </div>
          </div>

          {/* Izoh */}
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              <MessageSquare size={12} className="text-purple-400" />
              Izoh{" "}
              <span className="normal-case font-normal text-gray-400">(ixtiyoriy)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Izoh yozing..."
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent outline-none resize-none text-gray-800 dark:text-gray-100 placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle size={18} />
            {isLoading ? "Yuklanmoqda..." : "Sotish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(SellModal);
