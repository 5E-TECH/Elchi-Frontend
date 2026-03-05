import { lazy, memo } from "react";
import { Navigate, useRoutes } from "react-router-dom";

// ✅ Auth component (Protected route):
const Auth = lazy(() => import("../../features/auth/page"));
const Orders = lazy(() => import("../../pages/orders"));
const OrderCreate = lazy(() => import("../../pages/orders/create"));

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

const NewOrders = lazy(() => import("../../pages/new_orders"));
const NewOrderDetail = lazy(
  () => import("../../pages/new_orders/components/new_orderDetail"),
);
const NewOrderUpdate = lazy(
  () => import("../../pages/new_orders/components/new_orderUpdate"),
);

const Mails = lazy(() => import("../../pages/mails"));
const MailDetail = lazy(() => import("../../pages/mails/detail"));

const Payments = lazy(() => import("../../pages/payments"));
const MainCashbox = lazy(
  () => import("../../pages/payments/components/mainCashbox"),
);
const CashDetail = lazy(() => import("../../pages/payments/components/cashDetail"))

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
              path: "orders",
              children: [
                { index: true, element: <Orders /> },
                { path: "add", element: <OrderCreate /> },
              ],
            },
            {
              path: "products",
              children: [
                { index: true, element: <ProductTable /> },
                { path: "create-product/:id", element: <ProductCreate /> },
              ],
            },
            {
              path: "new-orders",
              children: [
                { index: true, element: <NewOrders /> },
                { path: ":marketId", element: <NewOrderDetail /> },
                {
                  path: ":marketId/edit/:orderId",
                  element: <NewOrderUpdate />,
                },
                { path: "userDetail/:id", element: <UserDetailPage /> },
              ],
            },
            {
              path: "mails",
              children: [
                { index: true, element: <Mails /> },
                { path: ":postId", element: <MailDetail /> },
              ],
            },
            {
              path: "payments",
              children: [
                { index: true, element: <Payments /> },
                { path: "main-cashbox", element: <MainCashbox /> },
4                { path: "cash-detail", element: <CashDetail /> },
              ],
            },
          ],
        },
      ],
    },
    { path: "*", element: <Navigate replace to="/login" /> },
  ])
};

export default memo(AppRouter);