import { memo } from "react";
// import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { UserStats } from "../../../widgets/user-list/ui/UserStats";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { UserFilters } from "../../../features/user/filter-users/ui/UserFilters";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";

const UserListPage = memo(() => {
//   const navigate = useNavigate();

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      {/* Header */}
      <div className="flex justify-between">
        <HeaderName name="Foydalanuvchilar" description="" icon={<Users />} />
        <Button label="Qo'shish" icon={<UserPlus />}/>
      </div>

      <UserStats />

      <UserFilters />

      <UserListTable />
    </div>
  );
});

export default UserListPage;
