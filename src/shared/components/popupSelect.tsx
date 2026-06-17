import { memo, useEffect, useState, type ReactNode, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import HeaderName from './headerName';
import { Check, X } from 'lucide-react';
import Button from './button';
import Popup from '../ui/Popup';
import { Controller, useForm } from "react-hook-form";
import { GlobalSearchInput } from "../../features/search";

interface PopupSelectProps<T> {
  isOpen: boolean;
  onClose: () => void;
  data?: T[];
  onSelect: (item: T) => void;
  keyExtractor: (item: T) => string | number;
  renderItem?: (item: T, isSelected: boolean) => ReactNode;
  searchKeys: (keyof T)[];
  title: string;
  description?: string;
  icon?: ReactNode;
  placeholder?: string;
  selectLabel?: string;
  cancelLabel?: string;
  className?: string; // For modal container
  labelKey?: keyof T; // For default item title
  secondaryLabelKey?: keyof T; // For default item subtitle
}

const PopupSelect = <T extends object>({
  isOpen,
  onClose,
  data,
  onSelect,
  keyExtractor,
  renderItem,
  searchKeys,
  title,
  description = "",
  icon,
  placeholder,
  selectLabel,
  cancelLabel,
  className = "",
  labelKey,
  secondaryLabelKey,
}: PopupSelectProps<T>) => {
  const { t } = useTranslation("common");
  const resolvedPlaceholder = placeholder ?? t("searchPlaceholder");
  const resolvedSelectLabel = selectLabel ?? t("select");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const { control, watch } = useForm({
    defaultValues: { search: "" },
  });
  const searchTerm = watch("search");

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data;
    return data.filter((item) =>
      searchKeys.some((key) =>
        String(item[key]).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm, searchKeys]);

  const handleSelect = () => {
    if (selectedItem) {
      onSelect(selectedItem);
      onClose();
    }
  };

  const handleItemClick = (item: T) => {
    if (selectedItem && keyExtractor(selectedItem) === keyExtractor(item)) {
      // Optional deselect logic
    } else {
      setSelectedItem(item);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[90vh] w-[92vw] max-w-140 flex-col rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,248,255,0.99)_100%)] px-5 py-7 text-maindark shadow-[0_30px_70px_rgba(46,54,98,0.18)] dark:border-white/10 dark:bg-[color:var(--color-surface-elevated-dark)] dark:bg-none dark:text-primary dark:shadow-[0_30px_70px_rgba(0,0,0,0.34)] md:px-8 md:py-10 ${className}`}
      >
        <div className="flex justify-between items-center mb-6">
          <HeaderName
            name={title}
            description={description}
            icon={icon}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={resolvedCancelLabel}
            className="absolute right-5 top-5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition hover:bg-black/5 hover:text-error dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <Controller
          control={control}
          name="search"
          render={({ field }) => (
            <GlobalSearchInput
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              placeholder={resolvedPlaceholder}
              className="mb-4 px-2"
              inputClassName="bg-white/95 text-maindark border-[color:var(--color-border-soft)] py-3 placeholder:text-[color:var(--color-text-muted)] shadow-[0_8px_18px_rgba(68,78,125,0.06)] focus:shadow-[0_0_0_4px_rgba(124,92,255,0.12)] dark:border-white/10 dark:bg-primarydark dark:text-primary dark:placeholder:text-primary/45"
              iconClassName="text-[color:var(--color-text-muted)] group-focus-within:text-main"
              clearButtonClassName="text-[color:var(--color-text-muted)] hover:text-main"
            />
          )}
        />

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2.5 mb-6 custom-scrollbar">
          {filteredData.map((item) => {
            const key = keyExtractor(item);
            const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false;
            const label = labelKey ? String(item[labelKey] ?? "").trim() : "";
            const initial = label.charAt(0).toLocaleUpperCase() || "•";
            return (
              <button
                type="button"
                key={key}
                onClick={() => handleItemClick(item)}
                data-selected={isSelected ? "true" : undefined}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "popup-select-option-selected border-main bg-main/10 shadow-[0_14px_34px_rgba(124,58,237,0.18)] ring-1 ring-main/25 dark:bg-main/18 dark:shadow-[0_16px_38px_rgba(0,0,0,0.28)]"
                    : "border-[color:var(--color-border-soft)] bg-white/70 shadow-sm hover:-translate-y-0.5 hover:border-main/45 hover:bg-white hover:shadow-[0_12px_28px_rgba(39,44,82,0.12)] dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-main/55 dark:hover:bg-white/[0.075]"
                }`}
              >
                <div className="popup-select-option-content flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(item, isSelected)
                  ) : (
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${isSelected
                          ? "bg-main text-white shadow-lg shadow-main/25"
                          : "bg-[color:var(--color-main-soft)] text-main dark:bg-white/10 dark:text-primary"
                        }`}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold leading-tight text-maindark dark:text-primary">
                          {labelKey ? label : String(item)}
                        </h3>
                        {secondaryLabelKey && (
                          <p className="mt-0.5 truncate text-sm font-medium text-[color:var(--color-text-muted)] dark:text-primary/60">
                            {String(item[secondaryLabelKey] ?? "")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all ${isSelected
                    ? "border-main bg-main text-white opacity-100"
                    : "border-[color:var(--color-border-soft)] bg-white/60 text-transparent opacity-70 group-hover:border-main/45 dark:border-white/10 dark:bg-white/5"
                  }`}
                  aria-hidden="true"
                >
                  <Check size={15} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[color:var(--color-border-soft)] dark:border-white/10">
          <Button
            label={resolvedCancelLabel}
            className="!border !border-[color:var(--color-border-soft)] !bg-white !text-maindark !shadow-sm hover:!bg-[var(--color-main-soft)] dark:!border-white/10 dark:!bg-white/8 dark:!text-primary dark:hover:!bg-white/14"
            onClick={onClose}
          />
          <Button
            label={resolvedSelectLabel}
            disabled={!selectedItem}
            className={`px-8 ${!selectedItem
              ? "!cursor-not-allowed !border !border-[color:var(--color-border-soft)] !bg-slate-200 !text-slate-500 !shadow-none opacity-100 dark:!border-white/10 dark:!bg-white/10 dark:!text-white/45"
              : "!bg-main !text-white hover:!bg-primarydark"
              }`}
            onClick={handleSelect}
          />
        </div>
      </div>
    </Popup>
  );
};

export default memo(PopupSelect) as typeof PopupSelect;
