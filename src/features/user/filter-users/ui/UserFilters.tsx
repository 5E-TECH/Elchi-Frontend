import { memo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Filter, RefreshCw } from 'lucide-react';
import Select from '../../../../shared/ui/Select';
import { GlobalSearchInput } from '../../../search';
import { resetFilters } from '../../../Select/model/FilterSlice';
import { clearAllSearch } from '../../../search/model/searchSlice';
import { useQueryParams } from '../../../../shared/lib/useQueryParams';
import type { RootState } from '../../../../app/config/store';

export const UserFilters = memo(() => {
    const dispatch = useDispatch();
    const { clearAllParams } = useQueryParams();

    // Redux dan filter qiymatlarini olish
    const filters = useSelector((state: RootState) => state.filter);

    // Role options - Backend API ga mos value lar
    const roleOptions = [
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Ro\'yxatchi' },
        { value: 'courier', label: 'Kuryer' },
        { value: 'market', label: 'Market' },  // marketing emas, market
        { value: 'operator', label: 'Operator' },
        { value: 'superadmin', label: 'Super Admin' },
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

    // Tozalash funksiyasi
    const handleReset = () => {
        // 1. Redux filterlarni tozalash
        dispatch(resetFilters());

        // 2. Redux searchni tozalash
        dispatch(clearAllSearch());

        // 3. URL params tozalash
        clearAllParams();

        console.log("✅ Barcha filterlar tozalandi");
    };

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

                {/* Global Search Input - Redux va URL params bilan */}
                <GlobalSearchInput
                    searchKey="userSearch"
                    placeholder="Foydalanuvchini qidirish..."
                    className="xl:col-span-2"
                />
            </div>

            <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-main dark:text-primary dark:bg-primary hover:text-maindark dark:hover:text-maindark bg-transparent border-2 border-main dark:border-primary transition-all whitespace-nowrap active:scale-95 w-full xl:w-auto font-medium hover:shadow-md"
            >
                <RefreshCw size={18} />
                Tozalash
            </button>
        </div>
    );
});

UserFilters.displayName = 'UserFilters';