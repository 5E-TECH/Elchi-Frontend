import { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserStatusBadge } from '../../../entities/user/ui/UserStatusBadge';
import { UserRoleBadge } from '../../../entities/user/ui/UserRoleBadge';
import { Table } from '../../../shared/ui/Table/Table';
import type { ColumnConfig } from '../../../shared/ui/Table/Table.types';

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
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            newSet.has(userId) ? newSet.delete(userId) : newSet.add(userId);
            return newSet;
        });
    };

    const columns: ColumnConfig<User>[] = [
        {
            key: 'fullName',
            label: 'Ismi',
            width: '30%',
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {String(value).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-900 text-sm font-medium">{value}</span>
                </div>
            ),
        },
        {
            key: 'phone',
            label: 'Telefon',
            width: '25%',
            sortable: true,
            className: 'text-gray-600 text-sm font-mono',
        },
        {
            key: 'role',
            label: 'Roli',
            width: '15%',
            sortable: true,
            render: (value) => <UserRoleBadge role={value as any} />,
        },
        {
            key: 'status',
            label: 'Holati',
            width: '15%',
            render: (value) => <UserStatusBadge status={value as any} />,
        },
        {
            key: 'id',
            label: 'Harakat',
            width: '15%',
            render: (_, user) => (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => toggleUser(user.id)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                    >
                        <div className="w-8 h-4 rounded-full bg-blue-200 relative flex items-center p-0.5">
                            <div
                                className={`w-3 h-3 bg-blue-600 rounded-full transition-all ${
                                    selectedUsers.has(user.id) ? 'ml-auto' : 'ml-0'
                                }`}
                            />
                        </div>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <Table data={users} columns={columns} keyExtractor={(user) => user.id} hoverable />
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <span className="text-sm text-gray-600">1-{users.length} dan 150 tasi ko'rsatilmoqda</span>
                <div className="flex gap-2">
                    <button 
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors" 
                        disabled
                    >
                        Previous
                    </button>
                    <button className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
});

UserListTable.displayName = 'UserListTable';