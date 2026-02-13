import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";

const Login = lazy(() => import("../../features/auth"));
const DashboardLayout = lazy(() => import("../../widgets/layout/dashboardLayout"))
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"))
const UserListPage = lazy(() => import("../../pages/users/list/UserListPage"))
const CreateUserPage = lazy(() => import("../../pages/users/create/CreateUserPage"))

const ProductTable = lazy(() => import("../../pages/products/list"))
const ProductCreate = lazy(() => import("../../pages/products/create"))


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
  {path: "/products", element: <DashboardLayout />, children: [
    { index: true, element: <ProductTable /> },
    { path: "create-product", element: <ProductCreate /> },
  ]}
  ]);
};

export default memo(AppRouter)