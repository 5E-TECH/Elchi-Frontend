import {
  forwardRef,
  memo,
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { Search, X, type LucideIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setSearchValue } from "../model/searchSlice";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import { useDebounce } from "../../../shared/lib/useDebounce";
import type { RootState } from "../../../app/config/store";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "value" | "defaultValue" | "name" | "onChange"
>;

interface GlobalSearchInputProps extends NativeInputProps {
  searchKey?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  clearButtonClassName?: string;
  debounceDelay?: number;
  syncWithRedux?: boolean;
  syncWithUrl?: boolean;
  showClearButton?: boolean;
  showIcon?: boolean;
  icon?: LucideIcon;
  error?: boolean;
}

const GlobalSearchInputBase = forwardRef<HTMLInputElement, GlobalSearchInputProps>(
  (
    {
      searchKey,
      name,
      value,
      defaultValue = "",
      onValueChange,
      placeholder = "Qidirish...",
      className = "",
      inputClassName = "",
      iconClassName = "",
      clearButtonClassName = "",
      debounceDelay = 1000,
      syncWithRedux = true,
      syncWithUrl = true,
      showClearButton = true,
      showIcon = true,
      icon: InputIcon = Search,
      error = false,
      onBlur,
      ...inputProps
    },
    ref,
  ) => {
    const dispatch = useDispatch();
    const { setParam } = useQueryParams();
    const generatedName = useId();
    const resolvedName = name ?? searchKey ?? generatedName;

    const reduxValue = useSelector((state: RootState) => {
      if (!searchKey) return "";
      return (state.search[searchKey] as string) || "";
    });

    const isControlled = value !== undefined;
    const isGlobalMode = Boolean(searchKey) && !isControlled && !onValueChange;

    const [localValue, setLocalValue] = useState(
      isGlobalMode ? reduxValue : (value ?? defaultValue),
    );

    const debouncedSaveToUrl = useDebounce((nextValue: string) => {
      if (searchKey && syncWithUrl) {
        setParam(searchKey, nextValue);
      }
    }, debounceDelay);

    useEffect(() => {
      if (isGlobalMode) {
        setLocalValue(reduxValue);
      }
    }, [isGlobalMode, reduxValue]);

    useEffect(() => {
      if (isControlled) {
        setLocalValue(value ?? "");
      }
    }, [isControlled, value]);

    const currentValue = useMemo(() => {
      if (isControlled) return value ?? "";
      return localValue;
    }, [isControlled, localValue, value]);

    const emitChange = (nextValue: string) => {
      if (!isControlled) {
        setLocalValue(nextValue);
      }

      if (isGlobalMode && searchKey) {
        if (syncWithRedux) {
          dispatch(setSearchValue({ key: searchKey, value: nextValue }));
        }
        debouncedSaveToUrl(nextValue);
        return;
      }

      onValueChange?.(nextValue);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      emitChange(event.target.value);
    };

    const handleClear = () => {
      emitChange("");
    };

    return (
      <div className={`relative group ${className}`}>
        {showIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <InputIcon
              className={`text-slate-400 dark:text-white/40 group-focus-within:text-main dark:group-focus-within:text-main transition-colors ${iconClassName}`}
              size={18}
            />
          </div>
        )}

        <input
          {...inputProps}
          ref={ref}
          type="text"
          name={resolvedName}
          value={currentValue}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full bg-primary dark:bg-maindark border-2 rounded-xl ${showIcon ? "pl-11" : "pl-4"} pr-4 py-3 text-maindark dark:text-white text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-white/40 outline-none transition-all hover:shadow-sm focus:shadow-md shadow-sm ${error
            ? "border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
            : "border-gray-200 dark:border-primarydark/30 focus:border-main dark:focus:border-main focus:ring-2 focus:ring-main/20 hover:border-main/50 dark:hover:border-main/50"
            } ${showClearButton ? "pr-11" : ""} ${inputClassName}`}
        />

        {showClearButton && currentValue && !inputProps.disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors ${clearButtonClassName}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  },
);

GlobalSearchInputBase.displayName = "GlobalSearchInput";

export const GlobalSearchInput = memo(GlobalSearchInputBase);
