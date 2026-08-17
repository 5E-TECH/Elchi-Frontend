import { memo } from "react";
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

const Step3Details = () => {
  const { t, i18n } = useTranslation("orders");
  const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
  const { control: searchControl, watch: watchSearch } = useForm({
    defaultValues: { productSearch: "" },
  });
  const productSearch = watchSearch("productSearch");
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

  const updateItems = (
    updater: (items: OrderCreateFormValues["details"]["items"]) => OrderCreateFormValues["details"]["items"],
  ) => {
    const currentItems = getValues("details.items");
    setValue("details.items", updater(currentItems), {
      shouldDirty: true,
      shouldValidate: true,
    });
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

  const changeQty = (productId: string, delta: number) => {
    updateItems((items) =>
      items
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (productId: string) => {
    updateItems((items) => items.filter((item) => item.product_id !== productId));
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
              {details.items.map((item) => {
                const product = getProduct(item.product_id);

                return (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark/60"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-main/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                        {product?.name ?? t("productIdFallback", { id: item.product_id })}
                      </p>
                      <p className="text-xs text-main font-mono">
                        {product?.price?.toLocaleString(locale)} {t("currency")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeQty(item.product_id, -1)}
                        className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-maindark dark:text-primary">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(item.product_id, 1)}
                        className="w-7 h-7 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product_id)}
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
                  w-full px-3.5 py-2.5 rounded-xl text-sm font-mono
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
                  w-full px-3.5 py-2.5 rounded-xl text-sm
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
                  w-full px-3.5 py-2.5 rounded-xl text-sm resize-none
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
