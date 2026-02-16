import { memo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import type { RootState } from "../../../app/config/store";

const UserListPage = memo(() => {
  const navigate = useNavigate();

  // Redux dan filter qiymatlarini olish
  const filters = useSelector((state: RootState) => state.filter);

  // Filter qiymatlari o'zgarganda backend ga so'rov jo'natish
  useEffect(() => {
    // Faqat filter qiymatlari mavjud bo'lsa
    if (filters.userRole || filters.userStatus || filters.userSearch) {
      console.log("=== USER LIST PAGE - BACKEND GA SO'ROV ===");
      console.log("Role:", filters.userRole || "(tanlanmagan)");
      console.log("Status:", filters.userStatus || "(tanlanmagan)");
      console.log("Search:", filters.userSearch || "(bo'sh)");
      console.log("==========================================");

      // Bu yerda backend ga so'rov jo'natish
      // Misol:
      // fetchUsers({ 
      //   role: filters.userRole, 
      //   status: filters.userStatus, 
      //   search: filters.userSearch 
      // });
    }
  }, [filters.userRole, filters.userStatus, filters.userSearch]);

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

      <UserListTable />
    </div>
  );
});

export default UserListPage;
