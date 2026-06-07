import { memo, useEffect, useState } from "react";
import {
  X, MapPin, Phone, User, Info, Plus, Minus,
  MessageSquare, CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Popup from "../../../../../shared/ui/Popup";

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
  const { t, i18n } = useTranslation(["orders", "common"]);
  const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
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
    <Popup isShow={open} onClose={onClose}>
      <div className="relative mx-3 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-2xl dark:border-primarydark/60 dark:bg-maindark sm:mx-4 sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 pb-4 pt-5 dark:from-emerald-700 dark:to-emerald-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg">
              {isPartial ? t("partialSell") : t("sell")}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              aria-label={t("close", { ns: "common" })}
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
              <p className="text-white/70 text-xs">{t("sumLabel")}</p>
              <p className="text-white font-bold text-base">
                {Number(order.total_price).toLocaleString(locale)} {t("currency")}
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 text-white/80 text-xs">
            <MapPin size={12} />
            <span>{order.district?.name}</span>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Qisman sotish toggle */}
          <div
            onClick={() => setIsPartial((p) => !p)}
            className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all select-none ${
              isPartial
                ? "border-orange-400 bg-orange-50 dark:border-orange-400/45 dark:bg-orange-400/10"
                : "border-orange-200 bg-orange-50 dark:border-orange-400/20 dark:bg-orange-400/10"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Info size={15} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t("partialSell")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("sellSeparately")}
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
                {t("products")}
              </p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/80 p-3 dark:border-white/10 dark:bg-primarydark/35"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">
                        {item.product?.name}
                      </p>
                      <p className="text-xs text-gray-400">{t("maxQuantity", { count: item.quantity })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setItemQty(item, getItemQty(item) - 1)}
                        disabled={!canDecreaseItem(item)}
                        className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-white/10 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {getItemQty(item)}
                      </span>
                      <button
                        onClick={() => setItemQty(item, getItemQty(item) + 1)}
                        className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors"
                      >
                        <Plus size={12} className="text-emerald-600 dark:text-emerald-200" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {isAtMinimumSelection && (
                <div className="mt-3 rounded-xl border border-error/20 bg-error/10 px-3 py-2">
                  <p className="text-sm font-bold text-error">
                    {t("minimumSelectionError")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* totalPrice — faqat qisman rejimda */}
          {isPartial && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                {t("paymentAmount")} <span className="text-red-400">*</span>
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-primarydark/35">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(totalPrice)}
                  onChange={(e) =>
                    setTotalPrice(sanitizeAmountInput(e.target.value))
                  }
                  placeholder="0"
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none dark:text-gray-100"
                />
                <span className="text-sm text-gray-400">{t("currency")}</span>
              </div>
            </div>
          )}

          {/* extraCost — har doim ko'rsatiladi */}
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              <Plus size={12} className="text-green-500" />
              {t("extraPayment")}
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-primarydark/35">
              <input
                type="text"
                inputMode="numeric"
                value={formatAmountInput(extraCost)}
                onChange={(e) =>
                  setExtraCost(sanitizeAmountInput(e.target.value))
                }
                placeholder="0"
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none dark:text-gray-100"
              />
              <span className="text-sm text-gray-400">{t("currency")}</span>
            </div>
          </div>

          {/* Izoh */}
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              <MessageSquare size={12} className="text-purple-400" />
              {t("note")}{" "}
              <span className="normal-case font-normal text-gray-400">({t("optional", { ns: "common" })})</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("writeNote")}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-gray-100 dark:placeholder:text-white/35"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 bg-primary px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-4 dark:border-white/10 dark:bg-maindark sm:pb-5">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle size={18} />
            {isLoading ? t("loading", { ns: "common" }) : t("sell")}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(SellModal);
