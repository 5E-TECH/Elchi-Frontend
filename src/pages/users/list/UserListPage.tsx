import { memo, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import { useTranslation } from "react-i18next";
import { usePagination } from "../../../shared/lib/usePagination";

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
      <div className="relative z-10 mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HeaderName
          name={t("title")}
          description={t("pageDescription")}
          icon={<Users />}
        />
        {/* Button — mobilda to'liq kenglikda */}
        <Button
          label={t("addButton")}
          icon={<UserPlus size={18} />}
          onClick={() => navigate("create-user")}
          className="w-full sm:w-auto dark:bg-main"
        />
      </div>

      {/* Statistika kartalar */}
      <div className="relative z-10">
        <UserStats />
      </div>

      {/* Filterlar — mobilda to'liq kenglikda */}
      <div className="relative z-20 w-full">
        <UserFilters />
      </div>

      {/* Jadval */}
      <div className="relative z-10">
        <UserListTable
          users={data?.data?.items || []}
          isLoading={isLoading}
          isError={isError}
          error={error}
          pagination={data?.data?.meta}
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
