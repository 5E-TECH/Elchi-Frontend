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
  // ─── Qo'shimcha route'lar ────────────────────────────────────────────────
  "/scan": () => import("../../pages/scan"),
  "/settings": () => import("../../pages/settings/ui/SettingsPage"),
  "/profile": () => import("../../pages/profile/ui/ProfilePage"),
};

const routePreloadCache = new Map<string, Promise<unknown>>();

export const preloadRoute = (path: string): Promise<unknown> | undefined => {
  const importer = routeImporters[path];
  if (!importer) return;

  if (!routePreloadCache.has(path)) {
    // Network xatolarida unhandled rejection oldini olish
    const promise = importer().catch(() => {
      // Preload muvaffaqiyatsiz bo'lsa — keshdan o'chirib, keyingi urinishga ruxsat berish
      routePreloadCache.delete(path);
    });
    routePreloadCache.set(path, promise);
  }

  return routePreloadCache.get(path);
};

export const preloadRoutes = (paths: string[]): void => {
  paths.forEach((path) => {
    void preloadRoute(path);
  });
};
