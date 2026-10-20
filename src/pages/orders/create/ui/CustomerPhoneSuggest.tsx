// dizayn-v2: superadmin-neworders-create-manual-step2-customer-suggest, admin-neworders-create-manual-step2-customer-suggest, manager-new-orders-create-manual-step2-customer-suggest, registrator-new-orders-create-step2-customer-suggest, market-new-orders-create-manual-customer-suggest
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  CUSTOMER_SUGGEST_MIN_DIGITS,
  customerDistrictQuery,
  useCustomerDistrictNames,
  useCustomerSuggest,
  type CustomerSuggestion,
} from "../../../../entities/customer";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { formatUzbekistanPhoneFull, getUzbekistanPhoneDigits } from "../../../../shared/lib/phone";
import { Badge, Button, Dialog, Field, Pressable, Spinner, TextInput } from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import type { CustomerFieldValues, OrderCreateFormValues } from "../model/orderCreateForm";

/** Maket: «7 raqamdan keyin, 300 ms» — har raqam uchun so'rov ketmasin. */
export const CUSTOMER_SUGGEST_DEBOUNCE_MS = 300;

/**
 * Taklif sarlavhasi — kim qaysi mijozlarni ko'radi (backend doirasi): superadmin/admin — barcha mijozlar, son
 * shu market bo'yicha; menejer/registrator — faqat shu market mijozlari; market — faqat o'z mijozlari.
 * «Barcha mijozlar» faqat haqiqatan barchasi ko'rinadigan rollarda (boshqa rollarga — backend kartasidan keyin, CS-D).
 */
export type CustomerSuggestScope = "all" | "market" | "own";

type CustomerPhoneSuggestProps = {
  scope: CustomerSuggestScope;
  /** Market rolidan tashqari — tanlangan market (`market_id`); yo'q bo'lsa taklif so'ralmaydi. */
  marketId: string | null;
  marketName?: string | null;
};

type SuggestStatus = "hidden" | "searching" | "results" | "empty";

/** `.el-option` — taklif qatori (maket: 56 px, yuqoriga tekislangan). */
const OPTION =
  "flex w-full min-w-0 cursor-pointer select-none items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text " +
  "transition-[background-color] duration-150 motion-reduce:transition-none";

/** Ro'yxat sarlavhasi (`.el-xs .el-muted`). */
const ScopeLabel = ({ children }: { children: string }) => (
  <div role="presentation" className="px-2.5 pt-1.5 pb-1 text-xs text-text-muted">
    {children}
  </div>
);

type SuggestionRowProps = {
  suggestion: CustomerSuggestion;
  districtName?: string;
  active: boolean;
  id: string;
  /** Desktop ro'yxatida fokus maydonda qoladi (`aria-activedescendant`) — qator Tab bilan olinmaydi. */
  inCombobox: boolean;
  onPick: () => void;
  onHover?: () => void;
};

const SuggestionRow = ({ suggestion, districtName, active, id, inCombobox, onPick, onHover }: SuggestionRowProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const ordersCount = suggestion.orders_count;
  const newCount = suggestion.new_orders_count ?? 0;
  const phone = suggestion.phone_number ? formatPhone(suggestion.phone_number) : "";
  const subline = [phone, districtName].filter(Boolean).join(" · ");

  return (
    <Pressable
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={inCombobox ? -1 : undefined}
      onMouseMove={onHover}
      onClick={onPick}
      className={cx(OPTION, "min-h-14", active ? "bg-sunken" : "hover:bg-sunken")}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold wrap-break-word">{suggestion.name?.trim() || "—"}</span>
        {subline ? <span className="text-[13px] text-text-muted">{subline}</span> : null}
      </span>
      {ordersCount != null || newCount > 0 ? (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {ordersCount != null ? (
            <span className="whitespace-nowrap text-xs text-text-muted">
              {t("createCustomer.ordersCount", {
                count: ordersCount,
                value: formatNumberLocalized(ordersCount, { language }),
              })}
            </span>
          ) : null}
          {newCount > 0 ? (
            <Badge tone="warning" dot size="sm">
              {t("createCustomer.newCount", { count: newCount, value: formatNumberLocalized(newCount, { language }) })}
            </Badge>
          ) : null}
        </span>
      ) : null}
    </Pressable>
  );
};

/**
 * TELEFON + MIJOZ TAKLIFI (maket `*-create-manual-step2-customer-suggest`, `market-…-customer-suggest`; CS-A).
 *
 * 7 raqamdan keyin, 300 ms kutib `GET customers/suggest` (market rolida `market_id` yuborilmaydi):
 *  - desktop/planshet — maydon ostida ro'yxat (`combobox` + `listbox`, ↑ ↓ Enter Esc): sarlavha (doira), qatorlar
 *    (ism; telefon · tuman; «N ta buyurtma», «N ta yangi»), «Yangi mijoz sifatida davom etish»; «Mijoz
 *    qidirilmoqda...» va «Mijoz topilmadi» holatlari;
 *  - telefon — natija bo'lsagina pastki varaqa «Mijozni tanlang» (qidiruv/topilmadi — maydon ostida bir qator).
 *
 * Tanlansa: ism, qo'shimcha raqam, manzil, viloyat (`GET district/:id`) va tuman to'ladi, `existingCustomer`
 * bog'lanadi («Mavjud mijoz» bloki — `ExistingCustomerNotice`). Telefon o'zgarsa bog'lanish uziladi. Xato jim:
 * taklif ixtiyoriy, forma yangi mijoz bilan ishlayveradi.
 */
export const CustomerPhoneSuggest = ({ scope, marketId, marketName }: CustomerPhoneSuggestProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const isPhone = useIsPhone();
  const listId = useId();

  const {
    control,
    formState: { errors },
    getValues,
    setValue,
    clearErrors,
  } = useFormContext<OrderCreateFormValues>();
  const digits = useWatch({ control, name: "customer.phone" }) ?? "";
  const existing = useWatch({ control, name: "existingCustomer" });
  const linkedHere = existing != null && existing.filled.phone === digits;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Telefonda: foydalanuvchi maydondan boshqa joyga o'tgan — kech kelgan natija varaqani ochib fokusni tortib olmaydi
  // (maydon ostidagi bir qatorli holat qoladi — joylashuv siljimaydi).
  const [awayOnPhone, setAwayOnPhone] = useState(false);
  // Telefonda varaqa «Yangi mijoz sifatida davom etish» / «Yopish» bilan yopilgan raqam boshi: shu raqam davom
  // etsa (har yangi raqam) varaqa qayta ochilmaydi; raqam boshqasiga o'zgarsa — yana ochiladi.
  const dismissedPrefix = useRef<string | null>(null);
  const [debounced, setDebounced] = useState(digits);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(digits), CUSTOMER_SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [digits]);

  const canSearch = scope === "own" || Boolean(marketId);
  const eligible = digits.length >= CUSTOMER_SUGGEST_MIN_DIGITS && !linkedHere && canSearch;
  const query = useCustomerSuggest(
    { phone: debounced, marketId: scope === "own" ? null : marketId },
    open && eligible && debounced === digits,
  );
  const results = query.data ?? [];
  const districtNames = useCustomerDistrictNames(open ? results.map((row) => row.district_id ?? "") : []);

  const status: SuggestStatus = !eligible
    ? "hidden"
    : debounced !== digits || query.isPending
      ? "searching"
      : query.isError
        ? "hidden"
        : results.length > 0
          ? "results"
          : "empty";

  const scopeLabel =
    scope === "all"
      ? t("createCustomer.scopeAll", { market: marketName ?? "—" })
      : scope === "market"
        ? t("createCustomer.scopeMarket", { market: marketName ?? "—" })
        : t("createCustomer.scopeOwn");

  // Tanlash asinxron (viloyat `district/:id` dan): oraliqda boshqa tanlov yoki telefon o'zgarsa eskisi yozilmaydi.
  const pickToken = useRef(0);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const fill = <K extends keyof CustomerFieldValues>(key: K, value: CustomerFieldValues[K]) => {
    setValue(`customer.${key}` as `customer.${K}`, value as never, { shouldDirty: true });
    if (value) clearErrors(`customer.${key}`);
  };

  const pick = async (suggestion: CustomerSuggestion) => {
    close();
    const token = ++pickToken.current;
    // Nusxa: `getValues` forma ichidagi obyektni qaytaradi — keyingi `setValue` uni o'zgartirib yuborardi.
    const previous = { ...getValues("customer") };
    const phone = getUzbekistanPhoneDigits(suggestion.phone_number ?? "");

    // Kartada bo'sh maydon foydalanuvchi yozganini o'chirmaydi.
    if (phone.length === 9) fill("phone", phone);
    if (suggestion.name?.trim()) fill("name", suggestion.name.trim());
    // Kartadagi qo'shimcha raqam buzuq bo'lsa (9 raqam emas) — forma yuborilmay qolmasin, maydon tegilmaydi.
    const extraPhone = getUzbekistanPhoneDigits(suggestion.extra_number ?? "");
    if (extraPhone.length === 9) fill("extra_phone", extraPhone);
    if (suggestion.address?.trim()) fill("address", suggestion.address.trim());

    if (suggestion.district_id) {
      const district = await queryClient.fetchQuery(customerDistrictQuery(suggestion.district_id)).catch(() => null);
      if (token !== pickToken.current) return;
      const regionId = district?.region_id ?? suggestion.region_id;
      if (regionId) {
        fill("region_id", regionId);
        fill("district_id", suggestion.district_id);
      }
    }
    if (token !== pickToken.current) return;

    setValue(
      "existingCustomer",
      {
        id: suggestion.id,
        name: suggestion.name?.trim() || getValues("customer.name"),
        orders_count: suggestion.orders_count,
        new_orders_count: suggestion.new_orders_count ?? 0,
        new_order_ids: suggestion.new_order_ids,
        last_order_at: suggestion.last_order_at,
        filled: { ...getValues("customer") },
        previous,
      },
      { shouldDirty: true },
    );
  };

  const continueAsNew = () => {
    if (isPhone) dismissedPrefix.current = digits;
    close();
  };

  const optionCount = status === "results" ? results.length + 1 : 0;
  const optionId = (index: number) =>
    index < results.length
      ? `${listId}-customer-${encodeURIComponent(results[index]?.id ?? String(index))}`
      : `${listId}-new`;
  const current = activeIndex >= 0 && activeIndex < optionCount ? activeIndex : -1;

  const move = (index: number) => {
    if (optionCount === 0) return;
    const next = (index + optionCount) % optionCount;
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || isPhone) return;
    const listVisible = open && status !== "hidden";
    switch (event.key) {
      case "ArrowDown":
        if (!eligible) return;
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        move(current < 0 ? 0 : current + 1);
        break;
      case "ArrowUp":
        if (!listVisible) return;
        event.preventDefault();
        move(current < 0 ? optionCount - 1 : current - 1);
        break;
      case "Enter":
        if (!listVisible || current < 0) return;
        // Sahifa formasi yuborilmasin — Enter faol qatorni tanlaydi.
        event.preventDefault();
        if (current < results.length) void pick(results[current]);
        else continueAsNew();
        break;
      case "Escape":
        if (!listVisible) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      default:
        break;
    }
  };

  const listVisible = !isPhone && open && status !== "hidden";
  const sheetOpen = isPhone && open && !awayOnPhone && status === "results";
  const inlineStatus = isPhone && open && (status === "searching" || status === "empty") ? status : null;

  const renderOptions = (inCombobox: boolean) => (
    <>
      <ScopeLabel>{scopeLabel}</ScopeLabel>
      {results.map((suggestion, index) => (
        <SuggestionRow
          key={suggestion.id}
          id={inCombobox ? optionId(index) : `${listId}-sheet-${index}`}
          suggestion={suggestion}
          districtName={suggestion.district_id ? districtNames[suggestion.district_id] : undefined}
          active={inCombobox && index === current}
          inCombobox={inCombobox}
          onHover={inCombobox ? () => index !== current && setActiveIndex(index) : undefined}
          onPick={() => void pick(suggestion)}
        />
      ))}
    </>
  );

  return (
    <div className="relative min-w-0">
      <Controller
        control={control}
        name="customer.phone"
        render={({ field }) => (
          <Field id="customer.phone" label={t("phone")} required error={errors.customer?.phone?.message}>
            <TextInput
              mode="phone"
              name={field.name}
              placeholder="XX XXX XX XX"
              value={field.value ? `+998${field.value}` : ""}
              role="combobox"
              aria-expanded={listVisible}
              aria-controls={listVisible ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={listVisible && current >= 0 ? optionId(current) : undefined}
              onValueChange={(next) => {
                const nextDigits = getUzbekistanPhoneDigits(next);
                field.onChange(nextDigits);
                // Har tahrir davom etayotgan tanlovni bekor qiladi (viloyat kutilayotganda telefon o'zgarsa, bog'lanish
                // tahrirlangan raqam bilan yozilib, `customer_id` boshqa karta uchun ketmasin).
                pickToken.current += 1;
                // Telefon o'zgarsa mavjud mijoz bilan bog'lanish uziladi (maydonlar qoladi).
                const link = getValues("existingCustomer");
                if (link && link.filled.phone !== nextDigits) {
                  setValue("existingCustomer", null, { shouldDirty: true });
                }
                const dismissed = dismissedPrefix.current;
                const stillDismissed = dismissed != null && nextDigits.startsWith(dismissed);
                if (!stillDismissed) dismissedPrefix.current = null;
                setActiveIndex(-1);
                setOpen(nextDigits.length >= CUSTOMER_SUGGEST_MIN_DIGITS && !stillDismissed);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setAwayOnPhone(false)}
              onBlur={() => {
                // Telefonda varaqa ochilganda fokusni o'zi oladi — bu maydondan chiqish emas: «tegildi» va format
                // tekshiruvi (7–8 raqamda «Telefon formati noto'g'ri») ishga tushmaydi, varaqa yopilmaydi.
                if (sheetOpen) return;
                field.onBlur();
                if (isPhone) setAwayOnPhone(true);
                else close();
              }}
              ref={field.ref}
            />
          </Field>
        )}
      />

      {listVisible ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t("createCustomer.listLabel")}
          aria-busy={status === "searching" || undefined}
          // Bosilganda fokus telefon maydonida qoladi (`aria-activedescendant`).
          onMouseDown={(event) => event.preventDefault()}
          className={cx(
            "absolute top-[calc(100%+4px)] left-0 z-20 flex max-h-[420px] w-[max(100%,min(400px,calc(100vw-72px)))]",
            "flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border bg-raised p-1.5 shadow-xl",
          )}
        >
          {status === "searching" ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 px-2.5 py-4 text-center text-[13px] text-text-muted"
            >
              <Spinner className="text-action" />
              {t("createCustomer.searching")}
            </div>
          ) : status === "empty" ? (
            <div role="status" className="flex flex-col gap-0.5 px-2.5 py-4 text-center text-[13px] text-text-muted">
              <span className="font-semibold text-text">{t("createCustomer.notFoundTitle")}</span>
              <span>{t("createCustomer.notFoundHint")}</span>
            </div>
          ) : (
            <>
              {renderOptions(true)}
              <div role="presentation" className="mx-1.5 my-1 h-px shrink-0 bg-border" />
              <Pressable
                id={optionId(results.length)}
                role="option"
                aria-selected={current === results.length}
                tabIndex={-1}
                onMouseMove={() => current !== results.length && setActiveIndex(results.length)}
                onClick={continueAsNew}
                className={cx(
                  OPTION,
                  "min-h-11 items-center font-semibold text-action-fg",
                  current === results.length ? "bg-sunken" : "hover:bg-sunken",
                )}
              >
                <UserPlus size={16} aria-hidden="true" className="shrink-0" />
                {t("createCustomer.continueNew")}
              </Pressable>
            </>
          )}
        </div>
      ) : null}

      {inlineStatus ? (
        <p role="status" className="flex items-center gap-2 pt-1.5 text-[13px] text-text-muted">
          {inlineStatus === "searching" ? (
            <>
              <Spinner className="text-action" />
              {t("createCustomer.searching")}
            </>
          ) : (
            <span>
              <span className="font-semibold text-text">{t("createCustomer.notFoundTitle")}</span>
              {" · "}
              {t("createCustomer.notFoundHint")}
            </span>
          )}
        </p>
      ) : null}

      <Dialog
        open={sheetOpen}
        onClose={continueAsNew}
        title={t("createCustomer.sheetTitle")}
        description={t("createCustomer.sheetDescription", {
          phone: formatUzbekistanPhoneFull(digits),
          count: results.length,
          value: formatNumberLocalized(results.length, { language }),
        })}
        footer={
          <Button variant="secondary" fullWidth leftIcon={UserPlus} onClick={continueAsNew}>
            {t("createCustomer.continueNew")}
          </Button>
        }
      >
        <div role="listbox" aria-label={t("createCustomer.listLabel")} className="-mx-2 flex flex-col gap-0.5">
          {renderOptions(false)}
        </div>
      </Dialog>
    </div>
  );
};

export default CustomerPhoneSuggest;
