import { memo } from 'react';
import { Search, Filter, RefreshCw, ChevronDown } from 'lucide-react';

export const UserFilters = memo(() => {
    return (
        <div className="bg-[var(--primarydark)] p-5 rounded-2xl shadow-xl shadow-black/5 flex flex-col xl:flex-row items-center gap-4 mb-6">
            <div className="flex items-center gap-3 text-[var(--primary)] font-semibold text-lg mr-2 min-w-max">
                <div className="p-2 bg-[var(--main)]/20 rounded-lg text-[var(--main)]">
                    <Filter size={20} />
                </div>
                Filtrlar
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                {/* Role Select */}
                <div className="relative group">
                    <select className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl px-4 py-3 text-[var(--primary)] focus:border-[var(--main)] focus:ring-2 focus:ring-[var(--main)]/20 outline-none appearance-none cursor-pointer transition-all hover:bg-[var(--maindark)]/70">
                        <option value="">Rolni tanlang</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="courier">Courier</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--primary)]/50 pointer-events-none group-hover:text-[var(--primary)] transition-colors" size={16} />
                </div>

                {/* Status Select */}
                <div className="relative group">
                    <select className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl px-4 py-3 text-[var(--primary)] focus:border-[var(--main)] focus:ring-2 focus:ring-[var(--main)]/20 outline-none appearance-none cursor-pointer transition-all hover:bg-[var(--maindark)]/70">
                        <option value="">Holatni tanlang</option>
                        <option value="active">Faol</option>
                        <option value="inactive">Faol emas</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--primary)]/50 pointer-events-none group-hover:text-[var(--primary)] transition-colors" size={16} />
                </div>

                {/* Search Input */}
                <div className="relative xl:col-span-2 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]/50 group-hover:text-[var(--main)] transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Foydalanuvchini qidirish..."
                        className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl pl-11 pr-4 py-3 text-[var(--primary)] focus:border-[var(--main)] focus:ring-2 focus:ring-[var(--main)]/20 outline-none transition-all placeholder:text-[var(--primary)]/30 hover:bg-[var(--maindark)]/70"
                    />
                </div>
            </div>

            <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[var(--primary)]/70 hover:text-[var(--primary)] hover:bg-[var(--maindark)]/50 border border-transparent hover:border-[var(--primary)]/10 transition-all whitespace-nowrap active:scale-95 w-full xl:w-auto">
                <RefreshCw size={18} />
                Tozalash
            </button>
        </div>
    );
});
