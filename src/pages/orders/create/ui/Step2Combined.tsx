import { memo, useEffect, type ReactNode } from "react";
import {
  Building2,
  Home,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";
import { Controller, useForm, useFormContext, useWatch } from "react-hook-form";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { useProducts } from "../../../../entities/product";
import type { DeliveryType } from "../../../../entities/order/types/order";
import { GlobalSearchInput } from "../../../../features/search";
import type { RootState } from "../../../../app/config/store";
import SearchableSelect from "../../../../shared/ui/SearchableSelect";
import {
  formatPhone,
  formatPrice,
  stripPhone,
  stripPrice,
  type OrderCreateFormValues,
} from "../model/orderCreateForm";
import {
  FormFieldError,
  getFieldClassName,
} from "./formFieldStyles";
import { keepPhoneCaretAfterChange } from "../../../../shared/lib/phone";

const inputCls = `
  w-full min-h-12 px-3 py-2.5 rounded-xl text-sm
  bg-primary dark:bg-primarydark
  border border-gray-200 dark:border-primarydark/80
  text-maindark dark:text-primary placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
  transition-all duration-200
`;

interface FieldProps {
  label: string;
  required?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  error?: string;
  wide?: boolean;
}

const Field = ({ label, required, icon, children, error, wide }: FieldProps) => (
  <div className={`flex flex-col gap-1.5${wide ? " col-span-2" : ""}`}>
    <label className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-4">
      <span className="shrink-0">{icon}</span>
      <span className="wrap-break-word">{label}</span>
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    <FormFieldError message={error} />
  </div>
);

const SectionHeader = ({
  icon,
  title,
  sub,
}: {
  icon: ReactNode;
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

const Step2Combined = () => {
  const { t, i18n } = useTranslation(["orders", "common"]);
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
  const role = useSelector((state: RootState) => state.role.role);
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });
  const selectedRegionId = customer?.region_id ?? "";
  const isMarketRole = role === "market";
  const productSourceMarketId = market ? String(market.id) : "";

  const { useGetRegions, useGetDistricts } = useLogistics();
  const { data: regions, isLoading: regLoading } = useGetRegions();
  const { data: districts, isLoading: distLoading } = useGetDistricts(selectedRegionId);

  const { useGetByMarketId, useGetMyProducts } = useProducts();
  const marketProductsQuery = useGetByMarketId(productSourceMarketId, !isMarketRole);
  const myProductsQuery = useGetMyProducts(isMarketRole);
  const productsData = isMarketRole ? myProductsQuery.data : marketProductsQuery.data;
  const prodLoading = isMarketRole ? myProductsQuery.isLoading : marketProductsQuery.isLoading;

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

  const regionList = toArray(regions);
  const districtList = toArray(districts);
  const getAreaOptionLabel = (item: any) => {
    const satoCode = item?.sato_code ? ` • ${item.sato_code}` : "";

    return `${item?.name ?? "—"}${satoCode}`;
  };
  const regionOptions = regionList.map((region: any) => ({
    value: String(region.id),
    label: getAreaOptionLabel(region),
  }));
  const districtOptions = districtList.map((district: any) => ({
    value: String(district.id),
    label: getAreaOptionLabel(district),
  }));
  const allProducts = toArray(productsData);
  const filteredProducts = allProducts.filter((product: any) =>
    product.name?.toLowerCase().includes(productSearch.toLowerCase()),
  );

  useEffect(() => {
    setValue("customer.district_id", "");
  }, [selectedRegionId, setValue]);

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

  const getProduct = (id: string) =>
    allProducts.find((product: any) => String(product.id) === id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-6">
      <div className="flex flex-col gap-4 sm:gap-5 bg-primary dark:bg-primarydark/30 rounded-2xl border border-gray-200 dark:border-primarydark p-3 sm:p-5">
        <SectionHeader
          icon={<User size={18} className="text-main" />}
          title={t("customerInfo")}
          sub={t("customerInfoSubtitle")}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Controller
            control={control}
            name="customer.phone"
            render={({ field }) => (
              <Field
                label={t("phone")}
                required
                icon={<Phone size={12} />}
                error={errors.customer?.phone?.message}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono z-10">
                    +998
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="XX XXX XX XX"
                    value={formatPhone(field.value)}
                    onChange={(event) => {
                      const nextValue = stripPhone(event.target.value);
                      const nextDisplayValue = formatPhone(nextValue);
                      field.onChange(nextValue);
                      keepPhoneCaretAfterChange(event.target, nextDisplayValue);
                    }}
                    className={getFieldClassName(
                      `${inputCls} pl-14 font-mono tracking-wider`,
                      !!errors.customer?.phone?.message,
                    )}
                  />
                </div>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="customer.extra_phone"
            render={({ field }) => (
              <Field
                label={t("additionalPhone")}
                icon={<Phone size={12} />}
                error={errors.customer?.extra_phone?.message}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono z-10">
                    +998
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="XX XXX XX XX"
                    value={formatPhone(field.value)}
                    onChange={(event) => {
                      const nextValue = stripPhone(event.target.value);
                      const nextDisplayValue = formatPhone(nextValue);
                      field.onChange(nextValue);
                      keepPhoneCaretAfterChange(event.target, nextDisplayValue);
                    }}
                    className={getFieldClassName(
                      `${inputCls} pl-14 font-mono tracking-wider`,
                      !!errors.customer?.extra_phone?.message,
                    )}
                  />
                </div>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="customer.name"
            render={({ field }) => (
              <Field
                label={t("customerName")}
                required
                icon={<User size={12} />}
                error={errors.customer?.name?.message}
              >
                <input
                  {...field}
                  type="text"
                  placeholder={t("enterName")}
                  className={getFieldClassName(inputCls, !!errors.customer?.name?.message)}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="customer.region_id"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <SearchableSelect
                  label={`${t("filterRegion")} *`}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={regionOptions}
                  placeholder={
                    regLoading ? t("loading", { ns: "common" }) : t("selectRegion")
                  }
                  icon={MapPin}
                  loading={regLoading}
                  disabled={regLoading}
                />
                <FormFieldError message={errors.customer?.region_id?.message} />
              </div>
            )}
          />

          <Controller
            control={control}
            name="customer.district_id"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <SearchableSelect
                  label={`${t("district")} *`}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={districtOptions}
                  placeholder={
                    !selectedRegionId
                      ? t("selectRegionFirst")
                      : distLoading
                        ? t("loading", { ns: "common" })
                        : t("selectDistrict")
                  }
                  icon={Building2}
                  loading={distLoading}
                  disabled={!selectedRegionId || distLoading}
                />
                <FormFieldError message={errors.customer?.district_id?.message} />
              </div>
            )}
          />

          <Controller
            control={control}
            name="customer.address"
            render={({ field }) => (
              <Field
                label={t("address")}
                icon={<Home size={12} />}
                error={errors.customer?.address?.message}
                wide
              >
                <textarea
                  {...field}
                  rows={2}
                  placeholder={t("enterFullAddress")}
                  className={getFieldClassName(
                    `${inputCls} resize-none`,
                    !!errors.customer?.address?.message,
                  )}
                />
              </Field>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:gap-5 bg-primary dark:bg-primarydark/30 rounded-2xl border border-gray-200 dark:border-primarydark p-3 sm:p-5">
        <SectionHeader
          icon={<ShoppingBag size={18} className="text-main" />}
          title={t("details")}
          sub={t("selectedProductsSummary", { count: details.items.length })}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="flex flex-col gap-2">
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
                  inputClassName={`${inputCls} py-2 pl-11 shadow-none focus:shadow-none`}
                  iconClassName="text-gray-400 group-focus-within:text-main"
                  clearButtonClassName="text-gray-400 hover:text-main"
                />
              )}
            />
            <div className="flex flex-col gap-1.5 max-h-55 sm:max-h-50 overflow-y-auto custom-scrollbar pr-0.5">
              {prodLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-xl bg-gray-100 dark:bg-primarydark animate-pulse"
                  />
                ))
              ) : filteredProducts.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-1.5 text-gray-400">
                  <ShoppingBag size={26} strokeWidth={1} />
                  <p className="text-xs">{t("notFound", { ns: "common" })}</p>
                </div>
              ) : (
                filteredProducts.map((product: any) => {
                  const isAdded = details.items.some(
                    (item) => item.product_id === String(product.id),
                  );

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className={`
                        flex items-center gap-2 px-3 py-2.5 rounded-xl text-left
                        border-2 transition-all duration-200 group cursor-pointer
                        ${isAdded
                          ? "border-main/40 bg-main/5 dark:bg-main/10"
                          : "border-gray-200 dark:border-primarydark bg-primary dark:bg-primarydark hover:border-main/30"}
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
                          <ShoppingBag size={13} className="text-main/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-maindark dark:text-primary truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-main font-mono">
                          {product.price?.toLocaleString(locale)} {t("currency")}
                        </p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isAdded ? "bg-main text-primary" : "bg-sidebar dark:bg-background text-main"}`}
                      >
                        <Plus size={12} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <FormFieldError message={errors.details?.items?.message} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("selectedCount")}</p>
            {details.items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2 text-gray-400 border-2 border-dashed border-gray-200 dark:border-primarydark rounded-xl">
                <ShoppingBag size={26} strokeWidth={1} />
                <p className="text-xs text-center">{t("selectProductShort")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-60 sm:max-h-50 overflow-y-auto custom-scrollbar pr-0.5">
                {details.items.map((item) => {
                  const product = getProduct(item.product_id);
                  return (
                    <div
                      key={item.product_id}
                      className="flex flex-col items-stretch gap-2 p-2.5 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-primarydark/60 sm:flex-row sm:items-center"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sidebar dark:bg-background flex items-center justify-center shrink-0">
                        <ShoppingBag size={12} className="text-main/50" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-maindark dark:text-primary truncate">
                          {product?.name ?? `#${item.product_id}`}
                        </p>
                        <p className="text-xs text-main font-mono">
                          {product?.price?.toLocaleString(locale)} {t("currency")}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-1 sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => changeQty(item.product_id, -1)}
                          className="w-6 h-6 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-maindark dark:text-primary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQty(item.product_id, 1)}
                          className="w-6 h-6 rounded-lg bg-sidebar dark:bg-background border border-gray-200 dark:border-primarydark flex items-center justify-center hover:border-main/40 transition-colors cursor-pointer"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="flex justify-end sm:block">
                        <button
                          type="button"
                          onClick={() => removeItem(item.product_id)}
                          className="text-gray-300 hover:text-error transition-colors ml-0.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-primarydark pt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Controller
            control={control}
            name="details.where_deliver"
            render={({ field }) => (
              <div className="sm:col-span-2 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t("deliveryType")}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                  {(
                    [
                      { value: "center" as DeliveryType, label: t("deliveryCenter"), icon: Building2 },
                      { value: "address" as DeliveryType, label: t("deliveryHome"), icon: Home },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                    className={getFieldClassName(`
                        flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center
                        border-2 font-semibold text-sm transition-all duration-200 cursor-pointer
                        ${field.value === value
                          ? "border-main bg-main text-primary shadow-md shadow-main/20"
                          : "border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/40"}
                      `, !!errors.details?.where_deliver?.message)}
                    >
                      <Icon size={15} />
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
              <Field label={t("totalPrice")} required error={errors.details?.total_price?.message}>
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
              </Field>
            )}
          />

          <Controller
            control={control}
            name="details.operator"
            render={({ field }) => (
              <Field label={t("operator")} icon={<User size={12} />}>
                <input
                  {...field}
                  type="text"
                  placeholder={t("operatorPlaceholder")}
                  className={getFieldClassName(inputCls, !!errors.details?.operator?.message)}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="details.comment"
            render={({ field }) => (
              <Field label={t("note")} wide>
                <textarea
                  {...field}
                  rows={2}
                  placeholder={t("notePlaceholder")}
                  className={getFieldClassName(
                    `${inputCls} resize-none`,
                    !!errors.details?.comment?.message,
                  )}
                />
              </Field>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(Step2Combined);
