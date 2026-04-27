import { memo, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import Button from "../../../shared/components/button";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import { useTranslation } from "react-i18next";
import { usePagination } from "../../../shared/lib/usePagination";
import type { User } from "../../../entities/user/types/user";

const extractRolesFromUsersResponse = (response: unknown): string[] => {
  const payload = response as {
    data?: {
      roles?: Array<string | { role?: string; value?: string; name?: string }>;
      roleCounts?: Record<string, unknown> | Array<{ role?: string; value?: string; name?: string }>;
      items?: User[];
    };
  } | undefined;

  const roles = payload?.data?.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    return roles
      .map((role) => (typeof role === "string" ? role : role.role ?? role.value ?? role.name))
      .filter((role): role is string => Boolean(role));
  }

  const roleCounts = payload?.data?.roleCounts;
  if (Array.isArray(roleCounts) && roleCounts.length > 0) {
    return roleCounts
      .map((role) => role.role ?? role.value ?? role.name)
      .filter((role): role is string => Boolean(role));
  }

  if (roleCounts && !Array.isArray(roleCounts)) {
    return Object.keys(roleCounts);
  }

  return (payload?.data?.items ?? [])
    .map((item) => item.role)
    .filter(Boolean);
};

const UserListPage = memo(() => {
  const { t } = useTranslation("users");
  const navigate = useNavigate();

  const filters = useSelector((state: RootState) => state.filter);
  const searchFilters = useSelector((state: RootState) => state.search);

  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "users",
    defaultLimit: 10,
  });
  const previousFiltersKeyRef = useRef("");

  const apiParams = useMemo(() => {
    const params: any = { page, limit };

    // Role va status uchun Redux state-dan foydalanamiz (standard pattern)
    if (filters.userRole) params.role = filters.userRole;
    if (filters.userStatus) params.status = filters.userStatus;
    if (searchFilters.userSearch) params.search = searchFilters.userSearch;

    return params;
  }, [page, limit, filters.userRole, filters.userStatus, searchFilters.userSearch]);

  const filtersKey = useMemo(
    () => JSON.stringify({
      role: filters.userRole ?? "",
      status: filters.userStatus ?? "",
      search: searchFilters.userSearch ?? "",
    }),
    [filters.userRole, filters.userStatus, searchFilters.userSearch],
  );

  const { getUser } = useUser();
  const { data, isLoading, isError, error } = getUser(apiParams);
  const { data: roleFilterData } = getUser({
    page: 1,
    limit: 100,
  });
  const availableRoles = useMemo(
    () => extractRolesFromUsersResponse(roleFilterData),
    [roleFilterData],
  );
  const meta = data?.data?.meta;

  useEffect(() => {
    if (!previousFiltersKeyRef.current) {
      previousFiltersKeyRef.current = filtersKey;
      return;
    }

    if (previousFiltersKeyRef.current === filtersKey) {
      return;
    }

    previousFiltersKeyRef.current = filtersKey;
    resetPagination(limit);
  }, [filtersKey, limit, resetPagination]);

  return (
    <div className="relative min-h-full overflow-hidden rounded-[28px] bg-sidebar p-4 md:p-6 dark:bg-maindark">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-main/12 blur-3xl dark:bg-main/18" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-400/8 blur-3xl" />

      {/* Header — mobilda ustma-ust, desktopda yonma-yon */}
      <div className="relative z-10 mb-5 flex items-start justify-between gap-3 sm:items-center">
        <div className="flex min-w-0 items-start gap-3.5 py-2.5 text-maindark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg dark:bg-primary/10 dark:text-primary [&_svg]:!h-5 [&_svg]:!w-5 [&_svg]:!text-current">
            <Users />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="m-0 truncate text-[18px] font-extrabold leading-tight text-main dark:text-primary">
              {t("title")}
            </h2>
            <p className="m-0 truncate text-[12.5px] font-semibold leading-tight text-main/70 dark:text-primary/80">
              {t("pageDescription")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => navigate("create-user")}
            aria-label={t("addUser")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-main text-white shadow-md shadow-main/25 transition-all duration-200 hover:bg-main/90 active:scale-95 sm:hidden"
          >
            <UserPlus size={18} />
          </button>

          <Button
            label={t("addButton")}
            icon={<UserPlus size={18} />}
            onClick={() => navigate("create-user")}
            className="hidden sm:flex sm:w-auto dark:bg-main"
          />
        </div>
      </div>

      {/* Statistika kartalar */}
      <div className="relative z-10">
        <UserStats
          totalUsers={meta?.totalUsers ?? meta?.total}
          totalMarkets={meta?.totalMarket}
          totalEmployees={meta?.totalEmployees}
        />
      </div>

      {/* Filterlar — mobilda to'liq kenglikda */}
      <div className="relative z-20 w-full">
        <UserFilters availableRoles={availableRoles} />
      </div>

      {/* Jadval */}
      <div className="relative z-10">
        <UserListTable
          users={data?.data?.items || []}
          isLoading={isLoading}
          isError={isError}
          error={error}
          pagination={meta}
          currentPage={page}
          currentLimit={limit}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
        />
      </div>
    </div>
  );
});

export default UserListPage;
