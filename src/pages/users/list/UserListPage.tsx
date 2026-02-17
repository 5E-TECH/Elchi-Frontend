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

  // Redux dan filter qiymatlarini olish
  const filters = useSelector((state: RootState) => state.filter);
  const searchFilters = useSelector((state: RootState) => state.search);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // URL params dan barcha qiymatlarni olish
  const urlParams = getAllParams();

  // API params yaratish (URL params va Redux dan)
  const apiParams = useMemo(() => {
    const params: any = {
      page,
      limit,
    };

    // Role (URL params yoki Redux)
    const role = urlParams.userRole || filters.userRole;
    if (role) params.role = role;

    // Status (URL params yoki Redux)
    const status = urlParams.userStatus || filters.userStatus;
    if (status) params.status = status;

    // Search (URL params yoki Redux)
    const search = urlParams.userSearch || searchFilters.userSearch;
    if (search) params.search = search;

    return params;
  }, [page, limit, urlParams, filters, searchFilters]);

  // Backend dan userlarni olish
  const { getUser } = useUser();
  const { data, isLoading, isError, error } = getUser(apiParams);

  // Filter qiymatlari o'zgarganda sahifani 1 ga qaytarish
  useEffect(() => {
    setPage(1);
  }, [filters.userRole, filters.userStatus, searchFilters.userSearch]);

  // Console log (debug uchun)
  useEffect(() => {
    console.log("=== USER LIST PAGE - API PARAMS ===");
    console.log("API Params:", apiParams);
    console.log("URL Params:", urlParams);
    console.log("===================================");
  }, [apiParams, urlParams]);

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      {/* Header */}
      <div className="flex justify-between">
        <HeaderName name="Foydalanuvchilar" description="Foydalanuvchilarni boshqarish " icon={<Users />} />
        <div className="flex items-center">
          <Button label="Qo'shish" icon={<UserPlus />} onClick={() => navigate("create-user")} />
        </div>
      </div>

      <UserStats />

      <UserFilters />

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
