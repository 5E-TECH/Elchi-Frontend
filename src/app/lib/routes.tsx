import { lazy, memo } from "react";
import { Navigate, useRoutes } from "react-router-dom";
import ProtectedRoute from "../../features/auth/ui/ProtectedRoute";
import type { RootState } from "../config/store";

// ✅ Auth component (Protected route):
const Auth = lazy(() => import("../../features/auth/page"));
const Orders = lazy(() => import("../../pages/orders"));
const OrderCreate = lazy(() => import("../../pages/orders/create"));
const Profile = lazy(() => import("../../pages/profile/ui/ProfilePage"));

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
const NewOrdersMarkets = lazy(() => import("../../pages/new_orders/markets"));
const NewOrdersExternalList = lazy(() => import("../../pages/new_orders/external_orders"));
const ExternalIntegrationDetail = lazy(
  () => import("../../pages/new_orders/external_orders/detail"),
);
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
const CashDetail = lazy(
  () => import("../../pages/payments/components/cashDetail"),
);
const MyCashboxPage = lazy(
  () => import("../../pages/payments/components/MyCashboxPage"),
);

const FinancialBalance = lazy(() => import("../../pages/financial-balance"));

const Region = lazy(() => import("../../pages/region/index"));
const NotificationsPage = lazy(() => import("../../pages/notifications"));
const BranchesPage = lazy(() => import("../../pages/branches"));
const BranchDetailPage = lazy(() => import("../../pages/branches/ui/BranchDetailPage"));
const LogsPage = lazy(() => import("../../pages/logs"));
const ForbiddenPage = lazy(() => import("../../shared/ui/Forbidden"));
const NotFound = lazy(() => import("../../shared/ui/NotFound"));
const ServerErrorPage = lazy(() => import("../../shared/ui/ServerError"));
const ErrorBoundaryPage = lazy(() => import("../../shared/ui/ErrorBoundaryPage"));

const isPaymentsManager = (state: RootState) => {
  const role = state.role.role;
  return role === "admin" || role === "superadmin";
};

const hasSelfCashboxAccess = (state: RootState) => {
  const role = state.role.role;
  return role === "courier" || role === "market";
};

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
            { path: "profile", element: <Profile /> },
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
                { path: "edit/:orderId", element: <NewOrderUpdate /> },
                {
                  path: "add",
                  element: (
                    <ProtectedRoute
                      canActivate={(state) =>
                        state.role.role !== "market" || Boolean(state.user.user?.add_order)
                      }
                    >
                      <OrderCreate />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "products",
              children: [
                { index: true, element: <ProductTable /> },
                {
                  path: "create-product/:id",
                  element: (
                    <ProtectedRoute
                      canActivate={(state) =>
                        state.role.role !== "market" || Boolean(state.user.user?.add_order)
                      }
                    >
                      <ProductCreate />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "new-orders",
              element: <NewOrders />,
              children: [
                { index: true, element: <NewOrdersMarkets /> },
                { path: "external", element: <Navigate replace to="/new-orders/integrations" /> },
                { path: "external/:id", element: <Navigate replace to="/new-orders/integrations" /> },
                { path: "integrations", element: <NewOrdersExternalList /> },
                { path: "integrations/:id", element: <ExternalIntegrationDetail /> },
                { path: ":marketId", element: <NewOrderDetail /> },
                { path: ":marketId/edit/:orderId", element: <NewOrderUpdate /> },
                { path: "userDetail/:id", element: <UserDetailPage /> },
              ],
            },
            {
              path: "mails",
              children: [
                { index: true, element: <Mails /> },
                { path: ":id", element: <MailDetail /> },
              ],
            },
            {
              path: "payments",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute
                      canActivate={isPaymentsManager}
                      redirectTo="/cash-box"
                    >
                      <Payments />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "main-cashbox",
                  element: (
                    <ProtectedRoute
                      canActivate={isPaymentsManager}
                      redirectTo="/cash-box"
                    >
                      <MainCashbox />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "cash-detail/:id",
                  element: (
                    <ProtectedRoute
                      canActivate={isPaymentsManager}
                      redirectTo="/cash-box"
                    >
                      <CashDetail />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "cash-box",
              element: (
                <ProtectedRoute
                  canActivate={hasSelfCashboxAccess}
                  redirectTo="/payments"
                >
                  <MyCashboxPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "financial-balance",
              element: <FinancialBalance />,
            },
            {
              path: "regions",
              element: <Region />,
            },
            {
              path: "notifications",
              element: <NotificationsPage />,
            },
            {
              path: "branches",
              children: [
                { index: true, element: <BranchesPage /> },
                { path: ":id", element: <BranchDetailPage /> },
              ],
            },
            {
              path: "logs",
              element: <LogsPage />,
            },
            {
              path: "403",
              element: <ForbiddenPage />,
            },
            {
              path: "404",
              element: <NotFound />,
            },
            {
              path: "500",
              element: <ServerErrorPage />,
            },
            {
              path: "runtime-error",
              element: <ErrorBoundaryPage />,
            },
            {
              path: "*",
              element: <NotFound />,
            },
          ],
        },
      ],
    },
    {
      path: "*",
      element: <Navigate replace to="/404" />,
    },
  ]);
};

export default memo(AppRouter);
