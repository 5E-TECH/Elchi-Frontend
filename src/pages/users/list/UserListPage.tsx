import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { UserStats } from '../../../widgets/user-list/ui/UserStats';
import { UserListTable } from '../../../widgets/user-list/ui/UserListTable';
import { UserFilters } from '../../../features/user/filter-users/ui/UserFilters';

const UserListPage = memo(() => {
    const navigate = useNavigate();

    return (
        <div className="p-6 rounded-2xl bg-primary dark:bg-[#2A2555]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-main dark:text-primary flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-linear-to-br from-main to-indigo-600 dark:from-maindark dark:to-indigo-500 text-white shadow-lg shadow-main/20 dark:shadow-maindark/20">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        </span>
                        Foydalanuvchilar
                    </h1>
                    <p className="text-main dark:text-primary mt-1.5 ml-12 font-medium">Foydalanuvchilarni boshqarish markazi</p>
                </div>

                <button
                    onClick={() => navigate('/all-users/create-user')}
                    className="flex items-center gap-2 bg-main dark:bg-maindark text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
                >
                    <Plus size={22} strokeWidth={2.5} />
                    Qo'shish
                </button>
            </div>

            <UserStats />

            <UserFilters />

            <UserListTable />
        </div>
    );
});

export default UserListPage;