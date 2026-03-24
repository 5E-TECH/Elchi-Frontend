import { memo, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Check, ChevronDown, Phone, Store, X } from "lucide-react";
import { Controller, useController, useForm, useFormContext } from "react-hook-form";
import { useMarkets } from "../../../../entities/markets";
import type { MarketOption, OrderCreateFormValues } from "../model/orderCreateForm";
import { FormFieldError } from "./formFieldStyles";
import { GlobalSearchInput } from "../../../../features/search";

interface Step1MarketSearchValues {
  search: string;
}

const Step1Market = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { control: searchControl, watch: watchSearch, setValue: setSearchValue } =
    useForm<Step1MarketSearchValues>({
      defaultValues: { search: "" },
    });
  const search = watchSearch("search");

  const { control } = useFormContext<OrderCreateFormValues>();
  const {
    field,
    fieldState: { error },
  } = useController({
    control,
    name: "market",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { getMarkets } = useMarkets();
  const { data, isLoading } = getMarkets({ search: debouncedSearch, limit: 20 });

  const toArray = (value: unknown): MarketOption[] => {
    if (Array.isArray(value)) return value as MarketOption[];
    if (
      typeof value === "object" &&
      value !== null &&
      "data" in value &&
      Array.isArray((value as { data?: { items?: MarketOption[] } }).data?.items)
    ) {
      return (value as { data: { items: MarketOption[] } }).data.items;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "data" in value &&
      Array.isArray((value as { data?: MarketOption[] }).data)
    ) {
      return (value as { data: MarketOption[] }).data;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "items" in value &&
      Array.isArray((value as { items?: MarketOption[] }).items)
    ) {
      return (value as { items: MarketOption[] }).items;
    }
    return [];
  };

  const markets = toArray(data);
  const selectedMarket = field.value;
  const phone = selectedMarket?.phone_number ?? selectedMarket?.phone;

  useEffect(() => {
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setSearchValue("search", "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (market: MarketOption) => {
    field.onChange(market);
    setIsOpen(false);
    setSearchValue("search", "");
  };

  const handleClear = (event: ReactMouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    field.onChange(null);
    setIsOpen(false);
    setSearchValue("search", "");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center shrink-0">
          <Store size={18} className="text-main" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-maindark dark:text-primary text-base">
            Market tanlang
          </h3>
          <p className="text-xs text-gray-400">
            {selectedMarket
              ? `Tanlandi: ${selectedMarket.name}`
              : "Ro'yxatdan market tanlang yoki qidiring"}
          </p>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full">
        <button
          type="button"
          onClick={handleOpen}
          className={`
            w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm
            bg-primary dark:bg-primarydark
            border-2 transition-all duration-200 text-left
            focus:outline-none cursor-pointer
            ${isOpen
              ? "border-main shadow-lg shadow-main/10"
              : selectedMarket
                ? "border-main/40"
                : error
                  ? "border-[var(--color-error)]"
                  : "border-gray-200 dark:border-primarydark hover:border-main/30"}
          `}
        >
          <div
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
              ${selectedMarket
                ? "bg-main text-primary"
                : "bg-sidebar dark:bg-background text-main/50"}
            `}
          >
            <Store size={15} />
          </div>

          <div className="flex-1 min-w-0">
            {selectedMarket ? (
              <>
                <p className="font-semibold text-maindark dark:text-primary truncate">
                  {selectedMarket.name}
                </p>
                {phone && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {phone}
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-400">Market tanlang yoki qidiring...</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedMarket && (
              <span
                onClick={handleClear}
                className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-300 hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        <div className="mt-2">
          <FormFieldError message={error?.message} />
        </div>

        {isOpen && (
          <div
            className="
              absolute z-50 top-full left-0 right-0 mt-2
              bg-primary dark:bg-maindark
              border border-gray-200 dark:border-primarydark
              rounded-xl shadow-2xl shadow-black/10
              overflow-hidden
            "
          >
            <div className="p-3 border-b border-gray-100 dark:border-primarydark">
              <Controller
                control={searchControl}
                name="search"
                render={({ field: searchField }) => (
                  <GlobalSearchInput
                    ref={inputRef}
                    name={searchField.name}
                    value={searchField.value}
                    onBlur={searchField.onBlur}
                    onValueChange={searchField.onChange}
                    placeholder="Market qidirish..."
                    className="w-full"
                    inputClassName="bg-sidebar dark:bg-primarydark border-gray-200 dark:border-primarydark/60 text-maindark dark:text-primary placeholder:text-gray-400 rounded-lg py-2 pr-3 shadow-none focus:shadow-none"
                    iconClassName="text-gray-400 group-focus-within:text-main"
                    clearButtonClassName="text-gray-400 hover:text-main"
                  />
                )}
              />
            </div>

            <div className="max-h-64 overflow-y-auto custom-scrollbar py-1.5">
              {isLoading ? (
                <div className="flex flex-col gap-1.5 px-3 py-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-11 rounded-lg bg-gray-100 dark:bg-primarydark animate-pulse"
                    />
                  ))}
                </div>
              ) : markets.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
                  <Store size={28} strokeWidth={1} />
                  <p className="text-xs">Market topilmadi</p>
                </div>
              ) : (
                markets.map((market) => {
                  const isSelected = selectedMarket?.id === market.id;
                  const marketPhone = market.phone_number ?? market.phone;

                  return (
                    <button
                      key={market.id}
                      type="button"
                      onClick={() => handleSelect(market)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg
                        text-left transition-all duration-150 cursor-pointer
                        ${isSelected
                          ? "bg-main/10 dark:bg-main/20"
                          : "hover:bg-sidebar dark:hover:bg-primarydark"}
                      `}
                      style={{ width: "calc(100% - 12px)" }}
                    >
                      <div
                        className={`
                          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                          ${isSelected
                            ? "bg-main text-primary"
                            : "bg-sidebar dark:bg-background text-main/60"}
                        `}
                      >
                        <Store size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${isSelected ? "text-main" : "text-maindark dark:text-primary"}`}
                        >
                          {market.name}
                        </p>
                        {marketPhone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={9} /> {marketPhone}
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <Check size={15} className="text-main flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedMarket && (
        <div className="flex flex-col items-start gap-3 p-4 rounded-xl bg-main/5 dark:bg-main/10 border border-main/20 sm:flex-row sm:items-center sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-main text-primary flex items-center justify-center flex-shrink-0">
            <Store size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-main text-sm">{selectedMarket.name}</p>
            {phone && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Phone size={10} /> {phone}
              </p>
            )}
          </div>
          <div className="w-6 h-6 rounded-full bg-main flex items-center justify-center self-end sm:self-auto">
            <Check size={13} className="text-primary" strokeWidth={2.5} />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Step1Market);
