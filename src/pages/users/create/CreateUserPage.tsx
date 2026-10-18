// dizayn-v2: superadmin-users-create, admin-users-create, manager-users-create-courier, manager-users-create-hybrid
import { memo } from "react";
import { CreateUserForm } from "../../../features/user/create-user/ui/CreateUserForm";

/**
 * `/all-users/create-user` — yangi foydalanuvchi (dizayn v2). Sarlavha, rol kartasi va forma —
 * `CreateUserForm` da (rolga va menejer filiali turiga bog'liq matnlar o'sha yerda hisoblanadi).
 */
const CreateUserPage = memo(() => <CreateUserForm />);

CreateUserPage.displayName = "CreateUserPage";

export default CreateUserPage;
