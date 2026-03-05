import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";

const UserListPage = memo(() => {
  const navigate = useNavigate();
  const { getAllParams } = useQueryParams();

  const filters = useSelector((state: RootState) => state.filter);
  const searchFilters = useSelector((state: RootState) => state.search);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const urlParams = getAllParams();

  const apiParams = useMemo(() => {
    const params: any = { page, limit };

    const role = urlParams.userRole || filters.userRole;
    if (role) params.role = role;

    const status = urlParams.userStatus || filters.userStatus;
    if (status) params.status = status;

    const search = urlParams.userSearch || searchFilters.userSearch;
    if (search) params.search = search;

    return params;
  }, [page, limit, urlParams, filters, searchFilters]);

  const { getUser } = useUser();
  const { data, isLoading, isError, error } = getUser(apiParams);

  useEffect(() => {
    setPage(1);
  }, [filters.userRole, filters.userStatus, searchFilters.userSearch]);

  useEffect(() => {
    console.log("=== USER LIST PAGE - API PARAMS ===");
    console.log("API Params:", apiParams);
    console.log("URL Params:", urlParams);
    console.log("===================================");
  }, [apiParams, urlParams]);

  return (
    <div className="p-4 md:p-6 rounded-2xl bg-sidebar dark:bg-maindark min-h-full">

      {/* Header — mobilda ustma-ust, desktopda yonma-yon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <HeaderName
          name="Foydalanuvchilar"
          description="Foydalanuvchilarni boshqarish"
          icon={<Users />}
        />
        {/* Button — mobilda to'liq kenglikda */}
        <Button
          label="+ Qo'shish"
          icon={<UserPlus size={18} />}
          onClick={() => navigate("create-user")}
          className="w-full sm:w-auto dark:bg-main"
        />
      </div>

      {/* Statistika kartalar */}
      <UserStats />

      {/* Filterlar — mobilda to'liq kenglikda */}
      <div className="w-full">
        <UserFilters />
      </div>

      {/* Jadval */}
      <UserListTable
        users={data?.data?.items || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        pagination={data?.data?.meta}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  );
});

export default UserListPage;
