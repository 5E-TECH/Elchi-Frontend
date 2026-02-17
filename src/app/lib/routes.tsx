import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";

// ✅ Auth component (Protected route):
const Auth = lazy(() => import("../../features/auth/page"));

// ✅ Login page:
const Login = lazy(() => import("../../features/auth"));

const DashboardLayout = lazy(
  () => import("../../widgets/layout/dashboardLayout"),
);
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"));
const UserListPage = lazy(() => import("../../pages/users/list/UserListPage"));
const CreateUserPage = lazy(
  () => import("../../pages/users/create/CreateUserPage"),
);
const UserDetailPage = lazy(
  () => import("../../pages/users/detail/UserDetailPage"),
);

const ProductTable = lazy(() => import("../../pages/products/list"));
const ProductCreate = lazy(() => import("../../pages/products/create"));

const AppRouter = () => {
  return useRoutes([
    { path: "/login", element: <Login /> },
    {
      path: "/",
      element: <Auth />,
      children: [
        {
          path: "/",
          element: <DashboardLayout />,
          children: [
            { index: true, element: <DashboardPage /> },
            {
              path: "all-users",
              children: [
                { index: true, element: <UserListPage /> },
                { path: "create-user", element: <CreateUserPage /> },
                { path: ":id", element: <UserDetailPage /> },
              ],
            },
            {
              path: "products",
              children: [
                { index: true, element: <ProductTable /> },
                { path: "create-product", element: <ProductCreate /> },
              ],
            },
          ],
        },
      ],
    },
  ]);
};

export default memo(AppRouter);