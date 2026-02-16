import { memo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Search, Filter, RefreshCw } from 'lucide-react';
import Select from '../../../../shared/ui/Select';
import type { RootState } from '../../../../app/config/store';

export const UserFilters = memo(() => {
    // Redux dan filter qiymatlarini olish
    const filters = useSelector((state: RootState) => state.filter);

    // Role options
    const roleOptions = [
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Ro\'yxatchi' },
        { value: 'courier', label: 'Kuryer' },
        { value: 'marketing', label: 'Market' },
        { value: 'operator', label: 'Operator' },
    ];

    // Status options
    const statusOptions = [
        { value: 'active', label: 'Faol' },
        { value: 'inactive', label: 'Faol emas' },
    ];

    // Filter qiymatlari o'zgarganda consolega chiqarish
    useEffect(() => {
        if (filters.userRole || filters.userStatus || filters.userSearch) {
            console.log("=== USER FILTERS - REDUX QIYMATLARI ===");
            if (filters.userRole) console.log("Role:", filters.userRole);
            if (filters.userStatus) console.log("Status:", filters.userStatus);
            if (filters.userSearch) console.log("Search:", filters.userSearch);
            console.log("========================================");
        }
    }, [filters]);

    return (
        <div className="bg-primary dark:bg-main p-5 rounded-2xl shadow-lg shadow-black/10 flex flex-col xl:flex-row items-center gap-4 mb-6">
            <div className="flex items-center gap-3 text-main dark:text-primary font-semibold text-lg mr-2 min-w-max">
                <div className="p-2 rounded-lg dark:text-primary">
                    <Filter size={20} />
                </div>
                Filtrlar
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                {/* Role Select - Redux bilan */}
                <Select
                    name="role"
                    options={roleOptions}
                    placeholder="Rolni tanlang"
                    className="bg-primary dark:bg-maindark border-2 border-primary dark:border-primarydark"
                    useRedux={true}
                    reduxKey="userRole"
                />

                {/* Status Select - Redux bilan */}
                <Select
                    name="status"
                    options={statusOptions}
                    placeholder="Holatni tanlang"
                    className="bg-primary dark:bg-maindark border-2 border-primary dark:border-primarydark"
                    useRedux={true}
                    reduxKey="userStatus"
                />

                {/* Search Input */}
                <div className="relative xl:col-span-2 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-maindark/60 dark:text-white/60 group-hover:text-main transition-colors z-10" size={18} />
                    <input
                        type="text"
                        name="search"
                        value={(filters.userSearch as string) || ''}
                        // onChange={(e) => {
                        //     // Bu yerda Redux ga saqlash uchun dispatch qilish kerak
                        //     // Lekin oddiy input uchun alohida komponent yaratish yaxshiroq
                        // }}
                        placeholder="Foydalanuvchini qidirish..."
                        className="w-full bg-primary dark:bg-[#1a1f3a] border-2 border-primary dark:border-primarydark/20 rounded-xl pl-11 pr-4 py-3 text-maindark dark:text-white focus:border-main dark:focus:border-main focus:ring-2 focus:ring-main/30 outline-none transition-all placeholder:text-maindark/40 dark:placeholder:text-white/30 hover:shadow-md font-medium"
                    />
                </div>
            </div>

            <button
                onClick={() => {
                    // Redux ni tozlash uchun resetFilters dispatch qilish kerak
                    // Bu yerda dispatch qilish kerak
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-main dark:text-primary dark:bg-primary hover:text-maindark dark:hover:text-maindark bg-transparent border-2 border-main dark:border-primary transition-all whitespace-nowrap active:scale-95 w-full xl:w-auto font-medium hover:shadow-md"
            >
                <RefreshCw size={18} />
                Tozalash
            </button>
        </div>
    );
});

UserFilters.displayName = 'UserFilters';