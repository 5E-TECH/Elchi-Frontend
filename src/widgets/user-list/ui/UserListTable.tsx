import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserStatusBadge } from '../../../entities/user/ui/UserStatusBadge';
import { UserRoleBadge } from '../../../entities/user/ui/UserRoleBadge';

// Mock data
const users: User[] = [
    { id: '1', fullName: 'XanaUz', phone: '+998 88 859 42 42', role: 'marketing', status: 'active' },
    { id: '2', fullName: 'ozar.uz', phone: '+998 99 831 72 41', role: 'marketing', status: 'active' },
    { id: '3', fullName: 'Faxriddin Maripov', phone: '+998 94 019 61 41', role: 'operator', status: 'active' },
    { id: '4', fullName: 'toshkent javlon aka', phone: '+998 94 401 81 81', role: 'courier', status: 'active' },
    { id: '5', fullName: 'SSmobile', phone: '+998 99 975 44 14', role: 'marketing', status: 'active' },
    { id: '6', fullName: 'shahar0909', phone: '+998 99 999 09 09', role: 'marketing', status: 'active' },
    { id: '7', fullName: 'Maxsus Kompaniya', phone: '+998 91 111 11 11', role: 'marketing', status: 'active' },
    { id: '8', fullName: 'Muhammad', phone: '+998 88 355 15 55', role: 'operator', status: 'active' },
];

export const UserListTable = memo(() => {
    return (
        <div className="bg-[#1E1E2E] rounded-xl border border-white/5 overflow-hidden mt-6">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--primary)] text-white text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold rounded-tl-xl">#</th>
                            <th className="p-4 font-semibold">Ismi</th>
                            <th className="p-4 font-semibold">Telefon</th>
                            <th className="p-4 font-semibold text-center">Roli</th>
                            <th className="p-4 font-semibold text-center">Holati</th>
                            <th className="p-4 font-semibold text-center rounded-tr-xl">Harakat</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((user, index) => (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 text-gray-400 text-sm font-medium">{index + 1}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs">
                                            {user.fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white text-sm font-medium">{user.fullName}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-gray-400 text-sm font-mono">{user.phone}</td>
                                <td className="p-4 text-center">
                                    <UserRoleBadge role={user.role} />
                                </td>
                                <td className="p-4 text-center">
                                    <UserStatusBadge status={user.status} />
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-colors">
                                            <div className="w-8 h-4 rounded-full bg-emerald-500/20 relative flex items-center p-0.5">
                                                <div className="w-3 h-3 bg-emerald-500 rounded-full ml-auto"></div>
                                            </div>
                                        </button>
                                        <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-sm text-gray-400">1-8 dan 150 tasi ko'rsatilmoqda</span>
                <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50" disabled>Previous</button>
                    <button className="px-3 py-1 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5">Next</button>
                </div>
            </div>
        </div>
    );
});
