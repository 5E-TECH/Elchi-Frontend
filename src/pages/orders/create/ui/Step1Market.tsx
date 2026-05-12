import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Phone, Store, X } from "lucide-react";
import { Controller, useController, useForm, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../../entities/markets";
import type { MarketOption, OrderCreateFormValues } from "../model/orderCreateForm";
import { FormFieldError } from "./formFieldStyles";
import { GlobalSearchInput } from "../../../../features/search";

interface Step1MarketSearchValues {
  search: string;
}

interface Step1MarketProps {
  autoOpenOnMount?: boolean;
  onSelectMarket?: (market: MarketOption) => void;
  compact?: boolean;
}

const getMarketPhone = (market?: MarketOption | null) =>
  market?.phone_number ?? market?.phone ?? "";

const Step1Market = ({
  autoOpenOnMount = false,
  onSelectMarket,
  compact = false,
}: Step1MarketProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation(["orders", "common"]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { getMarkets } = useMarkets();
  const { data, isLoading } = getMarkets({ search: debouncedSearch, status: "active", limit: 20 });

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

  const markets = toArray(data).filter((market) => market.status !== "inactive" && market.status !== "blocked");
  const selectedMarket = field.value;
  const selectedPhone = getMarketPhone(selectedMarket);

  useEffect(() => {
    if (!autoOpenOnMount || selectedMarket) {
      return;
    }

    setIsOpen(true);
  }, [autoOpenOnMount, selectedMarket]);

  const visibleMarkets = useMemo(() => {
    if (!selectedMarket) return markets;

    const selectedIsActive = selectedMarket.status !== "inactive" && selectedMarket.status !== "blocked";
    if (!selectedIsActive) return markets;

    return [
      selectedMarket,
      ...markets.filter((market) => market.id !== selectedMarket.id),
    ];
  }, [markets, selectedMarket]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen((current) => {
      const next = !current;

      if (next) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }

      return next;
    });
  };

  const handleSelect = (market: MarketOption) => {
    field.onChange(market);
    setIsOpen(false);
    setSearchValue("search", "");
    onSelectMarket?.(market);
  };

  const handleClear = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    field.onChange(null);
    setSearchValue("search", "");
  };

  return (
    <div className="flex flex-col gap-5">
      {!compact && (
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main/10">
            <Store size={18} className="text-main" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-maindark dark:text-primary">
              {t("selectMarketTitle")}
            </h3>
            <p className="text-xs text-gray-400">
              {t("selectMarket")}
            </p>
          </div>
        </div>
      )}

      {selectedMarket && (
        <div className="flex flex-col gap-3 rounded-2xl border border-main/15 bg-main/5 p-4 dark:bg-main/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-main/70">
              {t("selectedMarket")}
            </p>
            <p className="mt-1 truncate text-base font-semibold text-maindark dark:text-primary">
              {selectedMarket.name}
            </p>
            {selectedPhone && (
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <Phone size={13} />
                {selectedPhone}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-primary px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-main/30 hover:text-main dark:border-primarydark dark:bg-primarydark dark:text-gray-300"
          >
            <X size={14} />
            {t("clear", { ns: "common" })}
          </button>
        </div>
      )}

      <div ref={containerRef} className="relative">
        {(!compact || !selectedMarket) && (
          <button
            type="button"
            onClick={handleOpen}
            className={`
              flex w-full items-center gap-3 rounded-2xl border bg-primary px-4 py-3.5 text-left transition-all duration-200 dark:bg-primarydark
              ${isOpen
                ? "border-main shadow-sm shadow-main/10"
                : error
                  ? "border-error"
                  : "border-gray-200 hover:border-main/25 dark:border-primarydark"}
            `}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar dark:bg-maindark">
              <Store size={16} className="text-main" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-maindark dark:text-primary">
                {selectedMarket ? selectedMarket.name : t("selectMarketButton")}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {selectedMarket
                  ? t("selectAnotherMarket")
                  : t("searchInstruction")}
              </p>
            </div>

            <ChevronDown
              size={18}
              className={`shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        )}

        <div className="mt-2">
          <FormFieldError message={error?.message} />
        </div>

        {isOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-100 flex items-start justify-center bg-[color-mix(in_srgb,var(--color-maindark)_32%,transparent)] px-4 py-8 backdrop-blur-[2px] sm:py-12"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsOpen(false);
                }
              }}
            >
              <div
                className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-primary shadow-2xl shadow-[color-mix(in_srgb,var(--color-maindark)_12%,transparent)] dark:border-primarydark dark:bg-maindark"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 dark:border-primarydark sm:px-5">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-maindark dark:text-primary">
                      {t("selectMarketButton")}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {t("marketModalSubtitle")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition-colors hover:border-main/30 hover:text-main dark:border-primarydark"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="border-b border-gray-100 p-3 dark:border-primarydark sm:p-4">
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
                        placeholder={t("searchMarket")}
                        className="w-full"
                        inputClassName="bg-sidebar dark:bg-primarydark border-gray-200 dark:border-primarydark/60 text-maindark dark:text-primary placeholder:text-gray-400 rounded-xl py-2.5 pr-3 shadow-none focus:shadow-none"
                        iconClassName="text-gray-400 group-focus-within:text-main"
                        clearButtonClassName="text-gray-400 hover:text-main"
                      />
                    )}
                  />
                </div>

                <div className="max-h-[min(26rem,calc(100vh-14rem))] overflow-y-auto custom-scrollbar p-2 sm:p-3">
                  {isLoading ? (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-14 rounded-xl bg-sidebar animate-pulse dark:bg-primarydark"
                        />
                      ))}
                    </div>
                  ) : visibleMarkets.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                      <Store size={28} strokeWidth={1.5} />
                      <p className="text-sm">{t("marketNotFound")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {visibleMarkets.map((market) => {
                        const isSelected = selectedMarket?.id === market.id;
                        const marketPhone = getMarketPhone(market);

                        return (
                          <button
                            key={market.id}
                            type="button"
                            onClick={() => handleSelect(market)}
                            className={`
                              flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors cursor-pointer
                              ${isSelected
                                ? "bg-main/8 dark:bg-main/14"
                                : "hover:bg-sidebar dark:hover:bg-primarydark"}
                            `}
                          >
                            <div
                              className={`
                                mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border
                                ${isSelected
                                  ? "border-main bg-main text-primary"
                                  : "border-gray-300 dark:border-gray-500"}
                              `}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-maindark dark:text-primary">
                                {market.name}
                              </p>
                              {marketPhone && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                                  <Phone size={11} />
                                  {marketPhone}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
};

export default memo(Step1Market);
