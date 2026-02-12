import { memo } from 'react';
import { Search, Filter, RefreshCw, ChevronDown } from 'lucide-react';

export const UserFilters = memo(() => {
    return (
        <div className="bg-primary dark:bg-maindark p-5 rounded-2xl shadow-lg shadow-black/10 flex flex-col xl:flex-row items-center gap-4 mb-6">
            <div className="flex items-center gap-3 text-main font-semibold text-lg mr-2 min-w-max">
                <div className="p-2 rounded-lg">
                    <Filter size={20} />
                </div>
                Filtrlar
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                {/* Role Select */}
                <div className="relative group">
                    <select className="w-full bg-primary border-2 border-primary rounded-xl px-4 py-3 text-maindark focus:border-main focus:ring-2 focus:ring-main/30 outline-none appearance-none cursor-pointer transition-all hover:shadow-md font-medium">
                        <option value="">Rolni tanlang</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="courier">Courier</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-maindark pointer-events-none group-hover:text-main transition-colors" size={18} />
                </div>

                {/* Status Select */}
                <div className="relative group">
                    <select className="w-full bg-primary border-2 border-primary rounded-xl px-4 py-3 text-maindark focus:border-main focus:ring-2 focus:ring-main/30 outline-none appearance-none cursor-pointer transition-all hover:shadow-md font-medium">
                        <option value="">Holatni tanlang</option>
                        <option value="active">Faol</option>
                        <option value="inactive">Faol emas</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-maindark pointer-events-none group-hover:text-main transition-colors" size={18} />
                </div>

                {/* Search Input */}
                <div className="relative xl:col-span-2 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-maindark/60 group-hover:text-main transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Foydalanuvchini qidirish..."
                        className="w-full bg-primary border-2 border-primary rounded-xl pl-11 pr-4 py-3 text-maindark focus:border-main focus:ring-2 focus:ring-main/30 outline-none transition-all placeholder:text-maindark/40 hover:shadow-md font-medium"
                    />
                </div>
            </div>

            <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-primary/90 hover:text-primary bg-transparent border-2 border-primary hover:bg-primary/10 transition-all whitespace-nowrap active:scale-95 w-full xl:w-auto font-medium hover:shadow-md">
                <RefreshCw size={18} />
                Tozalash
            </button>
        </div>
    );
});