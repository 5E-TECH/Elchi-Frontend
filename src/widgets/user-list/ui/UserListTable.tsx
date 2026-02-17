import { memo, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../entities/user/types/user';
import { UserStatusBadge } from '../../../entities/user/ui/UserStatusBadge';
import { UserRoleBadge } from '../../../entities/user/ui/UserRoleBadge';
import { Table } from '../../../shared/components/Table/Table';
import type { ColumnConfig } from '../../../shared/components/Table/Table.types';

interface UserListTableProps {
    users: User[];
    isLoading?: boolean;
    isError?: boolean;
    error?: any;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    currentPage: number;
    onPageChange: (page: number) => void;
}

export const UserListTable = memo(({
    users,
    isLoading,
    isError,
    // error,
    pagination,
    currentPage,
    onPageChange
}: UserListTableProps) => {
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    // Backend dan ma'lumot olish
    // const { getUser } = useUser();
    // const { data, isLoading, isError } = getUser();
    console.log(selectedUsers);


    // console.log('=== BACKEND DATA ===');
    // console.log('Full Response:', data);
    // console.log('Users:', data?.data?.items);
    // console.log('Meta:', data?.data?.meta);
    // console.log('===================');

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            newSet.has(userId) ? newSet.delete(userId) : newSet.add(userId);
            return newSet;
        });
    };

    const columns: ColumnConfig<User>[] = [
        {
            key: 'name',
            label: 'Ismi',
            width: '30%',
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {String(value).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-900 dark:text-white text-sm font-medium">{value}</span>
                </div>
            ),
        },
        {
            key: 'phone_number',
            label: 'Telefon',
            width: '25%',
            sortable: true,
            className: 'text-gray-600 dark:text-gray-400 text-sm font-mono',
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
                        className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                    >
                        <div className={`w-8 h-4 rounded-full relative flex items-center p-0.5 transition-colors ${user.status === 'active'
                            ? 'bg-blue-200 dark:bg-blue-800'
                            : 'bg-gray-200 dark:bg-gray-700'
                            }`}>
                            <div
                                className={`w-3 h-3 rounded-full transition-all ${user.status === 'active'
                                    ? 'bg-blue-600 dark:bg-blue-400 ml-auto'
                                    : 'bg-gray-600 dark:bg-gray-400 ml-0'
                                    }`}
                            />
                        </div>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        },
    ];

    // Loading state
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#1a1f3a] rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-main animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">Yuklanmoqda...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (isError) {
        return (
            <div className="bg-white dark:bg-[#1a1f3a] rounded-xl border border-red-200 dark:border-red-900/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Xatolik yuz berdi</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Ma'lumotlarni yuklashda xatolik
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Users props dan keladi (duplicate o'chirildi)

    // Empty state
    if (users.length === 0) {
        return (
            <div className="bg-white dark:bg-[#1a1f3a] rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📭</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Foydalanuvchilar topilmadi</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Hech qanday foydalanuvchi mavjud emas
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#1a1f3a] rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
            <Table
                data={users}
                columns={columns}
                keyExtractor={(user) => user.id}
                hoverable
                onRowClick={(user) => navigate(`/all-users/${user.id}`)}
            />

            {/* Pagination */}
            <div
                className="px-6 py-4 border-t border-gray-200 dark:border-primarydark/20 flex items-center justify-between"
                style={{
                    background: 'linear-gradient(90deg, var(--color-main) 0%, var(--color-primarydark) 100%)'
                }}
            >
                <span className="text-sm text-white">
                    {pagination ? (
                        `${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} dan ${pagination.total} tasi ko'rsatilmoqda`
                    ) : (
                        `${users.length} ta foydalanuvchi`
                    )}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        className="px-4 py-2 rounded-lg border border-white/30 text-white text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!pagination || pagination.page === 1}
                    >
                        Oldingi
                    </button>
                    <span className="px-4 py-2 text-white text-sm font-medium flex items-center">
                        {pagination?.page || 1} / {pagination?.totalPages || 1}
                    </span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        className="px-4 py-2 rounded-lg border border-white/30 text-white text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!pagination || pagination.page >= pagination.totalPages}
                    >
                        Keyingi
                    </button>
                </div>
            </div>
        </div>
    );
});

UserListTable.displayName = 'UserListTable';