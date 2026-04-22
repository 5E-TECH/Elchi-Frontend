import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface FilterMultiSelectOption {
  value: string;
  label: string;
}

interface FilterMultiSelectProps {
  label: string;
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterMultiSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
}

const FilterMultiSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Tanlang...",
  icon: Icon,
  loading = false,
  disabled = false,
}: FilterMultiSelectProps) => {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((option) => option.label).join(", ");
    }
    return `${selectedOptions[0].label}, ${selectedOptions[1].label} +${selectedOptions.length - 2}`;
  }, [placeholder, selectedOptions]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }

    onChange([...value, optionValue]);
  };

  const clearValue = () => {
    onChange([]);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((current) => !current);
    }

    if (event.key === "Escape") {
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
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        {Icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] transition-colors group-hover:text-main dark:text-[color:var(--color-text-muted-dark)]">
            <Icon size={18} />
          </span>
        )}

        <button
          id={name}
          type="button"
          onClick={() => !disabled && setIsOpen((current) => !current)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`min-w-0 flex-1 truncate bg-transparent text-left text-sm font-medium outline-none ${
            selectedOptions.length > 0
              ? "text-[color:var(--color-maindark)] dark:text-[color:var(--color-primary)]"
              : "text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
          } ${Icon ? "pl-7" : ""}`}
        >
          {displayText}
        </button>

        {selectedOptions.length > 0 ? (
          <button
            type="button"
            onClick={clearValue}
            className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-main/10 text-main transition hover:bg-main/18 dark:bg-white/10 dark:text-primary dark:hover:bg-white/16"
            aria-label={t("clear")}
          >
            <X size={13} />
          </button>
        ) : null}

        <ChevronDown
          size={18}
          className={`pointer-events-none shrink-0 text-[color:var(--color-text-muted)] transition-all duration-200 dark:text-[color:var(--color-text-muted-dark)] ${
            isOpen ? "rotate-180 text-main" : ""
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-primary)] shadow-[0_20px_45px_color-mix(in_srgb,var(--color-background-deep)_18%,transparent)] dark:border-white/10 dark:bg-[color:var(--color-primarydark)]">
          <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
            {loading ? (
              <div className="flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("loading")}
              </div>
            ) : options.length > 0 ? (
              options.map((option) => {
                const isSelected = value.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                      isSelected
                        ? "bg-main/15 text-main dark:bg-main/25 dark:text-primary"
                        : "text-[color:var(--color-maindark)] hover:bg-main/10 dark:text-[color:var(--color-primary)] dark:hover:bg-white/8"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isSelected
                          ? "border-main bg-main text-primary"
                          : "border-[color:var(--color-border-soft)] text-transparent dark:border-white/12"
                      }`}
                    >
                      <Check size={13} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("notFound")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(FilterMultiSelect);
