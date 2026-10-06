import { memo, useState } from "react";
import { Building2, Home, Minus, Plus, ShoppingBag, Trash2, User } from "lucide-react";
import { Controller, useForm, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useProducts } from "../../../../entities/product";
import type { DeliveryType } from "../../../../entities/order/types/order";
import { GlobalSearchInput } from "../../../../features/search";
import {
  formatPrice,
  stripPrice,
  type OrderCreateFormValues,
} from "../model/orderCreateForm";
import { FormFieldError, getFieldClassName } from "./formFieldStyles";

/**
 * Buyurtma qatori: katalog mahsuloti (`product_id` to'la) yoki MAXSUS / katalogsiz
 * mahsulot (`product_id = null`, nomi `product_name` matnida — hamkor
 * posilkalaridagidek). Backend order-service ikkala shaklni ham qabul qiladi.
 *
 * ⚠️ Umumiy `OrderItem` turi hali `product_id`ni majburiy string deb biladi va
 * yaratish sxemasi (`orderCreateForm.ts`) uni `.required()` qiladi. Maxsus qator
 * UI'da qo'shiladi, lekin SUBMIT'da o'tishi uchun o'sha tur va sxema `product_id:
 * null` + `product_name` ni qabul qiladigan qilib yumshatilishi kerak (ikkalasi
 * ham bu fayldan tashqarida). Shu paytgacha bu yerda local tur + cast ishlatiladi.
 */
type DraftItem = {
  product_id: string | null;
  product_name?: string;
  quantity: number;
};

/** Katalog qatori `product_id` bilan, maxsus qator esa nomi bilan farqlanadi. */
const draftItemKey = (item: DraftItem): string =>
  item.product_id != null ? `catalog:${item.product_id}` : `custom:${item.product_name ?? ""}`;

const Step3Details = () => {
  const { t, i18n } = useTranslation("orders");
  const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
  const { control: searchControl, watch: watchSearch } = useForm({
    defaultValues: { productSearch: "" },
  });
  const productSearch = watchSearch("productSearch");
  // Katalogda yo'q mahsulotni qo'lda qo'shish uchun local kiritish holati.
  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<OrderCreateFormValues>();

  const market = useWatch({ control, name: "market" });
  const details = useWatch({ control, name: "details" });
  const { useGetByMarketId } = useProducts();
  const { data: productsData, isLoading } = useGetByMarketId(market ? String(market.id) : "");

  const toArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (
      typeof value === "object" &&
      value !== null &&
      "data" in value &&
      Array.isArray((value as { data?: unknown[] }).data)
    ) {
      return (value as { data: unknown[] }).data;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "items" in value &&
      Array.isArray((value as { items?: unknown[] }).items)
    ) {
      return (value as { items: unknown[] }).items;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "results" in value &&
      Array.isArray((value as { results?: unknown[] }).results)
    ) {
      return (value as { results: unknown[] }).results;
    }
    return [];
  };

  const allProducts = toArray(productsData);
  const filtered = allProducts.filter((product: any) =>
    product.name?.toLowerCase().includes(productSearch.toLowerCase()),
  );

  const updateItems = (updater: (items: DraftItem[]) => DraftItem[]) => {
    const currentItems = getValues("details.items") as unknown as DraftItem[];
    setValue(
      "details.items",
      updater(currentItems) as unknown as OrderCreateFormValues["details"]["items"],
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const addProduct = (product: any) => {
    updateItems((items) => {
      const existing = items.find((item) => item.product_id === String(product.id));

      if (existing) {
        return items.map((item) =>
          item.product_id === String(product.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...items, { product_id: String(product.id), quantity: 1 }];
    });
  };

  // Maxsus (katalogsiz) mahsulot: operator nomini yozadi, qator `product_id: null`
  // + `product_name` bilan qo'shiladi (hamkor posilkalaridagi shakl — backend
  // order-service qabul qiladi). Bir xil nom qayta kiritilsa soni ortadi.
  const addCustomProduct = () => {
    const name = customName.trim();
    const quantity = Math.max(1, Math.floor(customQty) || 1);
    if (!name) return;

    updateItems((items) => {
      const existing = items.find(
        (item) => item.product_id == null && item.product_name === name,
      );

      if (existing) {
        return items.map((item) =>
          item.product_id == null && item.product_name === name
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [...items, { product_id: null, product_name: name, quantity }];
    });

    setCustomName("");
    setCustomQty(1);
  };

  const changeQty = (key: string, delta: number) => {
    updateItems((items) =>
      items
        .map((item) =>
          draftItemKey(item) === key
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (key: string) => {
    updateItems((items) => items.filter((item) => draftItemKey(item) !== key));
  };

  const getProduct = (productId: string) =>
    allProducts.find((product: any) => String(product.id) === productId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
          <ShoppingBag size={18} className="text-main" />
        </div>
        <div>
          <h3 className="font-semibold text-maindark dark:text-primary text-base">
            {t("details")}
          </h3>
          <p className="text-xs text-gray-400">
            {t("selectedProductsSummary", { count: details.items.length })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("addProduct")}
          </p>

          <Controller
            control={searchControl}
            name="productSearch"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={field.onChange}
                placeholder={t("searchProduct")}
                className="w-full"
                inputClassName="
                  bg-primary dark:bg-primarydark
                  border border-gray-200 dark:border-primarydark
                  text-maindark dark:text-primary placeholder:text-gray-400
                  py-2 shadow-none focus:shadow-none
                "
                iconClassName="text-gray-400 group-focus-within:text-main"
                clearButtonClassName="text-gray-400 hover:text-main"
              />
            )}
          />

          <div className="max-h-70 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 rounded-xl bg-gray-100 dark:bg-primarydark animate-pulse"
                />
              ))
            ) : filtered.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
                <ShoppingBag size={30} strokeWidth={1} />
                <p className="text-xs">{t("productNotFound")}</p>
              </div>
            ) : (
              filtered.map((product: any) => {
                const isAdded = details.items.some(
                  (item) => item.product_id === String(product.id),
                );

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                      border-2 transition-all duration-200 group cursor-pointer
                      ${isAdded
                        ? "border-main/40 bg-main/5 dark:bg-main/10"
                        : "border-gray-200 dark:border-primarydark bg-primary dark:bg-primarydark hover:border-main/30 hover:shadow-sm"}
                    `}
                  >
                    <div className="w-10 h-10 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0 overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag size={16} className="text-main/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-main font-mono">
                        {product.price?.toLocaleString(locale)} {t("currency")}
                      </p>
                    </div>
                    <div
                      className={`
                        w-7 h-7 rounded-lg flex items-center justify-center transition-all
                        ${isAdded
                          ? "bg-main text-primary"
                          : "bg-sidebar dark:bg-background text-main group-hover:bg-main/10"}
                      `}
                    >
                      <Plus size={14} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Maxsus (katalogsiz) mahsulot — operator nomini yozib qo'shadi. */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-200 dark:border-primarydark p-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t("customProductLabel", { defaultValue: "Maxsus mahsulot" })}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomProduct();
                  }
                }}
                placeholder={t("customProductPlaceholder", { defaultValue: "Mahsulot nomi" })}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl text-base md:text-sm bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark text-maindark dark:text-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all"
              />
              <input
                type="number"
                min={1}
                value={customQty}
                onChange={(event) =>
                  setCustomQty(Math.max(1, Math.floor(Number(event.target.value)) || 1))
                }
                aria-label={t("quantity", { defaultValue: "Soni" })}
                className="w-16 px-2 py-2 rounded-xl text-base md:text-sm text-center bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark text-maindark dark:text-primary focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all"
              />
              <button
                type="button"
                onClick={addCustomProduct}
                disabled={!customName.trim()}
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-main text-primary transition-all hover:bg-main/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <Plus size={14} />
                {t("addCustom", { defaultValue: "Qo'shish" })}
              </button>
            </div>
          </div>

          <FormFieldError message={errors.details?.items?.message} />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("selectedProducts")}
          </p>

          {details.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-gray-400 border-2 border-dashed border-gray-200 dark:border-primarydark rounded-xl">
              <ShoppingBag size={32} strokeWidth={1} />
              <p className="text-xs text-center">{t("selectProductHint")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-70 overflow-y-auto custom-scrollbar pr-1">
              {(details.items as unknown as DraftItem[]).map((item) => {
                const key = draftItemKey(item);
                const product = item.product_id != null ? getProduct(item.product_id) : undefined;
                const displayName =
                  item.product_name ??
                  product?.name ??
                  t("productIdFallback", { id: item.product_id ?? "" });

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark/60"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-main/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                        {displayName}
                      </p>
                      {product?.price != null ? (
                        <p className="text-xs text-main font-mono">
                          {product.price.toLocaleString(locale)} {t("currency")}
                        </p>
                      ) : item.product_id == null ? (
                        <p className="text-xs text-gray-400">
                          {t("customProductTag", { defaultValue: "Maxsus mahsulot" })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeQty(key, -1)}
                        className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-maindark dark:text-primary">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(key, 1)}
                        className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(key)}
                      className="ml-1 text-gray-300 hover:text-error transition-colors cursor-pointer"
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

      <div className="border-t border-gray-200 dark:border-primarydark pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          control={control}
          name="details.where_deliver"
          render={({ field }) => (
            <div className="sm:col-span-2 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t("deliveryType")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "center" as DeliveryType, label: t("deliveryCenter"), icon: Building2 },
                  { value: "address" as DeliveryType, label: t("deliveryHome"), icon: Home },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.onChange(value)}
                    className={getFieldClassName(`
                      flex items-center justify-center gap-2 py-3 rounded-xl
                      border-2 font-semibold text-sm transition-all duration-200 cursor-pointer
                      ${field.value === value
                        ? "border-main bg-main text-primary shadow-md shadow-main/20"
                        : "border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/40"}
                    `, !!errors.details?.where_deliver?.message)}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        />

        <Controller
          control={control}
          name="details.total_price"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t("totalPrice")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formatPrice(field.value)}
                onChange={(event) => field.onChange(stripPrice(event.target.value))}
                className={getFieldClassName(`
                  w-full px-3.5 py-2.5 rounded-xl text-base md:text-sm font-mono
                  bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
                  text-maindark dark:text-primary placeholder:text-gray-400
                  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                  transition-all duration-200
                `, !!errors.details?.total_price?.message)}
              />
              <FormFieldError message={errors.details?.total_price?.message} />
            </div>
          )}
        />

        <Controller
          control={control}
          name="details.operator"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <User size={12} /> {t("operator")}
              </label>
              <input
                {...field}
                type="text"
                placeholder={t("operatorPlaceholder")}
                className={getFieldClassName(`
                  w-full px-3.5 py-2.5 rounded-xl text-base md:text-sm
                  bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
                  text-maindark dark:text-primary placeholder:text-gray-400
                  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                  transition-all duration-200
                `, !!errors.details?.operator?.message)}
              />
            </div>
          )}
        />

        <Controller
          control={control}
          name="details.comment"
          render={({ field }) => (
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t("note")}
              </label>
              <textarea
                {...field}
                rows={2}
                placeholder={t("notePlaceholder")}
                className={getFieldClassName(`
                  w-full px-3.5 py-2.5 rounded-xl text-base md:text-sm resize-none
                  bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark
                  text-maindark dark:text-primary placeholder:text-gray-400
                  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                  transition-all duration-200
                `, !!errors.details?.comment?.message)}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default memo(Step3Details);
