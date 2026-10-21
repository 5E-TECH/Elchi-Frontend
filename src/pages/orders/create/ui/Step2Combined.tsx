// dizayn-v2: superadmin-neworders-create-manual-step2, manager-new-orders-create-manual-step2, registrator-new-orders-create-step2, market-new-orders-create-manual, superadmin-neworders-create-manual-step2-customer-suggest, superadmin-neworders-create-manual-step2-existing-customer, market-new-orders-create-manual-existing-customer
import { memo, useEffect, useMemo, useState, type ReactNode, type Ref } from "react";
import { Building2, Check, CircleX, MapPin, Minus, Plus, ShoppingBag, Trash2, type LucideIcon } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { ProductThumb } from "../../../../entities/product/ui/ProductThumb";
import type { DeliveryType } from "../../../../entities/order/types/order";
import type { RootState } from "../../../../app/config/store";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { getUzbekistanPhoneDigits } from "../../../../shared/lib/phone";
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Pressable,
  Select,
  Skeleton,
  TextInput,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { orderItemKey, toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";
import { hasNoTariffs, readProductImageUrl, readProductPrice, tariffFor, type CatalogProduct } from "../model/orderPricing";
import { CreateAlert } from "./CreateAlert";
import { CustomerPhoneSuggest, type CustomerSuggestScope } from "./CustomerPhoneSuggest";
import { ExistingCustomerNotice } from "./ExistingCustomerNotice";
import { useMarketTariffs } from "./useMarketTariffs";
import { useOrderCatalog } from "./useOrderCatalog";

type OrderItemValue = OrderCreateFormValues["details"]["items"][number];

type AreaItem = { id: string | number; name?: string; sato_code?: string | null };

/** Mavjud naqsh: `nom • sato_code` — operator viloyat/tumanni kod bilan tekshira oladi. */
const toAreaOptions = (items: AreaItem[]): SelectOption[] =>
  items.map((item) => ({
    value: String(item.id),
    label: `${item.name ?? "—"}${item.sato_code ? ` • ${item.sato_code}` : ""}`,
  }));

/** Son tanlagich: «−» · son · «+» (har biri 44 px), chegarali guruh. «−» 1 da o'chiq. */
const QuantityStepper = ({
  value,
  groupLabel,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  value: number;
  groupLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (next: number) => void;
}) => (
  <div
    role="group"
    aria-label={groupLabel}
    className="inline-flex shrink-0 items-center rounded-xl border border-border-strong bg-surface"
  >
    <IconButton size="lg" icon={Minus} label={decreaseLabel} disabled={value <= 1} onClick={() => onChange(value - 1)} />
    <span className="min-w-7 text-center font-semibold tabular-nums text-text">{value}</span>
    <IconButton size="lg" icon={Plus} label={increaseLabel} onClick={() => onChange(value + 1)} />
  </div>
);

/**
 * Yetkazish turi kartasi (`.el-choice-card` + radio): tanlanganda `action` chegara va `action-soft` fon.
 * `price` berilsa (CS-B) — o'ngda standart narx («25 000 so'm» + «standart») yoki «Narx yo'q»; berilmasa
 * (menejer, registrator yoki narx hali kelmagan) — tur ikonkasi.
 */
const DeliveryChoice = ({
  name,
  value,
  checked,
  title,
  hint,
  icon: Icon,
  price,
  invalid,
  onSelect,
  inputRef,
  describedBy,
}: {
  name: string;
  value: DeliveryType;
  checked: boolean;
  title: string;
  hint: string;
  icon: LucideIcon;
  price?: ReactNode;
  invalid: boolean;
  onSelect: (value: DeliveryType) => void;
  /** react-hook-form `field.ref` — xato bo'lsa yuborishda fokus shu radioga o'tadi. */
  inputRef?: Ref<HTMLInputElement>;
  /** Xato matni `id` si (radio fokusda bo'lsa ham o'qiladi). */
  describedBy?: string;
}) => (
  <label
    className={cx(
      // `relative` — `sr-only` radio karta ichida qoladi (fokusda sahifa boshqa joyga sakramaydi).
      "relative flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm",
      "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
      "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus",
      checked
        ? "border-action bg-action-soft"
        : cx("bg-input hover:border-text-subtle", invalid ? "border-danger" : "border-border-strong"),
    )}
  >
    <input
      ref={inputRef}
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={() => onSelect(value)}
      // Allaqachon tanlangan kartani bosish ham qo'lda tanlov (change kelmaydi) — keyin kelgan sukut ustidan yozmasin.
      onClick={() => onSelect(value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="sr-only"
    />
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
        checked ? "border-action" : "border-border-strong",
      )}
    >
      {checked ? <span className="size-2.5 rounded-full bg-action" /> : null}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-semibold text-text">{title}</span>
      <span className="text-xs text-text-muted">{hint}</span>
    </span>
    {price ?? (
      <Icon size={18} aria-hidden="true" className={cx("shrink-0", checked ? "text-action-fg" : "text-text-muted")} />
    )}
  </label>
);

/** Karta o'ngidagi narx bloki (maket `*-step2-existing-customer`): summa + «standart» yoki «Narx yo'q». */
const DeliveryPrice = ({ amount, money, standardLabel, noPriceLabel }: {
  amount: number | null;
  money: (value: number) => string;
  standardLabel: string;
  noPriceLabel: string;
}) =>
  amount == null ? (
    <span className="shrink-0 text-[13px] text-text-muted">{noPriceLabel}</span>
  ) : (
    <span className="flex shrink-0 flex-col items-end text-right">
      <span className="font-semibold whitespace-nowrap text-text">{money(amount)}</span>
      <span className="text-xs text-text-muted">{standardLabel}</span>
    </span>
  );

/** Operator 2-qadamni to'ldira boshladimi (telefon, ism, viloyat yoki mahsulot) — kech kelgan sukut tur qo'llanmaydi. */
const isFormStarted = (values: OrderCreateFormValues) =>
  Boolean(values.customer.phone || values.customer.name?.trim() || values.customer.region_id) ||
  (values.details.items?.length ?? 0) > 0;

const WHERE_DELIVER_ERROR_ID = "details.where_deliver-error";
const ITEMS_ERROR_ID = "details.items-error";

/** Karta ostidagi xato matni (`Field error` ko'rinishida). */
const InlineError = ({ id, children }: { id?: string; children: ReactNode }) => (
  <p id={id} className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
    <CircleX size={16} aria-hidden="true" className="mt-px shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);

/**
 * 2-QADAM — MIJOZ VA MAHSULOTLAR (maket `*-create-manual-step2`, `market-new-orders-create-manual`):
 *  - «Mijoz ma'lumotlari»: telefon · qo'shimcha raqam · mijoz ismi (desktopda 3 ustun); «Yetkazish manzili»:
 *    viloyat · tuman (qidiruvli), yetkazish turi (2 radio-karta), manzil · izoh; telefon bo'yicha mijoz taklifi
 *    (`CustomerPhoneSuggest`) va tanlangan mavjud mijoz bloki (`ExistingCustomerNotice`, CS-A);
 *  - «Buyurtma tafsilotlari *»: chapda katalogdan qo'shish (qidiruv + ro'yxat) va katalogda yo'q mahsulot
 *    (nomi + soni), o'ngda tanlangan mahsulotlar (son tanlagich, olib tashlash).
 * CS-B (maket `*-step2-existing-customer`): yetkazish turi kartalarida market standart narxi (superadmin, admin,
 * market) va «Narx yo'q» holati, sukut tur — `default_tariff`; mahsulot rasmi (40 px, `ProductThumb`); narx matni
 * «2 × 45 000 so'm» · «Narxi kiritilmagan» · «Katalogdan tashqari · narxsiz».
 * Summa, operator va «Buyurtma yaratish» — yon ustundagi `Step2Summary` da.
 */
const Step2Combined = () => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: unknown) => formatMoneyLocalized(value, { language });

  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<OrderCreateFormValues>();

  const market = useWatch({ control, name: "market" });
  const items = useWatch({ control, name: "details.items" });
  const whereDeliver = useWatch({ control, name: "details.where_deliver" });
  const deliveryTypeTouched = useWatch({ control, name: "deliveryTypeTouched" });
  const selectedRegionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const role = useSelector((state: RootState) => state.role.role);
  const roleName = useSelector((state: RootState) => state.role.name);
  const roleId = useSelector((state: RootState) => state.role.id);
  const isMarketRole = role === "market";
  const productSourceMarketId = market ? String(market.id) : "";

  const { useGetRegions, useGetDistricts } = useLogistics();
  const { data: regions, isLoading: regLoading } = useGetRegions();
  const { data: districts, isLoading: distLoading } = useGetDistricts(selectedRegionId);

  const { products: allProducts, findProduct, isLoading: prodLoading } = useOrderCatalog(control);
  const tariffState = useMarketTariffs(control);
  const tariffs = tariffState.status === "ready" ? tariffState.tariffs : null;
  const defaultDeliveryType = tariffs?.defaultType ?? null;

  // Sukut turi — market kartasidagi `default_tariff` (CS-B): tariflar shu market uchun kelgach, tur qo'lda
  // tanlanmagan bo'lsa moslanadi. Qo'lda tanlangani ustidan yozilmaydi; yaratishdan keyingi `reset` da yana sukut.
  // Tariflar kech kelsa (sekin `GET users/:id`, qayta urinish) va operator formani to'ldira boshlagan bo'lsa —
  // ko'rinib turgan tur o'z-o'zidan almashmaydi (manzil birdan majburiy bo'lib qolmasin).
  useEffect(() => {
    if (deliveryTypeTouched || !defaultDeliveryType || whereDeliver === defaultDeliveryType) return;
    if (isFormStarted(getValues())) return;
    setValue("details.where_deliver", defaultDeliveryType);
  }, [defaultDeliveryType, deliveryTypeTouched, getValues, setValue, whereDeliver]);

  const regionOptions = useMemo(() => toAreaOptions(toApiList<AreaItem>(regions)), [regions]);
  const districtOptions = useMemo(() => toAreaOptions(toApiList<AreaItem>(districts)), [districts]);

  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return query ? allProducts.filter((product) => product.name?.toLowerCase().includes(query)) : allProducts;
  }, [allProducts, productSearch]);

  const updateItems = (updater: (current: OrderItemValue[]) => OrderItemValue[]) => {
    setValue("details.items", updater(getValues("details.items")), { shouldDirty: true, shouldValidate: true });
  };

  // Katalogdagi mahsulot: bor bo'lsa soni +1 (avvalgidek), yo'q bo'lsa 1 ta bilan qo'shiladi.
  const addProduct = (product: CatalogProduct) => {
    const id = String(product.id);
    updateItems((current) =>
      current.some((item) => item.product_id === id)
        ? current.map((item) => (item.product_id === id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { product_id: id, quantity: 1 }],
    );
  };

  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const addCustomProduct = () => {
    const name = customName.trim();
    if (!name) return;
    updateItems((current) => [...current, { product_id: null, product_name: name, quantity: Math.max(1, customQty) }]);
    setCustomName("");
    setCustomQty(1);
  };

  const setQuantity = (key: string, quantity: number) => {
    updateItems((current) =>
      current.map((item) => (orderItemKey(item) === key ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );
  };

  const removeItem = (key: string) => updateItems((current) => current.filter((item) => orderItemKey(item) !== key));

  /** Tanlangan mahsulot ostidagi narx matni: «185 000 so'm», «2 × 45 000 so'm», «Narxi kiritilmagan». */
  const itemPriceText = (item: OrderItemValue, product: CatalogProduct | undefined) => {
    if (item.product_id == null) return t("createPricing.catalogLessNoPrice");
    if (!product) return "—";
    const price = readProductPrice(product);
    if (price == null) return t("createPricing.priceMissing");
    return item.quantity > 1
      ? t("createPricing.unitTimes", { quantity: formatNumberLocalized(item.quantity, { language }), price: money(price) })
      : money(price);
  };

  const selectDeliveryType = (onChange: (value: DeliveryType) => void) => (value: DeliveryType) => {
    setValue("deliveryTypeTouched", true);
    onChange(value);
  };
  const deliveryPrice = (type: DeliveryType) =>
    tariffs ? (
      <DeliveryPrice
        amount={tariffFor(tariffs, type)}
        money={money}
        standardLabel={t("createPricing.standard")}
        noPriceLabel={t("createPricing.noPrice")}
      />
    ) : undefined;
  const deliveryOwner = isMarketRole
    ? t("createPricing.ownStandard")
    : t("createPricing.marketStandard", { market: market?.name ?? "—" });
  // «Sukut bo'yicha: …» faqat sukut turining narxi bo'lsa — aks holda karta «Narx yo'q» deb turganda izoh unga zid.
  const deliveryHint =
    tariffs && !hasNoTariffs(tariffs)
      ? defaultDeliveryType && tariffFor(tariffs, defaultDeliveryType) != null
        ? t("createPricing.deliveryHintDefault", {
            owner: deliveryOwner,
            type: defaultDeliveryType === "address" ? t("deliveryToHome") : t("deliveryToCenter"),
          })
        : deliveryOwner
      : null;

  const catalogOwner = isMarketRole ? roleName : market?.name;
  // Taklif doirasi backend bilan bir xil: admin — barcha mijozlar, market — o'zi, qolganlar — tanlangan market.
  const suggestScope: CustomerSuggestScope =
    role === "superadmin" || role === "admin" ? "all" : isMarketRole ? "own" : "market";
  const itemsError = errors.details?.items?.message ?? errors.details?.items?.root?.message;
  const addressRequired = whereDeliver === "address";

  return (
    <>
      <Card padding="none" title={t("customerInfo")} description={t("createCustomer.cardSubtitle")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4 p-5">
          <CustomerPhoneSuggest
            scope={suggestScope}
            marketId={productSourceMarketId || null}
            marketName={catalogOwner}
          />
          <Controller
            control={control}
            name="customer.extra_phone"
            render={({ field }) => (
              <Field id="customer.extra_phone" label={t("additionalPhone")} error={errors.customer?.extra_phone?.message}>
                <TextInput
                  mode="phone"
                  name={field.name}
                  placeholder="XX XXX XX XX"
                  value={field.value ? `+998${field.value}` : ""}
                  onValueChange={(next) => field.onChange(getUzbekistanPhoneDigits(next))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="customer.name"
            render={({ field }) => (
              <Field id="customer.name" label={t("createCustomerName")} required error={errors.customer?.name?.message}>
                <TextInput
                  name={field.name}
                  placeholder={t("enterName")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <ExistingCustomerNotice
            isMarketRole={isMarketRole}
            marketId={isMarketRole ? roleId : productSourceMarketId || null}
            marketName={catalogOwner}
          />
        </div>

        <div className="border-t border-border px-5 pt-5 pb-4">
          <h3 className="text-sm font-semibold text-text">{t("createDeliveryAddressTitle")}</h3>
        </div>
        {/*
          Ikki ustun (telefonda bitta). `auto-fit` emas: to'liq qatorli «Yetkazish turi» (`col-span-full`) keng ekranda
          bo'sh uchinchi ustunni ushlab qolib, viloyat/tuman qatorini 2/3 ga qisib qo'yardi.
        */}
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 max-md:grid-cols-1">
          <Controller
            control={control}
            name="customer.region_id"
            render={({ field }) => (
              <Field
                id="customer.region_id"
                label={t("filterRegion")}
                required
                labelAs="span"
                error={errors.customer?.region_id?.message}
              >
                <Select
                  searchable
                  name={field.name}
                  options={regionOptions}
                  value={field.value || null}
                  onChange={(next) => {
                    const value = next ?? "";
                    // Tuman faqat viloyat ALMASHGANDA tozalanadi — 2-qadamga qaytib kelganda (qayta mount) saqlanadi.
                    if (value !== field.value) setValue("customer.district_id", "");
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  placeholder={regLoading ? t("loading", { ns: "common" }) : t("selectRegion")}
                  loading={regLoading}
                  disabled={regLoading}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="customer.district_id"
            render={({ field }) => (
              <Field
                id="customer.district_id"
                label={t("district")}
                required
                labelAs="span"
                error={errors.customer?.district_id?.message}
              >
                <Select
                  searchable
                  name={field.name}
                  options={districtOptions}
                  value={field.value || null}
                  onChange={(next) => field.onChange(next ?? "")}
                  onBlur={field.onBlur}
                  placeholder={
                    !selectedRegionId
                      ? t("selectRegionFirst")
                      : distLoading
                        ? t("loading", { ns: "common" })
                        : t("selectDistrict")
                  }
                  loading={distLoading}
                  disabled={!selectedRegionId || distLoading}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="details.where_deliver"
            render={({ field }) => (
              // XsoWhKP5: xato holati va matni har radioga (`aria-invalid` + `aria-describedby`) bog'langan. Guruhga
              // (`fieldset`) qo'yilmaydi — aks holda ekran o'quvchi guruhga kirganda xatoni ikki marta o'qiydi.
              <fieldset className="col-span-full m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-semibold text-text">
                  {t("deliveryType")}
                  <span aria-hidden="true" className="text-danger-fg">
                    {" *"}
                  </span>
                </legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
                  <DeliveryChoice
                    name={field.name}
                    value="center"
                    checked={field.value === "center"}
                    title={t("deliveryToCenter")}
                    hint={t("createDeliveryCenterHint")}
                    icon={Building2}
                    price={deliveryPrice("center")}
                    invalid={Boolean(errors.details?.where_deliver)}
                    describedBy={errors.details?.where_deliver?.message ? WHERE_DELIVER_ERROR_ID : undefined}
                    onSelect={selectDeliveryType(field.onChange)}
                    inputRef={field.ref}
                  />
                  <DeliveryChoice
                    name={field.name}
                    value="address"
                    checked={field.value === "address"}
                    title={t("deliveryToHome")}
                    hint={t("createDeliveryHomeHint")}
                    icon={MapPin}
                    price={deliveryPrice("address")}
                    invalid={Boolean(errors.details?.where_deliver)}
                    describedBy={errors.details?.where_deliver?.message ? WHERE_DELIVER_ERROR_ID : undefined}
                    onSelect={selectDeliveryType(field.onChange)}
                  />
                </div>
                {deliveryHint ? <p className="m-0 pt-1.5 text-xs text-text-muted">{deliveryHint}</p> : null}
                {hasNoTariffs(tariffs) ? (
                  <CreateAlert
                    tone="warning"
                    className="mt-3"
                    title={isMarketRole ? t("createPricing.noTariffOwnTitle") : t("createPricing.noTariffTitle")}
                  >
                    {isMarketRole ? t("createPricing.noTariffOwnBody") : t("createPricing.noTariffBody")}
                  </CreateAlert>
                ) : null}
                {errors.details?.where_deliver?.message ? (
                  <div className="pt-1.5">
                    <InlineError id={WHERE_DELIVER_ERROR_ID}>{errors.details.where_deliver.message}</InlineError>
                  </div>
                ) : null}
              </fieldset>
            )}
          />

          <Controller
            control={control}
            name="customer.address"
            render={({ field }) => (
              <Field
                id="customer.address"
                label={t("address")}
                required={addressRequired}
                error={errors.customer?.address?.message}
              >
                <TextInput
                  multiline
                  rows={3}
                  name={field.name}
                  placeholder={t("enterFullAddress")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="details.comment"
            render={({ field }) => (
              <Field id="details.comment" label={t("note")} error={errors.details?.comment?.message}>
                <TextInput
                  multiline
                  rows={3}
                  name={field.name}
                  placeholder={t("notePlaceholder")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
        </div>
      </Card>

      <Card
        title={
          <>
            {t("details")}
            <span aria-hidden="true" className="text-danger-fg">
              {" *"}
            </span>
          </>
        }
        description={t("selectedProductsSummary", { count: items.length })}
        bodyClassName="flex flex-col gap-4"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            {/* «Kamida bitta mahsulot» xatosi karta ostida — qidiruv maydoni unga faqat matn bilan bog'langan
                (XsoWhKP5). Qizil holat (`invalid`) yo'q: step2 maketlarida bu xato faqat karta ostida, foydalanuvchi
                hali yozmagan qidiruv maydoni xato emas. */}
            <Field id="create-product-search" label={t("addProduct")}>
              <TextInput
                mode="search"
                placeholder={t("searchProduct")}
                value={productSearch}
                onValueChange={setProductSearch}
                aria-describedby={itemsError ? ITEMS_ERROR_ID : undefined}
              />
            </Field>

            <ul
              aria-label={t("createCatalogLabel", { market: catalogOwner ?? "—" })}
              aria-busy={prodLoading || undefined}
              className="m-0 flex max-h-[296px] list-none flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl bg-sunken p-1 text-sm"
            >
              {prodLoading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <li key={index} aria-hidden="true" className="flex min-h-13 items-center gap-3 px-3 py-2">
                    <Skeleton shape="block" tone="border" width={40} height={40} />
                    <span className="flex flex-1 flex-col gap-1.5">
                      <Skeleton tone="border" width="55%" />
                      <Skeleton tone="border" width="30%" />
                    </span>
                  </li>
                ))
              ) : allProducts.length === 0 ? (
                // Katalog umuman bo'sh — «Topilmadi» emas (hech narsa qidirilmagan), qayerdan qo'shish aytiladi (D-19).
                <li>
                  <EmptyState
                    icon={ShoppingBag}
                    title={t("createCatalogEmpty")}
                    description={t("createCatalogEmptyHint")}
                  />
                </li>
              ) : filteredProducts.length === 0 ? (
                <li>
                  <EmptyState icon={ShoppingBag} title={t("notFound", { ns: "common" })} />
                </li>
              ) : (
                filteredProducts.map((product) => {
                  const isAdded = items.some((item) => item.product_id === String(product.id));
                  const price = readProductPrice(product);
                  return (
                    <li key={product.id}>
                      <Pressable
                        onClick={() => addProduct(product)}
                        className={cx(
                          "flex min-h-13 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left",
                          "transition-[background-color] duration-150 hover:bg-surface motion-reduce:transition-none",
                        )}
                      >
                        <ProductThumb size="lg" imageUrl={readProductImageUrl(product)} fallbackIcon={ShoppingBag} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold text-text">{product.name}</span>
                          {price != null ? <span className="text-[13px] text-text-muted">{money(price)}</span> : null}
                        </span>
                        {isAdded ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-action-fg">
                            <Check size={16} aria-hidden="true" />
                            {t("createProductAdded")}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-text">
                            <Plus size={16} aria-hidden="true" />
                            {t("createProductAdd")}
                          </span>
                        )}
                      </Pressable>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Katalogda yo'q («maxsus») mahsulot — katalog bo'sh bo'lsa ham buyurtma yaratiladi. */}
            <Field id="create-custom-product" label={t("createCustomProductLabel")}>
              <TextInput
                placeholder={t("createCustomProductPlaceholder")}
                value={customName}
                onValueChange={setCustomName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomProduct();
                  }
                }}
              />
              <div className="flex min-w-0 items-center gap-3 pt-1.5">
                <span className="text-[13px] text-text-muted">{t("createCustomQuantityLabel")}</span>
                <QuantityStepper
                  value={customQty}
                  groupLabel={t("createCustomQuantityGroup")}
                  decreaseLabel={t("createCustomQuantityDecrease")}
                  increaseLabel={t("createCustomQuantityIncrease")}
                  onChange={(next) => setCustomQty(Math.max(1, next))}
                />
                <Button
                  variant="secondary"
                  leftIcon={Plus}
                  disabled={!customName.trim()}
                  onClick={addCustomProduct}
                  className="min-h-11 min-w-0 flex-1"
                >
                  {t("createProductAdd")}
                </Button>
              </div>
            </Field>
          </div>

          <div className="flex min-w-0 flex-col">
            <h3 className="pb-3 text-[13px] font-semibold text-text">{t("createSelectedProducts")}</h3>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-strong">
                <EmptyState icon={ShoppingBag} title={t("selectProductShort")} />
              </div>
            ) : (
              <ul aria-label={t("createSelectedProducts")} className="m-0 list-none p-0 text-sm">
                {items.map((item) => {
                  const key = orderItemKey(item);
                  const product = findProduct(item.product_id);
                  const isCustom = item.product_id == null;
                  const name = product?.name ?? item.product_name ?? `#${item.product_id ?? "?"}`;
                  return (
                    <li
                      key={key}
                      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-border py-3 last:pb-0"
                    >
                      {isCustom ? (
                        <ProductThumb size="lg" />
                      ) : (
                        <ProductThumb size="lg" imageUrl={readProductImageUrl(product)} fallbackIcon={ShoppingBag} />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text">{name}</div>
                        <div className="text-[13px] text-text-muted">{itemPriceText(item, product)}</div>
                      </div>
                      <IconButton
                        size="lg"
                        icon={Trash2}
                        label={t("createRemoveItem", { name })}
                        onClick={() => removeItem(key)}
                      />
                      <div className="col-start-2 col-end-4">
                        <QuantityStepper
                          value={item.quantity}
                          groupLabel={t("itemQuantityGroup", { name })}
                          decreaseLabel={t("decreaseQuantity", { name })}
                          increaseLabel={t("increaseQuantity", { name })}
                          onChange={(next) => setQuantity(key, next)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        {itemsError ? <InlineError id={ITEMS_ERROR_ID}>{itemsError}</InlineError> : null}
      </Card>
    </>
  );
};

export default memo(Step2Combined);
