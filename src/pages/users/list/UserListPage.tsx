import { memo, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import Button from "../../../shared/components/button";
import type { RootState } from "../../../app/config/store";
import { useUser, type IUserFilter } from "../../../entities/user/api/userApi";
import { useTranslation } from "react-i18next";
import { usePagination } from "../../../shared/lib/usePagination";
import { setMultipleFilters } from "../../../features/Select/model/FilterSlice";
import { setMultipleSearchValues } from "../../../features/search/model/searchSlice";
import { useQueryParams } from "../../../shared/lib/useQueryParams";

const UserListPage = memo(() => {
  const { t } = useTranslation("users");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getAllParams, setMultipleParams } = useQueryParams();

  const filters = useSelector((state: RootState) => state.filter);
  const searchFilters = useSelector((state: RootState) => state.search);

  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "users",
    defaultLimit: 100,
  });
  const previousFiltersKeyRef = useRef("");
  const isUrlHydratedRef = useRef(false);
  const allParams = getAllParams();
  const roleFromUrl = allParams.role ?? allParams.userRole ?? "";
  const statusFromUrl = allParams.status ?? allParams.userStatus ?? "";
  const searchFromUrl = allParams.search ?? allParams.userSearch ?? "";

  useEffect(() => {
    if (
      (filters.userRole ?? "") === roleFromUrl &&
      (filters.userStatus ?? "") === statusFromUrl &&
      (searchFilters.userSearch ?? "") === searchFromUrl
    ) {
      isUrlHydratedRef.current = true;
      return;
    }

    isUrlHydratedRef.current = false;

    dispatch(
      setMultipleFilters({
        userRole: roleFromUrl,
        userStatus: statusFromUrl,
      }),
    );
    dispatch(
      setMultipleSearchValues({
        userSearch: searchFromUrl,
      }),
    );
  }, [
    dispatch,
    filters.userRole,
    filters.userStatus,
    searchFilters.userSearch,
    roleFromUrl,
    statusFromUrl,
    searchFromUrl,
  ]);

  useEffect(() => {
    if (!isUrlHydratedRef.current) {
      return;
    }

    const nextRole = (filters.userRole as string) ?? "";
    const nextStatus = (filters.userStatus as string) ?? "";
    const nextSearch = (searchFilters.userSearch as string) ?? "";

    if (
      roleFromUrl === nextRole &&
      statusFromUrl === nextStatus &&
      searchFromUrl === nextSearch &&
      !allParams.userRole &&
      !allParams.userStatus &&
      !allParams.userSearch
    ) {
      return;
    }

    setMultipleParams({
      role: nextRole,
      status: nextStatus,
      search: nextSearch,
      userRole: "",
      userStatus: "",
      userSearch: "",
    });
  }, [
    filters.userRole,
    filters.userStatus,
    searchFilters.userSearch,
    roleFromUrl,
    statusFromUrl,
    searchFromUrl,
    allParams.userRole,
    allParams.userStatus,
    allParams.userSearch,
    setMultipleParams,
  ]);

  const apiParams = useMemo(() => {
    const params: IUserFilter = { page, limit };

    // Backend so'rovi uchun asosiy manba: URL params
    if (roleFromUrl) params.role = roleFromUrl;
    if (statusFromUrl) params.status = statusFromUrl;
    if (searchFromUrl) params.search = searchFromUrl;

    return params;
  }, [page, limit, roleFromUrl, statusFromUrl, searchFromUrl]);

  const filtersKey = useMemo(
    () => JSON.stringify({
      role: roleFromUrl,
      status: statusFromUrl,
      search: searchFromUrl,
    }),
    [roleFromUrl, statusFromUrl, searchFromUrl],
  );

  const { useGetUser } = useUser();
  const { data, isLoading, isError, error } = useGetUser(apiParams);
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
    <div className="relative min-h-full">
      {/* Header — mobilda ustma-ust, desktopda yonma-yon */}
      <div className="relative z-10 mb-5 flex items-start justify-between gap-3 sm:items-center">
        <div className="flex min-w-0 items-start gap-3.5 py-2.5 text-maindark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg dark:bg-primary/10 dark:text-primary [&_svg]:h-5! [&_svg]:w-5! [&_svg]:text-current!">
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
        <UserFilters />
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
