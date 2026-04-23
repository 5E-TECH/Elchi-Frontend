import { memo, useState, type ReactNode, useMemo } from 'react';
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

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div className={`bg-[color:var(--color-surface-elevated)] dark:bg-[color:var(--color-surface-elevated-dark)] w-[92vw] max-w-140 rounded-2xl border border-[color:var(--color-border-soft)] px-5 md:px-8 py-7 md:py-10 text-maindark dark:text-primary shadow-2xl flex flex-col max-h-[90vh] ${className}`}>
        <div className="flex justify-between items-center mb-6">
          <HeaderName
            name={title}
            description={description}
            icon={icon}
          />
          <X
            className="absolute top-6 right-6 cursor-pointer text-[color:var(--color-text-muted)] hover:text-error dark:hover:text-primary"
            onClick={onClose}
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
              inputClassName="bg-sidebar dark:bg-primarydark text-maindark dark:text-primary border-[color:var(--color-border-soft)] py-3 placeholder:text-[color:var(--color-text-muted)] shadow-none focus:shadow-none"
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
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected
                  ? "border-main bg-main text-primary shadow-lg shadow-main/20"
                  : "border-transparent bg-sidebar/70 text-maindark hover:border-main/20 hover:bg-main/5 dark:bg-primary/5 dark:text-primary dark:hover:bg-primary/10"
                  }`}
              >
                {renderItem ? (
                  renderItem(item, isSelected)
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium text-sm ${isSelected
                      ? "bg-primary/18 text-primary"
                      : "bg-[color:color-mix(in_srgb,var(--color-main)_12%,transparent)] text-main dark:bg-primarydark dark:text-gray-300"
                      }`}>
                      {key}
                    </div>
                    <div>
                      <h3 className={`font-medium text-lg leading-tight ${isSelected ? "text-primary" : "text-maindark dark:text-primary"}`}>
                        {labelKey ? item[labelKey] : String(item)}
                      </h3>
                      {secondaryLabelKey && (
                        <p className={`text-sm ${isSelected ? "text-primary/75" : "text-gray-500 dark:text-gray-400"}`}>
                          {item[secondaryLabelKey]}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[color:var(--color-border-soft)]">
          <Button
            label={cancelLabel}
            className="border border-[color:var(--color-border-soft)] text-maindark dark:text-primary hover:bg-main/5 dark:hover:bg-primary/5"
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
