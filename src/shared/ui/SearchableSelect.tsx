import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
}

const SearchableSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Tanlang...",
  icon: Icon,
  loading = false,
  disabled = false,
}: SearchableSelectProps) => {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchInputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSearchValue("");
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const openDropdown = () => {
    if (disabled) {
      return;
    }

    setIsOpen(true);
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setSearchValue("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearchValue("");
    setIsOpen(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDropdown();
    }

    if (event.key === "Escape") {
      setSearchValue("");
      setIsOpen(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchValue("");
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative space-y-0">
      <label
        htmlFor={name}
        className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon size={11} className="text-main/70" />}
          {label}
        </span>
      </label>

      <div
        className={`group relative flex h-12 w-full items-center rounded-xl border-2 bg-[color:var(--color-primary)] px-4 text-left shadow-sm transition-all duration-200 outline-none dark:bg-[color:var(--color-primarydark)] ${
          isOpen
            ? "border-main ring-2 ring-main/10"
            : "border-[color:var(--color-border-soft)] hover:border-main/50"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-text"}`}
      >
        {Icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] transition-colors group-hover:text-main group-focus-within:text-main dark:text-[color:var(--color-text-muted-dark)]">
            <Icon size={18} />
          </span>
        )}

        {isOpen ? (
          <input
            ref={searchInputRef}
            id={name}
            type="text"
            value={searchValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
            autoFocus
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            placeholder={selectedOption?.label ?? placeholder}
            className={`min-w-0 flex-1 bg-transparent text-sm font-medium text-[color:var(--color-maindark)] outline-none placeholder:text-[color:var(--color-text-muted)] dark:text-[color:var(--color-primary)] dark:placeholder:text-[color:var(--color-text-muted-dark)] ${Icon ? "pl-7" : ""}`}
          />
        ) : (
          <button
            id={name}
            type="button"
            onClick={openDropdown}
            onKeyDown={handleTriggerKeyDown}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className={`min-w-0 flex-1 truncate bg-transparent text-left text-sm font-medium outline-none ${
              selectedOption
                ? "text-[color:var(--color-maindark)] dark:text-[color:var(--color-primary)]"
                : "text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
            } ${Icon ? "pl-7" : ""}`}
          >
            {selectedOption?.label ?? placeholder}
          </button>
        )}

        <span className="ml-2 flex items-center gap-1.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleClear();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-main/10 hover:text-main dark:text-[color:var(--color-text-muted-dark)]"
              aria-label={t("clear")}
            >
              <X size={14} />
            </button>
          )}

          <ChevronDown
            size={18}
            className={`shrink-0 text-[color:var(--color-text-muted)] transition-all duration-200 dark:text-[color:var(--color-text-muted-dark)] ${
              isOpen ? "rotate-180 text-main" : ""
            }`}
          />
        </span>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-primary)] shadow-[0_20px_45px_color-mix(in_srgb,var(--color-background-deep)_18%,transparent)] dark:bg-[color:var(--color-primarydark)]">
          <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
            {loading ? (
              <div className="flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("loading")}
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-main/10 text-main"
                        : "text-[color:var(--color-maindark)] hover:bg-main/10 dark:text-[color:var(--color-primary)] dark:hover:bg-main/10"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("search")} topilmadi
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(SearchableSelect);
