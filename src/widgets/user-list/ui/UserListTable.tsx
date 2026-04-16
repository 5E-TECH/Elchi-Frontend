import { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../entities/user/types/user';
import { UserStatusBadge } from '../../../entities/user/ui/UserStatusBadge';
import { UserRoleBadge } from '../../../entities/user/ui/UserRoleBadge';
import { Table } from '../../../shared/components/Table/Table';
import type { ColumnConfig } from '../../../shared/components/Table/Table.types';
import { useUser } from '../../../entities/user/api/userApi';
import { useTranslation } from 'react-i18next';
import Pagination from '../../../shared/components/pagination';
import { useAppNotification } from '../../../app/providers/notification/NotificationProvider';

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
    const { t } = useTranslation("users");
    const navigate = useNavigate();
    const { updateUserStatus } = useUser();
    const { api } = useAppNotification();

    // Hozirda so'rov ketayotgan userlar ID lari
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const handleStatusToggle = (user: User, e: React.MouseEvent) => {
        e.stopPropagation(); // Row click ga o'tmasin
        if (loadingIds.has(user.id)) return; // Ikki marta bosilmasin

        const newStatus = user.status === 'active' ? 'inactive' : 'active';

        // Loading boshlan
        setLoadingIds(prev => new Set([...prev, user.id]));

        updateUserStatus.mutate(
            { id: user.id, status: newStatus },
            {
                onSuccess: () => {
                    api.success({
                        message: t("statusChangeSuccessTitle"),
                        description: t(
                            newStatus === "active"
                                ? "statusActivatedSuccess"
                                : "statusDeactivatedSuccess",
                            { name: user.name },
                        ),
                        placement: "topRight",
                        duration: 4,
                    });
                },
                onError: (error: unknown) => {
                    const errorMessage =
                        typeof error === "object" &&
                        error !== null &&
                        "response" in error &&
                        typeof (error as {
                            response?: { data?: { message?: string; error?: string } };
                        }).response?.data?.message === "string"
                            ? (error as {
                                response?: { data?: { message?: string; error?: string } };
                            }).response?.data?.message
                            : typeof error === "object" &&
                              error !== null &&
                              "response" in error &&
                              typeof (error as {
                                  response?: { data?: { message?: string; error?: string } };
                              }).response?.data?.error === "string"
                                ? (error as {
                                    response?: { data?: { message?: string; error?: string } };
                                }).response?.data?.error
                                : t("statusChangeErrorDescription");

                    api.error({
                        message: t("statusChangeErrorTitle"),
                        description: errorMessage,
                        placement: "topRight",
                        duration: 5,
                    });
                },
                onSettled: () => {
                    // So'rov tugagach (success yoki error) loading o'chiriladi
                    setLoadingIds(prev => {
                        const next = new Set(prev);
                        next.delete(user.id);
                        return next;
                    });
                },
            }
        );
    };

    // console.log('=== BACKEND DATA ===');
    // console.log('Full Response:', data);
    // console.log('Users:', data?.data?.items);
    // console.log('Meta:', data?.data?.meta);
    // console.log('===================');

    const columns: ColumnConfig<User>[] = [
        {
            key: 'name',
            label: t('firstName'),
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
            label: t('phone'),
            width: '25%',
            sortable: true,
            className: 'text-gray-600 dark:text-gray-400 text-sm font-mono',
        },
        {
            key: 'role',
            label: t('role'),
            width: '15%',
            sortable: true,
            render: (value) => <UserRoleBadge role={value as any} />,
        },
        {
            key: 'status',
            label: t('status'),
            width: '15%',
            render: (value) => <UserStatusBadge status={value as any} />,
        },
        {
            key: 'id',
            label: t('action'),
            width: '15%',
            render: (_, user) => {
                const isActive = user.status === 'active';
                const isPending = loadingIds.has(user.id);

                return (
                    <div className="flex items-center w-[45%] justify-center gap-1" onClick={(e) => e.stopPropagation()}>

                        {/* ── Switch Toggle ── */}
                        <button
                            onClick={(e) => handleStatusToggle(user, e)}
                            disabled={isPending}
                            title={isActive ? t("deactivate") : t("activate")}
                            role="switch"
                            aria-checked={isActive}
                            className={`
                                relative w-11 h-6 rounded-full
                                transition-all duration-300 ease-in-out
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                                ${isPending
                                    ? 'cursor-not-allowed opacity-70 bg-slate-300 dark:bg-white/20 focus-visible:ring-slate-400'
                                    : isActive
                                        ? 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-500 shadow-md shadow-emerald-500/30'
                                        : 'bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/30 focus-visible:ring-slate-400'
                                }
                            `}
                        >
                            {/* Thumb */}
                            <span
                                className={`
                                    absolute top-0.5 left-0.5
                                    w-5 h-5 rounded-full bg-white shadow-sm
                                    flex items-center justify-center
                                    transition-all duration-300 ease-in-out
                                    ${isActive && !isPending ? 'translate-x-5' : 'translate-x-0'}
                                `}
                            >
                                {isPending ? (
                                    /* Spinner: aylanuvchi yoy */
                                    <span
                                        className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-main animate-spin block"
                                    />
                                ) : isActive ? (
                                    /* Check mark */
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    /* X mark */
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                        <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                )}
                            </span>
                        </button>

                        {/* ── Delete Button ── */}
                        <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                );
            },
        },
    ];


    // Loading state
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-maindark rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center space-y-3">
                        <span className="relative flex h-12 w-12 mx-auto">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-main opacity-30" />
                            <span className="relative inline-flex rounded-full h-12 w-12 bg-main/20 items-center justify-center">
                                <span className="w-5 h-5 rounded-full bg-main animate-pulse" />
                            </span>
                        </span>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t("loading")}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (isError) {
        return (
            <div className="bg-white dark:bg-maindark rounded-xl border border-red-200 dark:border-red-900/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t("loadError")}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {t("loadDataError")}
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
            <div className="bg-white dark:bg-maindark rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📭</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t("usersNotFound")}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {t("noUsersAvailable")}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-maindark rounded-xl border border-gray-200 dark:border-primarydark/20 overflow-hidden shadow-sm">
            <Table
                data={users}
                columns={columns}
                keyExtractor={(user) => user.id}
                hoverable
                onRowClick={(user) => navigate(`/all-users/${user.id}`)}
            />

            {/* Pagination */}
            <div
                className="flex flex-col gap-3 border-t border-gray-200 dark:border-primarydark/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 bg-primary dark:bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)]"
            >
                <span className="text-center text-sm text-maindark dark:text-white sm:text-left">
                    {pagination ? (
                        t("paginationSummary", {
                            from: (pagination.page - 1) * pagination.limit + 1,
                            to: Math.min(pagination.page * pagination.limit, pagination.total),
                            total: pagination.total,
                        })
                    ) : (
                        t("totalUsersCount", { count: users.length })
                    )}
                </span>
                <Pagination
                    totalItems={pagination?.total || users.length}
                    itemsPerPage={pagination?.limit || users.length || 1}
                    currentPage={pagination?.page || currentPage}
                    onPageChange={onPageChange}
                    className="w-full pt-0 sm:w-auto"
                    summary={null}
                />
            </div>
        </div>
    );
});

UserListTable.displayName = 'UserListTable';
