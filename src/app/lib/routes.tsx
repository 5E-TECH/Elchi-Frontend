import { lazy, memo, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useParams, useRoutes } from "react-router-dom";
import { useSelector } from "react-redux";
import ProtectedRoute from "../../features/auth/ui/ProtectedRoute";
import type { RootState } from "../config/store";
import {
  canViewOrders,
  canViewMails,
  canViewUsers,
  canViewFinancialBalance,
  canViewNotifications,
  canSendNotifications,
  canViewBranches,
  canViewLogs,
  canViewDispatchPage,
  canViewCourierBulkPage,
  canViewBatchesPage,
  canViewReturnsPage,
  canCreateOrders,
  canReceiveExternalOrders,
  canViewPaymentsPage,
  canHandoverCancelledToMarket,
  canCreateProducts,
  canViewProducts,
  canViewAdminDashboard,
  canViewUiKit,
  canViewMarketOperators,
  canViewInvestorCabinet,
  canViewRegionStats,
  canViewMyEarnings,
} from "./access";
import { useResetInputsOnPathChange } from "../../shared/lib/useResetInputsOnPathChange";
import { RUNTIME_ERROR_PATH } from "../../shared/lib/runtimeError";
import ErrorBoundary from "../../shared/ui/ErrorBoundary";
// MO-3: market operatori qobiqda faqat yaratadi — qaysi bola yo'l ochiq (sof funksiya, testlanadi).
import {
  MARKET_OPERATOR_CREATE_PATH,
  resolveMarketOperatorNewOrdersAccess,
} from "../../pages/new_orders/model/newOrdersShell";
// ✅ Login page: `lazy` + to'g'ridan-to'g'ri `/login` da oldindan yuklash.
import Login from "./loginPage";

// ✅ Auth component (Protected route):
const Auth = lazy(() => import("../../features/auth/page"));
const Orders = lazy(() => import("../../pages/orders"));
const OrderCreate = lazy(() => import("../../pages/orders/create"));
const Profile = lazy(() => import("../../pages/profile/ui/ProfilePage"));
const SettingsPage = lazy(() => import("../../pages/settings/ui/SettingsPage"));
const FinanceOperatorsPage = lazy(() => import("../../pages/finance-operators"));
const MarketOperatorsPage = lazy(() => import("../../pages/market-operators"));
const CourierBulkPage = lazy(() => import("../../pages/courier-bulk"));
const IntegrationsOpsPage = lazy(() => import("../../pages/integrations-ops"));
const InvestorsOpsPage = lazy(() => import("../../pages/investors-ops"));
const LogisticsOpsPage = lazy(() => import("../../pages/logistics-ops"));
const BranchOpsPage = lazy(() => import("../../pages/branch-ops"));
const IdentityOpsPage = lazy(() => import("../../pages/identity-ops"));
const SystemOpsPage = lazy(() => import("../../pages/system-ops"));
const OpsPage = lazy(() => import("../../pages/ops"));
const UiKitPage = lazy(() => import("../../pages/ui-kit"));
const ActivityLogsPage = lazy(() => import("../../pages/activity-logs"));

// Telegram skan Mini App (MWYaqprw) — kirishsiz: Telegram `initData` orqali o'z qisqa tokeni bilan ishlaydi.
const TgScanPage = lazy(() => import("../../pages/tg-scan"));

const DashboardLayout = lazy(
  () => import("../../widgets/layout/dashboardLayout"),
);
const ScanLayout = lazy(() => import("../../widgets/layout/scanLayout"));
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"));
const MarketDashboardPage = lazy(
  () => import("../../pages/dashboard/MarketDashboardPage"),
);
// IN-1: investor kabineti — alohida lazy chunk (dashboard bundle chegarasi 450 KB).
const InvestorDashboardPage = lazy(() => import("../../pages/investor/InvestorDashboardPage"));
/** MO-2: market operatorining «Daromadim» sahifasi (o'z stavkasi). */
const MyEarningsPage = lazy(() => import("../../pages/my-earnings"));
// IN-2: investor ro'yxatlari — «Investitsiyalar» va «Foyda tarixi» (o'z chunk'lari).
const InvestmentsPage = lazy(() => import("../../pages/investor/InvestmentsPage"));
const ProfitsPage = lazy(() => import("../../pages/investor/ProfitsPage"));
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
const NewOrdersCancelled = lazy(() => import("../../pages/new_orders/cancelled"));
const NewOrdersCancelledDetail = lazy(() => import("../../pages/new_orders/cancelled/detail"));
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
const IncomingOrdersPage = lazy(
  () => import("../../pages/incoming-orders"),
);
const IncomingSourcePicker = lazy(
  () => import("../../pages/incoming-orders/SourcePicker"),
);
const PartnersPage = lazy(() => import("../../pages/partners"));
const IntegrationsPage = lazy(() => import("../../pages/integrations"));
const ConnectionsPage = lazy(
  () => import("../../pages/integrations/ConnectionsPage"),
);
const IntegrationsCatalogPage = lazy(
  () => import("../../pages/integrations/CatalogPage"),
);
const ConnectWizardPage = lazy(
  () => import("../../pages/integrations/wizard/ConnectWizard"),
);
const ScanDetailPage = lazy(() => import("../../pages/scan/detail"));

const FinancialBalance = lazy(() => import("../../pages/financial-balance"));

const Region = lazy(() => import("../../pages/region/index"));
const RegionDistrictsPage = lazy(() => import("../../pages/region/pages/districts"));
const RegionSatoManagementPage = lazy(() => import("../../pages/region/pages/sato-management"));
const RegionLogistAssignmentPage = lazy(() => import("../../pages/region/pages/logist-assignment"));
const NotificationsPage = lazy(() => import("../../pages/notifications"));
const NotificationSendPage = lazy(() => import("../../pages/notification-send"));
// NS-2: «Yuborilganlar» — qo'lda yuborilgan xabarlar tarixi (menyusiz, «Xabar yuborish» sarlavhasidan).
const NotificationSentPage = lazy(() => import("../../pages/notification-sent"));
const SmsPage = lazy(() => import("../../pages/notifications/ui/SmsPage"));
const NotificationInboxPage = lazy(
  () => import("../../pages/notifications/ui/NotificationInboxPage"),
);
const BranchesPage = lazy(() => import("../../pages/branches"));
const BranchDetailPage = lazy(() => import("../../pages/branches/ui/BranchDetailPage"));
const LogsPage = lazy(() => import("../../pages/logs/index"));
const ForbiddenPage = lazy(() => import("../../shared/ui/Forbidden"));
const NotFound = lazy(() => import("../../shared/ui/NotFound"));
const ServerErrorPage = lazy(() => import("../../shared/ui/ServerError"));
const ErrorBoundaryPage = lazy(() => import("../../shared/ui/ErrorBoundaryPage"));

/**
 * XATO SAHIFALARI (403 · 404 · 500 · ilova xatosi) — taxta `tizim-errors` 01: «Xato sahifasi menyu ichida
 * ochiladi — foydalanuvchi boshqa bo'limga bemalol o'tadi».
 *
 *  - Kirgan foydalanuvchi — shell ICHIDA: `DashboardLayout` ning bolalari (`403`, `404`, `500`, `runtime-error`,
 *    noma'lum yo'l `*`). Yon menyu va yuqori panel joyida qoladi, `ProtectedRoute` → `/403` shell'ni qayta qurmaydi.
 *  - Kirmagan foydalanuvchi — shell'siz, butun ekran (`standalone`): `AppRouter` uni route'lardan oldin shu
 *    jadvaldan chizadi (aks holda `Auth` kirish sahifasiga otib yuborardi).
 *  - Shell yiqilsa (yoki xato sahifasining o'zi) — `AppRouter` dagi `ErrorBoundary` zaxirasi: shu jadvaldagi
 *    shell'siz nusxa (bo'sh ekran emas).
 */
const STANDALONE_ERROR_PAGES = new Map<string, ReactNode>([
  ["/403", <ForbiddenPage standalone />],
  ["/404", <NotFound standalone />],
  ["/500", <ServerErrorPage standalone />],
  [RUNTIME_ERROR_PATH, <ErrorBoundaryPage standalone />],
]);

/** Yo'l → shell'siz xato sahifasi. Route'lardagidek katta-kichik harf va oxiridagi `/` farq qilmaydi. */
const standaloneErrorPageFor = (pathname: string) =>
  STANDALONE_ERROR_PAGES.get(pathname.replace(/\/+$/, "").toLowerCase());

/**
 * Marshrut guardlari.
 *
 * ⚠️ Ular endi SIDEBAR'dan hosil bo'lmaydi. Avvalgi `canViewSidebarPath` naqshi
 * menyuni ruxsat manbaiga aylantirgan edi — bandni ko'chirish yoki guruhlash
 * sahifani jimgina yopib qo'yardi. Aniq shartlar `app/lib/access.ts` da.
 */
const isPaymentsManager = canViewPaymentsPage;

const hasSelfCashboxAccess = (state: RootState) => {
  const role = state.role.role;
  return role === "courier" || role === "market" || role === "manager";
};

const canViewBranchDashboard = (state: RootState) =>
  state.role.role === "manager";

// Registrator qoidasi (filial turi aniq bo'lsa, HQ ham) `access.ts` da —
// menyu bilan bitta manba (`registratorCanDispatch`).
const canViewDispatch = canViewDispatchPage;

const canViewBatches = canViewBatchesPage;
const canViewReturns = canViewReturnsPage;

// Internal ops/maintenance screens (settlement, *-ops). Backend RBAC already
// 403s their write endpoints, but these dev forms must not be reachable by URL
// for non-admins. Admin/superadmin only. (Audit I17.)
const canViewOps = (state: RootState) => {
  const role = state.role.role;
  return role === "admin" || role === "superadmin";
};

const canManageUsers = canViewUsers;
const canCreateOrdersByRoleAndBranchType = canCreateOrders;
const canManageExternalIntegrations = canReceiveExternalOrders;

const canViewAdminNewOrderTabs = (state: RootState) => {
  const role = state.role.role;
  return role === "admin" || role === "superadmin";
};

const canViewOpsPages = (state: RootState) => state.role.role === "superadmin";
const canViewCourierBulk = canViewCourierBulkPage;


/** LG-1: logist bosh sahifasi (`DashboardEntry` → logist tarmog'i). */
const LogistDashboardPage = lazy(() => import("../../pages/dashboard/LogistDashboardPage"));

/**
 * Bosh sahifa (`/`) — rolga qarab. Admin `DashboardPage` faqat `canViewAdminDashboard` rollarida: o'z bosh sahifasi
 * yo'q har rol (menyusiz eski rollar) 403 ko'radi — `ForbiddenPage` shell ichida, yangi UI yo'q (taxta `tizim-errors`).
 * Yangi rollar — o'z tarmog'ida (LG-1 logist, MO-2 market operatori, IN-1 investor).
 */
const DashboardEntry = () => {
  const role = useSelector((state: RootState) => state.role.role);
  const canViewAdmin = useSelector(canViewAdminDashboard);

  if (role === "manager") {
    return <Navigate replace to="/branch-dashboard" />;
  }

  if (role === "market") {
    return <MarketDashboardPage />;
  }

  // Yangi rollarning o'z bosh sahifasi kelguncha — 403 (admin bosh sahifasi kompaniya tushumini ko'rsatadi).
  // Har rol o'z tarmog'ida: LG-1 / MO-2 / IN-1 faqat o'z qatorini almashtiradi.
  // LG-1: logist — o'z viloyatlari, pulsiz (ega LG-S1).
  if (role === "logist") {
    return <LogistDashboardPage />;
  }

  // MO-2: market operatori — market bosh sahifasi operator rejimida (xarajat tasdiqlarisiz, o'z marketi doirasida).
  if (role === "market_operator") {
    return <MarketDashboardPage variant="operator" />;
  }

  // IN-1: investor kabineti (`canViewInvestorCabinet`) — KPI, oylik foyda, investitsiyalar va foyda tarixi.
  if (role === "investor") {
    return (
      <ProtectedRoute canActivate={canViewInvestorCabinet}>
        <InvestorDashboardPage />
      </ProtectedRoute>
    );
  }

  if (canViewAdmin) {
    return <DashboardPage />;
  }

  return <ForbiddenPage />;
};

/**
 * Buyurtma yaratish "Qabul va yaratish" sahifasiga ko'chdi. Eski `/orders/add`
 * havolasi (xatcho'p, eski tugma) yangi joyga o'tadi — tanlangan market
 * (`location.state.selectedMarket`) yo'qolmaydi.
 */
export const LegacyOrderCreateRedirect = () => {
  const location = useLocation();

  return <Navigate replace to="/new-orders/create" state={location.state} />;
};

/**
 * Bildirishnoma havolasi `/orders/:id` (backend `link`; toast «Ochish», qo'ng'iroqcha, Inbox, push) — buyurtma
 * tafsiloti `/orders/edit/:id` da. Yo'naltirishsiz «Ochish» 404 berardi (uRkw6lk0).
 */
const LegacyOrderDetailRedirect = () => {
  const { orderId } = useParams();

  return <Navigate replace to={`/orders/edit/${orderId ?? ""}`} />;
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

/**
 * Eski integratsiya detal havolasi — `id` saqlanib Integratsiyalar uyiga
 * o'tadi. Oddiy `Navigate` yaramaydi, chunki `:id` ni URL'dan olish kerak.
 */
const LegacyIntegrationDetailRedirect = () => {
  const { id } = useParams();

  return <Navigate replace to={`/integrations/sources/${id ?? ""}`} />;
};

const NewOrdersCancelledDetailEntry = () => {
  const { marketId } = useParams();
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const profileId = useSelector((state: RootState) => state.user.user?.id);
  // fix3 CODE-16 / C4: superadmin/admin va HQ registratori topshiradi.
  const canHandover = useSelector(canHandoverCancelledToMarket);
  const ownMarketId = roleId ?? profileId;
  const isOwnMarket =
    role === "market" &&
    Boolean(ownMarketId) &&
    String(ownMarketId) === String(marketId);

  if (!canHandover && !isOwnMarket) {
    return <Navigate replace to="/403" />;
  }

  return <NewOrdersCancelledDetail />;
};

/**
 * MO-3: «Qabul va yaratish» qobig'i market operatorida — faqat `/new-orders/create` («AI bilan» yaratish).
 * `/new-orders` (menyu bandi) → yaratishga, qolgan bolalar (market ro'yxati, bekorlar, qabul, paketlar,
 * foydalanuvchi tafsiloti) → 403: ularning backend yo'llari operatorga yopiq. Boshqa rollar — o'zgarishsiz.
 */
const NewOrdersRoleGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  if (role !== "market_operator") return <>{children}</>;

  const access = resolveMarketOperatorNewOrdersAccess(pathname);
  if (access === "redirect") return <Navigate replace to={MARKET_OPERATOR_CREATE_PATH} />;
  if (access === "forbidden") return <Navigate replace to="/403" />;
  return <>{children}</>;
};

const NewOrdersMarketAccessEntry = ({ children }: { children: ReactNode }) => {
  const { marketId } = useParams();
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const profileId = useSelector((state: RootState) => state.user.user?.id);
  const ownMarketId = roleId ?? profileId;
  const isOwnMarket =
    role === "market" &&
    Boolean(ownMarketId) &&
    String(ownMarketId) === String(marketId);

  if (role === "market" && !isOwnMarket) {
    return <Navigate replace to="/403" />;
  }

  return <>{children}</>;
};

const AppRouter = () => {
  useResetInputsOnPathChange();
  const { pathname } = useLocation();
  const isSignedIn = useSelector((state: RootState) => state.user.isAuthenticated);
  const standaloneErrorPage = standaloneErrorPageFor(pathname);

  const routes = useRoutes([
    { path: "/login", element: <Login /> },
    { path: "/tg/scan", element: <TgScanPage /> },
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
              /**
               * INTEGRATSIYALAR UYI — barcha tashqi ulanishlar bir joyda.
               *
               * Ilgari integratsiya IKKI joyda boshqarilardi va ikkalasi ham
               * "Integratsiyalar" deb nomlanardi: `/partners` (bizga
               * ulanadiganlar) va `/new-orders/integrations` (biz
               * ulanadiganlar). Ikkinchisi kunlik buyurtma ekranining ICHIDA
               * turardi — ya'ni integratsiya qo'shish/o'chirish buyurtma
               * sahifasida edi.
               *
               * Ruxsat har bir TAB marshrutida tekshiriladi, uyda emas: bir
               * tabga ruxsati yo'q foydalanuvchi boshqasini ko'rishi kerak.
               */
              path: "integrations",
              element: <IntegrationsPage />,
              children: [
                {
                  /**
                   * YANGI YAGONA YUZA — ulanish tanlagichi + panel.
                   *
                   * Ilgari bu yer ikki tabga bo'lingan edi ("Hamkorlar (API)"
                   * va "Tashqi tizimlar") va har birida o'z formasi bor edi.
                   * Foydalanuvchi uchun ikkisi bitta ish, shuning uchun
                   * birlashtirildi.
                   */
                  /**
                   * MANZARA — bo'limning kirish nuqtasi. "Hammasi qalay?"
                   * degan savolga javob beradi: jami raqamlar + jadval.
                   *
                   * Ilgari bo'lim to'g'ridan-to'g'ri bitta ulanish paneliga
                   * olib borardi va umumiy manzara YO'Q edi — operator har
                   * bir ulanishni navbatma-navbat ochib tekshirardi.
                   */
                  index: true,
                  element: (
                    <Navigate replace to="/integrations/connections?scope=partner" />
                  ),
                },
                {
                  /**
                   * KONSOL — bitta ulanish bilan ishlash. Chapda ro'yxat
                   * bo'lgani uchun manzaraga qaytmasdan sakrash mumkin.
                   */
                  path: "connections",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <ConnectionsPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  /**
                   * KATALOG — "qanday tizim ulaymiz?".
                   *
                   * Ilgari "Yangi ulanish" bitta forma ochardi va operator
                   * o'zi hal qilishi kerak edi: bu hamkormi yoki tashqi
                   * tizimmi, kalit bizdanmi yoki ulardanmi. Bu TEXNIK savol
                   * va ulanish noto'g'ri jadvalga tushardi.
                   */
                  path: "new",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <IntegrationsCatalogPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  /**
                   * ULASH USTASI — Nomi → Kalitlar → Sinash → Tayyor.
                   *
                   * `:typeKey` registr kaliti (`CONNECTION_TYPES`). Noto'g'ri
                   * kalit bo'lsa usta katalogga qaytaradi — 404 emas, chunki
                   * havola eskirgan bo'lishi mumkin.
                   */
                  path: "new/:typeKey",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <ConnectWizardPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  /**
                   * ESKI sahifalar SAQLANADI — yangisi to'liq ishlagani
                   * tasdiqlanmaguncha ular zaxira bo'lib turadi. Operator
                   * biror narsani yangi yuzadan qilolmasa, eski manzil
                   * orqali ishlay oladi.
                   */
                  path: "partners",
                  element: <PartnersPage />,
                },
                {
                  path: "sources",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <NewOrdersExternalList />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "sources/create",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <ExternalIntegrationCreate />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "sources/:id",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <ExternalIntegrationDetail />
                    </ProtectedRoute>
                  ),
                },
                {
                  /**
                   * KO'CHIRILDI -> `/new-orders/incoming`.
                   *
                   * Kiruvchi posilkalarni skanerlab qabul qilish — KUNLIK
                   * OPERATSIYA, sozlama emas. Integratsiyalar sahifasi faqat
                   * ulanishlarni sozlash uchun qolishi kerak.
                   *
                   * Marshrut redirect bo'lib saqlanadi: xatcho'p va tashqi
                   * havolalar buzilmasin.
                   */
                  path: "incoming",
                  element: <Navigate replace to="/new-orders/incoming" />,
                },
              ],
            },
            {
              // ESKI YO'L — saqlanadi. Tashqi hujjatlarda, xatcho'plarda va
              // Telegram xabarlarida bo'lishi mumkin.
              path: "partners",
              element: <Navigate replace to="/integrations/partners" />,
            },
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
            { path: "settings", element: <SettingsPage /> },
            {
              /**
               * Ops vositalari markazi — yettita `*-ops` sahifasi bitta uyda.
               * Eski to'g'ridan-to'g'ri marshrutlar SAQLANADI (havolalar
               * buzilmasin), bu esa menyudan ochiladigan kirish nuqtasi.
               */
              path: "ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <OpsPage />
                </ProtectedRoute>
              ),
            },
            {
              /**
               * Dizayn v2 komponentlar to'plami — primitivlar namunasi (kunduzgi +
               * tungi yonma-yon). Faqat superadmin, menyuda yo'q.
               * `?section=<id>` — bitta bo'lim, `?theme-pair=0` — faqat joriy mavzu.
               */
              path: "ops/ui-kit",
              element: (
                <ProtectedRoute canActivate={canViewUiKit}>
                  <UiKitPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "finance-operators",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <FinanceOperatorsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "integrations-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <IntegrationsOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "investors-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <InvestorsOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "logistics-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <LogisticsOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "branch-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <BranchOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "identity-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <IdentityOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "system-ops",
              element: (
                <ProtectedRoute canActivate={canViewOpsPages}>
                  <SystemOpsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "activity-logs",
              element: (
                <ProtectedRoute canActivate={canViewOps}>
                  <ActivityLogsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "all-users",
              element: (
                <ProtectedRoute canActivate={canManageUsers}>
                  <Outlet />
                </ProtectedRoute>
              ),
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewUsers}>
                      <UserListPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "create-user",
                  element: (
                    <ProtectedRoute canActivate={canViewUsers}>
                      <CreateUserPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: ":id",
                  element: (
                    <ProtectedRoute canActivate={canViewUsers}>
                      <UserDetailPage />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "orders",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewOrders}>
                      <Orders />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "edit/:orderId",
                  element: (
                    <ProtectedRoute canActivate={canViewOrders}>
                      <NewOrderUpdate />
                    </ProtectedRoute>
                  ),
                },
                { path: "add", element: <LegacyOrderCreateRedirect /> },
                {
                  path: ":orderId",
                  element: (
                    <ProtectedRoute canActivate={canViewOrders}>
                      <LegacyOrderDetailRedirect />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "products",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewProducts}>
                      <ProductTable />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "create-product/:id",
                  element: (
                    <ProtectedRoute canActivate={canCreateProducts}>
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
                  <NewOrdersRoleGate>
                    <NewOrders />
                  </NewOrdersRoleGate>
                </ProtectedRoute>
              ),
              children: [
                { index: true, element: <NewOrdersMarkets /> },
                // Buyurtma YARATISH shu sahifada (ilgari `/orders/add` edi).
                { path: "create", element: <OrderCreate /> },
                /**
                 * ESKI YO'LLAR — barchasi Integratsiyalar uyiga yo'naltiriladi.
                 *
                 * Integratsiya QO'SHISH/O'CHIRISH kunlik buyurtma ekranining
                 * ichida turishi mantiqan xato edi: bu sozlama ishi, kunlik
                 * operatsiya emas. Sahifalarning O'ZI o'chirilmadi — faqat
                 * uyga ko'chdi, shuning uchun bu yerda redirect qoladi
                 * (xatcho'p, tashqi hujjat, Telegram havolasi buzilmasin).
                 */
                { path: "external", element: <Navigate replace to="/integrations/sources" /> },
                { path: "external/:id", element: <Navigate replace to="/integrations/sources" /> },
                { path: "integrations", element: <Navigate replace to="/integrations/sources" /> },
                {
                  // Eski yo'l — endi ayni sahifaning yangi joyiga.
                  path: "integrations/incoming",
                  element: <Navigate replace to="/new-orders/incoming" />,
                },
                {
                  /**
                   * Hamkordan (BeePost, marketplace) kelgan posilkalarni
                   * skanerlab QABUL QILISH — kunlik operatsiya, shuning uchun
                   * buyurtma yuzasida turadi, integratsiya sozlamalarida emas.
                   */
                  /**
                   * MANBA TANLASH — ekranning kirish nuqtasi.
                   *
                   * Ilgari bu yo'l to'g'ridan-to'g'ri skanerlash ro'yxatini
                   * ochardi va unda BARCHA tashqi buyurtma aralash turardi.
                   * Operator qo'lida bir manbaning qopi turib, ro'yxatda
                   * boshqasining posilkasini ham ko'rardi.
                   */
                  path: "incoming",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <IncomingSourcePicker />
                    </ProtectedRoute>
                  ),
                },
                {
                  /**
                   * Tanlangan manbaning posilkalarini skanerlab qabul qilish.
                   * `:marketId` — manba kaliti (hamkor posilka yaratganda
                   * `elchi_market_id` majburiy, shu bois guruhlash kaliti shu).
                   */
                  path: "incoming/:marketId",
                  element: (
                    <ProtectedRoute canActivate={canManageExternalIntegrations}>
                      <IncomingOrdersPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "integrations/create",
                  element: <Navigate replace to="/integrations/sources/create" />,
                },
                {
                  path: "branches",
                  element: (
                    <ProtectedRoute canActivate={canViewAdminNewOrderTabs}>
                      <NewOrdersBranches />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "branches/:branchId",
                  element: (
                    <ProtectedRoute canActivate={canViewAdminNewOrderTabs}>
                      <NewOrdersBranchBatches />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "branches/:branchId/batches/:batchId",
                  element: (
                    <ProtectedRoute canActivate={canViewAdminNewOrderTabs}>
                      <NewOrdersBranchBatchDetail />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "branches/:branchId/:batchId",
                  element: (
                    <ProtectedRoute canActivate={canViewAdminNewOrderTabs}>
                      <LegacyBranchBatchRedirect />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "cancelled",
                  element: (
                    <ProtectedRoute canActivate={canHandoverCancelledToMarket}>
                      <NewOrdersCancelled />
                    </ProtectedRoute>
                  ),
                },
                { path: "cancelled/:marketId", element: <NewOrdersCancelledDetailEntry /> },
                {
                  // Eski detal havolasi — id saqlanib uyga o'tadi.
                  path: "integrations/:id",
                  element: <LegacyIntegrationDetailRedirect />,
                },
                {
                  path: ":marketId",
                  element: (
                    <NewOrdersMarketAccessEntry>
                      <NewOrderDetail />
                    </NewOrdersMarketAccessEntry>
                  ),
                },
                {
                  path: ":marketId/edit/:orderId",
                  element: (
                    <NewOrdersMarketAccessEntry>
                      <NewOrderUpdate />
                    </NewOrdersMarketAccessEntry>
                  ),
                },
                { path: "userDetail/:id", element: <UserDetailPage /> },
              ],
            },
            {
              path: "mails",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <Mails />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "today",
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <Mails />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "return",
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <Mails />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "refused",
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <Mails />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: "old",
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <Mails />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: ":id",
                  element: (
                    <ProtectedRoute canActivate={canViewMails}>
                      <MailDetail />
                    </ProtectedRoute>
                  ),
                },
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
              // MO-2: market operatorining «Daromadim» (o'z stavkasi; hisob/to'lovlar — backend E6iEOAVs, MO-6).
              path: "my-earnings",
              element: (
                <ProtectedRoute canActivate={canViewMyEarnings}>
                  <MyEarningsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "market-operators",
              element: (
                <ProtectedRoute canActivate={canViewMarketOperators}>
                  <MarketOperatorsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "courier-bulk",
              element: (
                <ProtectedRoute canActivate={canViewCourierBulk}>
                  <CourierBulkPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "financial-balance",
              element: (
                <ProtectedRoute canActivate={canViewFinancialBalance}>
                  <FinancialBalance />
                </ProtectedRoute>
              ),
            },
            // IN-2: investor kabineti ro'yxatlari — faqat investor (`canViewInvestorCabinet`; backend `@Roles(INVESTOR)`).
            {
              path: "investments",
              element: (
                <ProtectedRoute canActivate={canViewInvestorCabinet}>
                  <InvestmentsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "profits",
              element: (
                <ProtectedRoute canActivate={canViewInvestorCabinet}>
                  <ProfitsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "regions",
              element: (
                <ProtectedRoute canActivate={canViewRegionStats}>
                  <Region />
                </ProtectedRoute>
              ),
              children: [
                { path: "districts", element: <RegionDistrictsPage /> },
                { path: "sato-management", element: <RegionSatoManagementPage /> },
                { path: "logist-assignment", element: <RegionLogistAssignmentPage /> },
              ],
            },
            {
              path: "notifications",
              element: (
                <ProtectedRoute canActivate={canViewNotifications}>
                  <NotificationsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "notifications/send",
              element: (
                <ProtectedRoute canActivate={canSendNotifications}>
                  <NotificationSendPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "notifications/sent",
              element: (
                <ProtectedRoute canActivate={canSendNotifications}>
                  <NotificationSentPage />
                </ProtectedRoute>
              ),
            },
            {
              // SMS: kampaniya, shablonlar, xarajat, provayder (superadmin/admin).
              path: "notifications/sms",
              element: (
                <ProtectedRoute canActivate={canSendNotifications}>
                  <SmsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: "notification",
              element: <Navigate replace to="/notifications" />,
            },
            {
              // Per-user notification inbox (header bell target). Available to
              // every authenticated user — the dashboard layout already gates auth.
              path: "inbox",
              element: <NotificationInboxPage />,
            },
            {
              path: "branches",
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute canActivate={canViewBranches}>
                      <BranchesPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: ":id",
                  element: (
                    <ProtectedRoute canActivate={canViewBranches}>
                      <BranchDetailPage />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: "logs",
              element: (
                <ProtectedRoute canActivate={canViewLogs}>
                  <LogsPage />
                </ProtectedRoute>
              ),
            },
            // Xato sahifalari kirgan foydalanuvchiga shell ichida (kirmaganga — `STANDALONE_ERROR_PAGES`).
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

  return (
    // Sahifa yiqilsa — global chegara bilan bir xil: xato saqlanadi, `/runtime-error` ga. Kirgan foydalanuvchining
    // xato sahifasida shell yiqilsa — o'sha sahifaning shell'siz nusxasi; yo'l o'zgarsa chegara tozalanadi.
    <ErrorBoundary resetKey={pathname} fallback={isSignedIn ? standaloneErrorPage : undefined}>
      {!isSignedIn && standaloneErrorPage ? standaloneErrorPage : routes}
    </ErrorBoundary>
  );
};

export default memo(AppRouter);
