type RouteImporter = () => Promise<unknown>;

const routeImporters: Record<string, RouteImporter> = {
  "/": () => import("../../pages/dashboard/DashboardPage"),
  "/branch-dashboard": () => import("../../pages/branch-dashboard"),
  "/dispatch": () => import("../../pages/dispatch"),
  "/orders": () => import("../../pages/orders"),
  "/new-orders": () => import("../../pages/new_orders"),
  "/mails": () => import("../../pages/mails"),
  "/batches": () => import("../../pages/batches"),
  "/returns": () => import("../../pages/returns"),
  "/products": () => import("../../pages/products/list"),
  "/all-users": () => import("../../pages/users/list/UserListPage"),
  "/payments": () => import("../../pages/payments"),
  "/cash-box": () => import("../../pages/payments/components/MyCashboxPage"),
  "/financial-balance": () => import("../../pages/financial-balance"),
  "/regions": () => import("../../pages/region/index"),
  "/notifications": () => import("../../pages/notifications"),
  "/branches": () => import("../../pages/branches"),
  "/logs": () => import("../../pages/logs/index"),
};

const routePreloadCache = new Map<string, Promise<unknown>>();

export const preloadRoute = (path: string) => {
  const importer = routeImporters[path];
  if (!importer) return;

  if (!routePreloadCache.has(path)) {
    routePreloadCache.set(path, importer());
  }

  return routePreloadCache.get(path);
};

export const preloadRoutes = (paths: string[]) => {
  paths.forEach((path) => {
    void preloadRoute(path);
  });
};
