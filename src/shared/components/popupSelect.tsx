import { memo, useEffect, useState, type ReactNode, useMemo } from 'react';
import HeaderName from './headerName';
import { X } from 'lucide-react';
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

const PopupSelect = <T extends Record<string, any>>({
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
  placeholder = "Search...",
  selectLabel = "Select",
  cancelLabel = "Cancel",
  className = "",
  labelKey,
  secondaryLabelKey,
}: PopupSelectProps<T>) => {
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
        className={`flex max-h-[90vh] w-[92vw] max-w-140 flex-col rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,248,255,0.99)_100%)] px-5 py-7 text-maindark shadow-[0_30px_70px_rgba(46,54,98,0.18)] dark:border-white/10 dark:bg-[color:var(--color-surface-elevated-dark)] dark:bg-none dark:text-primary dark:shadow-[0_30px_70px_rgba(0,0,0,0.34)] md:px-8 md:py-10 ${className}`}
      >
        <div className="flex justify-between items-center mb-6">
          <HeaderName
            name={title}
            description={description}
            icon={icon}
          />
          <X
            className="absolute top-6 right-6 cursor-pointer text-[color:var(--color-text-muted)] hover:text-error dark:hover:text-primary"
            onClick={onClose}
            aria-label={cancelLabel}
          />
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
              placeholder={placeholder}
              className="mb-4 px-2"
              inputClassName="bg-white/95 text-maindark border-[color:var(--color-border-soft)] py-3 placeholder:text-[color:var(--color-text-muted)] shadow-[0_8px_18px_rgba(68,78,125,0.06)] focus:shadow-[0_0_0_4px_rgba(124,92,255,0.12)] dark:border-white/10 dark:bg-primarydark dark:text-primary dark:placeholder:text-primary/45"
              iconClassName="text-[color:var(--color-text-muted)] group-focus-within:text-main"
              clearButtonClassName="text-[color:var(--color-text-muted)] hover:text-main"
            />
          )}
        />

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 mb-6 custom-scrollbar">
          {filteredData.map((item) => {
            const key = keyExtractor(item);
            const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false;
            return (
              <div
                key={key}
                onClick={() => handleItemClick(item)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border  ${isSelected
                  ? "border-main/45 bg-[linear-gradient(135deg,rgba(99,102,241,0.16)_0%,rgba(124,92,255,0.1)_100%)] shadow-[0_14px_30px_rgba(99,102,241,0.12)] dark:bg-main/15 dark:bg-none dark:shadow-[0_0_0_1px_rgba(124,92,255,0.55)]"
                  : "border-transparent bg-transparent hover:bg-[var(--color-main-soft)] dark:hover:bg-primary/8"
                  }`}
              >
                <div className="flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(item, isSelected)
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[color:var(--color-main-soft)] dark:bg-primarydark flex items-center justify-center text-main dark:text-gray-300 font-medium text-sm">
                        {key}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-maindark dark:text-primary font-medium text-lg leading-tight">
                          {labelKey ? item[labelKey] : String(item)}
                        </h3>
                        {secondaryLabelKey && (
                          <p className="text-[color:var(--color-text-muted)] dark:text-gray-400 text-sm">
                            {item[secondaryLabelKey]}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[color:var(--color-border-soft)] dark:border-white/10">
          <Button
            label={cancelLabel}
            className="border border-[color:var(--color-border-soft)] bg-white/80 text-maindark hover:bg-[var(--color-main-soft)] dark:border-white/10 dark:bg-white/5 dark:text-primary dark:hover:bg-white/10"
            onClick={onClose}
          />
          <Button
            label={selectLabel}
            className={`px-8 ${!selectedItem
              ? "opacity-50 cursor-not-allowed"
              : "bg-main hover:bg-main"
              }`}
            onClick={handleSelect}
          />
        </div>
      </div>
    </Popup>
  );
};

export default memo(PopupSelect) as typeof PopupSelect;
