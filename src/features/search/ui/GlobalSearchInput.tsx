import { memo, useState, useEffect, type ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search } from 'lucide-react';
import { setSearchValue } from '../model/searchSlice';
import { useQueryParams } from '../../../shared/lib/useQueryParams';
import { useDebounce } from '../../../shared/lib/useDebounce';
import type { RootState } from '../../../app/config/store';

interface GlobalSearchInputProps {
    /**
     * Redux va URL params uchun unique key
     * Masalan: 'userSearch', 'productSearch'
     */
    searchKey: string;

    /**
     * Placeholder text
     */
    placeholder?: string;

    /**
     * Additional CSS classes
     */
    className?: string;

    /**
     * Debounce delay (ms)
     * @default 1000
     */
    debounceDelay?: number;
}

export const GlobalSearchInput = memo(({
    searchKey,
    placeholder = 'Qidirish...',
    className = '',
    debounceDelay = 1000,
}: GlobalSearchInputProps) => {
    const dispatch = useDispatch();
    const { setParam } = useQueryParams();

    // Local state (input uchun)
    const [localValue, setLocalValue] = useState('');

    // Redux dan qiymatni olish (faqat o'qish uchun)
    const reduxValue = useSelector((state: RootState) =>
        (state.search[searchKey] as string) || ''
    );

    // URL params ga saqlash uchun debounced function
    const debouncedSaveToUrl = useDebounce((value: string) => {
        setParam(searchKey, value);
        console.log(`✅ URL params ga saqlandi: ${searchKey} = "${value}"`);
    }, debounceDelay);

    // Input o'zgarganda
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // 1. Local state ga darhol saqlash (input responsive bo'lishi uchun)
        setLocalValue(value);

        // 2. Redux ga darhol saqlash
        dispatch(setSearchValue({ key: searchKey, value }));

        // 3. URL params ga debounce bilan saqlash (1 sekund kutadi)
        debouncedSaveToUrl(value);
    };

    // Redux qiymati o'zgarganda local state ni sync qilish
    // (Tozalash button bosilganda Redux tozalanadi, local state ham tozalanishi kerak)
    useEffect(() => {
        setLocalValue(reduxValue);
    }, [reduxValue]);

    return (
        <div className={`relative group ${className}`}>
            {/* Search Icon */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Search
                    className="text-slate-400 dark:text-white/40 group-focus-within:text-main dark:group-focus-within:text-main transition-colors"
                    size={18}
                />
            </div>

            {/* Input */}
            <input
                type="text"
                name={searchKey}
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full bg-primary dark:bg-maindark border-2 border-gray-200 dark:border-primarydark/30 rounded-xl pl-11 pr-4 py-3 text-maindark dark:text-white text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-main dark:focus:border-main focus:ring-2 focus:ring-main/20 outline-none transition-all hover:border-main/50 dark:hover:border-main/50 hover:shadow-sm focus:shadow-md shadow-sm"
            />
        </div>
    );
});

GlobalSearchInput.displayName = 'GlobalSearchInput';
