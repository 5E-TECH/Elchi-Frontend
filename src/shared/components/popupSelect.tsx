import { memo, useState, type ReactNode, useMemo } from 'react';
import HeaderName from './headerName';
import { Check, Search, X } from 'lucide-react';
import Button from './button';
import Popup from '../ui/Popup';

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

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
      <div className={`bg-primary dark:bg-maindark w-[92vw] max-w-140 rounded-2xl px-5 md:px-8 py-7 md:py-10 text-main dark:text-primary shadow-2xl flex flex-col max-h-[90vh] ${className}`}>
        <div className="flex justify-between items-center mb-6">
          <HeaderName
            name={title}
            description={description}
            icon={icon}
          />
          <X
            className="absolute top-6 right-6 cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onClose}
          />
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={placeholder}
            className="w-full bg-gray-50 dark:bg-[#2A2555] text-gray-900 dark:text-white pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 mb-6 custom-scrollbar">
          {filteredData.map((item) => {
            const key = keyExtractor(item);
            const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false;
            return (
              <div
                key={key}
                onClick={() => handleItemClick(item)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border  ${isSelected
                  ? "bg-indigo-50 dark:bg-transparent shadow-[0_0_0_1px_rgba(99,102,241,1)]"
                  : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
              >
                {renderItem ? (
                  renderItem(item, isSelected)
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-primarydark flex items-center justify-center text-primary dark:text-gray-300 font-medium text-sm">
                      {key}
                    </div>
                    <div>
                      <h3 className="text-maindark dark:text-primary font-medium text-lg leading-tight">
                        {labelKey ? item[labelKey] : String(item)}
                      </h3>
                      {secondaryLabelKey && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {item[secondaryLabelKey]}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button
            label={cancelLabel}
            className="bg-transparent border border-gray-200 dark:border-primarydark text-primarydark dark:text-primary hover:bg-gray-50 dark:hover:bg-primary/5"
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