import { memo, useState, useRef, useEffect } from "react";
import { Search, Store, Phone, ChevronDown, X, Check } from "lucide-react";
import { useMarkets } from "../../../../entities/markets";

interface Market {
    id: number;
    name: string;
    phone_number?: string;
    phone?: string;
}

interface Step1MarketProps {
    selectedMarket: Market | null;
    onSelect: (market: Market) => void;
}

const Step1Market = ({ selectedMarket, onSelect }: Step1MarketProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Search debounce — 400ms
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);


    const { getMarkets } = useMarkets();
    const { data, isLoading } = getMarkets({ search: debouncedSearch, limit: 20 });

    // API response: data.data.items yoki data.items yoki data[] 
    const toArray = (val: any): Market[] => {
        if (Array.isArray(val)) return val;
        if (val?.data?.items && Array.isArray(val.data.items)) return val.data.items;
        if (val?.data && Array.isArray(val.data)) return val.data;
        if (val?.items && Array.isArray(val.items)) return val.items;
        return [];
    };
    const markets = toArray(data);

    // Tashqarida bosganda yopish
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
        setSearch("");
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleSelect = (market: Market) => {
        onSelect(market);
        setIsOpen(false);
        setSearch("");
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(null as any);
        setIsOpen(false);
        setSearch("");
    };

    const phone = selectedMarket?.phone_number ?? selectedMarket?.phone;

    return (
        <div className="flex flex-col gap-5">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
                    <Store size={18} className="text-main" />
                </div>
                <div>
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

            {/* ── Searchable Select ── */}
            <div ref={containerRef} className="relative w-full">
                {/* Trigger button */}
                <button
                    type="button"
                    onClick={handleOpen}
                    className={`
            w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm
            bg-primary dark:bg-primarydark
            border-2 transition-all duration-200 text-left
            focus:outline-none
            ${isOpen
                            ? "border-main shadow-lg shadow-main/10"
                            : selectedMarket
                                ? "border-main/40"
                                : "border-gray-200 dark:border-primarydark hover:border-main/30"
                        }
          `}
                >
                    {/* Icon */}
                    <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
            ${selectedMarket ? "bg-main text-primary" : "bg-sidebar dark:bg-background text-main/50"}
          `}>
                        <Store size={15} />
                    </div>

                    {/* Label */}
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

                    {/* Right icons */}
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

                {/* ── Dropdown ── */}
                {isOpen && (
                    <div className="
            absolute z-50 top-full left-0 right-0 mt-2
            bg-primary dark:bg-maindark
            border border-gray-200 dark:border-primarydark
            rounded-xl shadow-2xl shadow-black/10
            overflow-hidden
          ">
                        {/* Search input */}
                        <div className="p-3 border-b border-gray-100 dark:border-primarydark">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Market qidirish..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="
                    w-full pl-8 pr-3 py-2 rounded-lg text-sm
                    bg-sidebar dark:bg-primarydark
                    border border-gray-200 dark:border-primarydark/60
                    text-maindark dark:text-primary placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-main/20 focus:border-main
                    transition-all
                  "
                                />
                            </div>
                        </div>

                        {/* Options list */}
                        <div className="max-h-64 overflow-y-auto custom-scrollbar py-1.5">
                            {isLoading ? (
                                <div className="flex flex-col gap-1.5 px-3 py-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="h-11 rounded-lg bg-gray-100 dark:bg-primarydark animate-pulse" />
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
                                    const mPhone = market.phone_number ?? market.phone;
                                    return (
                                        <button
                                            key={market.id}
                                            type="button"
                                            onClick={() => handleSelect(market)}
                                            className={`
                        w-full flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg
                        text-left transition-all duration-150
                        ${isSelected
                                                    ? "bg-main/10 dark:bg-main/20"
                                                    : "hover:bg-sidebar dark:hover:bg-primarydark"
                                                }
                      `}
                                            style={{ width: "calc(100% - 12px)" }}
                                        >
                                            {/* Icon */}
                                            <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${isSelected ? "bg-main text-primary" : "bg-sidebar dark:bg-background text-main/60"}
                      `}>
                                                <Store size={14} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold truncate ${isSelected ? "text-main" : "text-maindark dark:text-primary"}`}>
                                                    {market.name}
                                                </p>
                                                {mPhone && (
                                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Phone size={9} /> {mPhone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Check */}
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

            {/* Selected market info card */}
            {selectedMarket && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-main/5 dark:bg-main/10 border border-main/20">
                    <div className="w-10 h-10 rounded-xl bg-main text-primary flex items-center justify-center flex-shrink-0">
                        <Store size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-main text-sm">{selectedMarket.name}</p>
                        {phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {phone}
                            </p>
                        )}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-main flex items-center justify-center">
                        <Check size={13} className="text-primary" strokeWidth={2.5} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(Step1Market);
