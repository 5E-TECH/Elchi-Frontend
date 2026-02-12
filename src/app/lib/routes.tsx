import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";

const Login = lazy(() => import("../../features/auth"));
const DashboardLayout = lazy(() => import("../../widgets/layout/dashboardLayout"))
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"))
const UserListPage = lazy(() => import("../../pages/users/list/UserListPage"))
const CreateUserPage = lazy(() => import("../../pages/users/create/CreateUserPage"))


const AppRouter = () => {
  return useRoutes([{ path: "/", element: <Login /> },
  {
    path: "/dashboard", element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardPage /> }
    ]
  },
  {
    path: "/all-users",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <UserListPage /> },
      { path: "create-user", element: <CreateUserPage /> },
    ],
  },
  ]);
};

export default memo(AppRouter)