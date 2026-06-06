import { lazy, memo } from "react";
import { Navigate, useParams, useRoutes } from "react-router-dom";
import { useSelector } from "react-redux";
import ProtectedRoute from "../../features/auth/ui/ProtectedRoute";
import type { RootState } from "../config/store";
import { useResetInputsOnPathChange } from "../../shared/lib/useResetInputsOnPathChange";
import { getUserBranchType } from "../../widgets/Sidebar/model/menuConfig";

// ✅ Auth component (Protected route):
const Auth = lazy(() => import("../../features/auth/page"));
const Orders = lazy(() => import("../../pages/orders"));
const OrderCreate = lazy(() => import("../../pages/orders/create"));
const Profile = lazy(() => import("../../pages/profile/ui/ProfilePage"));
const SettlementPage = lazy(() => import("../../pages/settlement"));
const FinanceOperatorsPage = lazy(() => import("../../pages/finance-operators"));
const IntegrationsOpsPage = lazy(() => import("../../pages/integrations-ops"));
const InvestorsOpsPage = lazy(() => import("../../pages/investors-ops"));
const LogisticsOpsPage = lazy(() => import("../../pages/logistics-ops"));
const BranchOpsPage = lazy(() => import("../../pages/branch-ops"));
const IdentityOpsPage = lazy(() => import("../../pages/identity-ops"));
const SystemOpsPage = lazy(() => import("../../pages/system-ops"));

// ✅ Login page:
const Login = lazy(() => import("../../features/auth"));

const DashboardLayout = lazy(
  () => import("../../widgets/layout/dashboardLayout"),
);
const ScanLayout = lazy(() => import("../../widgets/layout/scanLayout"));
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"));
const BranchDashboardPage = lazy(() => import("../../pages/branch-dashboard"));
const DispatchPage = lazy(() => import("../../pages/dispatch"));
const BatchesPage = lazy(() => import("../../pages/batches"));
const BatchDetailPage = lazy(() => import("../../pages/batches/detail"));
const ReturnsPage = lazy(() => import("../../pages/returns"));
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
const NewOrdersBranches = lazy(() => import("../../pages/new_orders/branches"));
const NewOrdersBranchBatches = lazy(() => import("../../pages/new_orders/branches/batches"));
const NewOrdersBranchBatchDetail = lazy(() => import("../../pages/new_orders/branches/batchDetail"));
const NewOrdersExternalList = lazy(() => import("../../pages/new_orders/external_orders"));
const ExternalIntegrationCreate = lazy(
  () => import("../../pages/new_orders/external_orders/create"),
);
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
const ScanPage = lazy(() => import("../../pages/scan"));
const ScanDetailPage = lazy(() => import("../../pages/scan/detail"));

const FinancialBalance = lazy(() => import("../../pages/financial-balance"));

const Region = lazy(() => import("../../pages/region/index"));
const RegionDistrictsPage = lazy(() => import("../../pages/region/pages/districts"));
const RegionSatoManagementPage = lazy(() => import("../../pages/region/pages/sato-management"));
const RegionLogistAssignmentPage = lazy(() => import("../../pages/region/pages/logist-assignment"));
const NotificationsPage = lazy(() => import("../../pages/notifications"));
const BranchesPage = lazy(() => import("../../pages/branches"));
const BranchDetailPage = lazy(() => import("../../pages/branches/ui/BranchDetailPage"));
const LogsPage = lazy(() => import("../../pages/logs/index"));
const ForbiddenPage = lazy(() => import("../../shared/ui/Forbidden"));
const NotFound = lazy(() => import("../../shared/ui/NotFound"));
const ServerErrorPage = lazy(() => import("../../shared/ui/ServerError"));
const ErrorBoundaryPage = lazy(() => import("../../shared/ui/ErrorBoundaryPage"));

const isPaymentsManager = (state: RootState) => {
  const role = state.role.role;
  if (role === "admin" || role === "superadmin") return true;

  if (role === "manager") {
    const branchType = getUserBranchType(state.user.user);
    return branchType === "REGIONAL" || branchType === "HYBRID";
  }

  return false;
};

const hasSelfCashboxAccess = (state: RootState) => {
  const role = state.role.role;
  return role === "courier" || role === "market" || role === "manager";
};

const canViewBranchDashboard = (state: RootState) => {
  const role = state.role.role;
  return role === "manager" || role === "operator";
};

const canViewDispatch = (state: RootState) => {
  const role = state.role.role;
  if (role === "manager") {
    const branchType = getUserBranchType(state.user.user);
    return branchType !== "PICKUP";
  }

  return role === "registrator" || role === "branch";
};

const canViewBatches = (state: RootState) => {
  const role = state.role.role;
  return role === "manager" || role === "operator" || role === "admin" || role === "superadmin" || role === "registrator";
};

const canViewReturns = (state: RootState) => {
  const role = state.role.role;
  return role === "manager" || role === "operator" || role === "admin" || role === "superadmin";
};

const canCreateOrdersByRoleAndBranchType = (state: RootState) => {
  const role = state.role.role;
  if (role !== "manager") return true;

  const branchType = getUserBranchType(state.user.user);
  return branchType !== "REGIONAL";
};

const DashboardEntry = () => {
  const role = useSelector((state: RootState) => state.role.role);

  if (role === "manager" || role === "operator") {
    return <Navigate replace to="/branch-dashboard" />;
  }

  return <DashboardPage />;
};

const LegacyBranchBatchRedirect = () => {
  const { branchId, batchId } = useParams();

  return (
    <Navigate
      replace
      to={`/new-orders/branches/${branchId ?? ""}/batches/${batchId ?? ""}`}
    />
  );
};

const AppRouter = () => {
  useResetInputsOnPathChange();

  return useRoutes([
    { path: "/login", element: <Login /> },
    { path: "/403", element: <ForbiddenPage /> },
    { path: "/404", element: <NotFound /> },
    { path: "/500", element: <ServerErrorPage /> },
    { path: "/runtime-error", element: <ErrorBoundaryPage /> },
    {
      path: "/",
      element: <Auth />,
      children: [
        {
          path: "/",
          element: <ScanLayout />,
          children: [
            {
              path: "scan",
              element: <ScanPage />,
            },
            {
              path: "scan/:token",
              element: <ScanDetailPage />,
            },
          ],
        },
        {
          path: "/",
          element: <DashboardLayout />,
          children: [
            { index: true, element: <DashboardEntry /> },
            {
              path: "branch-dashboard",
              element: (
                <ProtectedRoute canActivate={canViewBranchDashboard}>
                  <BranchDashboardPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "dispatch",
              element: (
                <ProtectedRoute canActivate={canViewDispatch}>
                  <DispatchPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "batches",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewBatches}>
                      <BatchesPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: ":id",
                  element: (
                    <ProtectedRoute canActivate={canViewBatches}>
                      <BatchDetailPage />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "returns",
              element: (
                <ProtectedRoute canActivate={canViewReturns}>
                  <ReturnsPage />
                </ProtectedRoute>
              ),
            },
            { path: "profile", element: <Profile /> },
            { path: "settlement", element: <SettlementPage /> },
            { path: "finance-operators", element: <FinanceOperatorsPage /> },
            { path: "integrations-ops", element: <IntegrationsOpsPage /> },
            { path: "investors-ops", element: <InvestorsOpsPage /> },
            { path: "logistics-ops", element: <LogisticsOpsPage /> },
            { path: "branch-ops", element: <BranchOpsPage /> },
            { path: "identity-ops", element: <IdentityOpsPage /> },
            { path: "system-ops", element: <SystemOpsPage /> },
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
                        (state.role.role !== "market" || Boolean(state.user.user?.add_order)) &&
                        canCreateOrdersByRoleAndBranchType(state)
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
                      canActivate={() => true}
                    >
                      <ProductCreate />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "new-orders",
              element: (
                <ProtectedRoute canActivate={canCreateOrdersByRoleAndBranchType}>
                  <NewOrders />
                </ProtectedRoute>
              ),
              children: [
                { index: true, element: <NewOrdersMarkets /> },
                { path: "external", element: <Navigate replace to="/new-orders/integrations" /> },
                { path: "external/:id", element: <Navigate replace to="/new-orders/integrations" /> },
                { path: "integrations", element: <NewOrdersExternalList /> },
                { path: "integrations/create", element: <ExternalIntegrationCreate /> },
                { path: "branches", element: <NewOrdersBranches /> },
                { path: "branches/:branchId", element: <NewOrdersBranchBatches /> },
                { path: "branches/:branchId/batches/:batchId", element: <NewOrdersBranchBatchDetail /> },
                { path: "branches/:branchId/:batchId", element: <LegacyBranchBatchRedirect /> },
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
                { path: "today", element: <Mails /> },
                { path: "return", element: <Mails /> },
                { path: "refused", element: <Mails /> },
                { path: "old", element: <Mails /> },
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
              children: [
                { path: "districts", element: <RegionDistrictsPage /> },
                { path: "sato-management", element: <RegionSatoManagementPage /> },
                { path: "logist-assignment", element: <RegionLogistAssignmentPage /> },
              ],
            },
            {
              path: "notifications",
              element: <NotificationsPage />,
            },
            {
              path: "notification",
              element: <Navigate replace to="/notifications" />,
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
