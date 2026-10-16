import { useLayoutEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

/**
 * BO'LIMLAR ORASIDA O'TISH HOLATI (shell, dizayn v2 2-bosqich).
 *
 * Nega kerak: `BrowserRouter` (react-router 7) navigatsiyani `startTransition`
 * ichida bajaradi. Yangi sahifa kodi (lazy chunk) yuklanayotganda React ESKI
 * sahifani ko'rsatib turadi va Suspense fallback'i chiqmaydi — foydalanuvchi
 * bosganidan keyin hech qanday belgi ko'rmasdi (maket `tizim-loading`:
 * «150 ms dan — yuqori chiziq», «bosilgan menyu bandi darhol tanlangan bo'ladi»).
 *
 * Brauzer URL'i (`window.location`) esa `history.pushState` bilan DARHOL
 * o'zgaradi. Shu yerda ikkisi solishtiriladi:
 *   - URL o'zgargani sezilsa (bosish, «Orqaga»/«Oldinga», Navigation API) va
 *     router hali eski yo'lni chizayotgan bo'lsa — navigatsiya kutilmoqda;
 *   - router yangi yo'lni chizgach (commit) — holat tozalanadi.
 * Qo'shimcha: shell ichidagi `<Suspense>` fallback'i (birinchi ochilish) ham
 * shu do'konga «yuklanmoqda» deb yozadi (`useRouteSuspenseSignal`).
 *
 * Faqat URL HAQIQATAN o'zgarganda belgilanadi — `MemoryRouter` (testlar)
 * `window.location` ga tegmaydi, demak u yerda hech qachon «kutilmoqda» bo'lmaydi.
 */

type Snapshot = {
  /** Brauzer URL'i o'tgan, lekin router hali chizmagan yo'l (pathname). */
  readonly target: string | null;
  /** Shell ichidagi Suspense fallback'lari soni (lazy sahifa yuklanmoqda). */
  readonly suspended: number;
};

const SERVER_SNAPSHOT: Snapshot = { target: null, suspended: 0 };

const readPath = () => (typeof window === "undefined" ? "" : window.location.pathname);

let snapshot: Snapshot = SERVER_SNAPSHOT;
/** Oxirgi ko'rilgan `window.location.pathname` — faqat haqiqiy o'zgarish hisobga olinadi. */
let lastSeenPath = readPath();
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

const setSnapshot = (next: Partial<Snapshot>) => {
  const merged = { ...snapshot, ...next };
  if (merged.target === snapshot.target && merged.suspended === snapshot.suspended) return;
  snapshot = merged;
  listeners.forEach((listener) => listener());
};

/** URL o'zgarganmi — o'zgargan bo'lsa yangi yo'l «kutilayotgan» deb belgilanadi. */
const checkUrl = () => {
  const path = readPath();
  if (path === lastSeenPath) return;
  lastSeenPath = path;
  setSnapshot({ target: path });
};

type NavigationApi = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const attach = () => {
  // Havola bosilganda router `pushState` ni React hodisa ishlovchisida chaqiradi —
  // `capture` bosqichidan keyin. Shu sabab tekshiruv keyingi vazifaga qoldiriladi.
  const onClick = () => {
    window.setTimeout(checkUrl, 0);
  };
  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", checkUrl);
  // Navigation API (Chromium, Safari 26+): dasturiy `navigate()` ham seziladi.
  const navigation = (window as unknown as { navigation?: NavigationApi }).navigation;
  navigation?.addEventListener("currententrychange", checkUrl);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("popstate", checkUrl);
    navigation?.removeEventListener("currententrychange", checkUrl);
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!detach && typeof window !== "undefined") detach = attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
};

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * Router `pathname` ni chizdi (commit). URL bilan teng bo'lsa — kutish tugadi;
 * teng bo'lmasa (yo'naltirish yoki navbatdagi o'tish) — URL'dagi yo'l kutiladi.
 */
const syncCommitted = (routerPath: string) => {
  const path = readPath();
  if (path === routerPath) setSnapshot({ target: null });
  else if (path !== lastSeenPath) setSnapshot({ target: path });
  // URL o'zgarmagan va router boshqa yo'lda (MemoryRouter) — holatga tegilmaydi.
  lastSeenPath = path;
};

/** Shell `<Suspense>` fallback'i ko'ringan payt — sanoqni oshiradi, qaytgan funksiya kamaytiradi. */
export const beginRouteSuspense = () => {
  setSnapshot({ suspended: snapshot.suspended + 1 });
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    setSnapshot({ suspended: Math.max(0, snapshot.suspended - 1) });
  };
};

export type RouteTransitionState = {
  /** Router hali chizmagan, lekin brauzer o'tgan yo'l; kutish bo'lmasa `null`. */
  pendingPathname: string | null;
  /** Bo'lim kodi yoki ma'lumoti kutilmoqda (navigatsiya yoki shell Suspense fallback'i). */
  isLoading: boolean;
};

/**
 * Joriy o'tish holati. Router ichida (`useLocation`) ishlatiladi.
 * Komponent faqat shu holat o'zgarganda qayta chiziladi (sinxron yangilanish —
 * router transition'i kutilayotgan paytda ham ishlaydi).
 */
export const useRouteTransition = (): RouteTransitionState => {
  const { pathname } = useLocation();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    syncCommitted(pathname);
  }, [pathname]);

  const pendingPathname = state.target !== null && state.target !== pathname ? state.target : null;
  return { pendingPathname, isLoading: pendingPathname !== null || state.suspended > 0 };
};

/**
 * Menyuda «faol» bandni hisoblash uchun yo'l: kutilayotgan o'tish bo'lsa — uning
 * manzili (bosilgan band DARHOL tanlangan ko'rinadi), aks holda router yo'li.
 */
export const useNavPathname = (): string => {
  const { pathname } = useLocation();
  const { pendingPathname } = useRouteTransition();
  return pendingPathname ?? pathname;
};

/** Faqat testlar uchun: modul holatini tozalaydi. */
export const __resetNavigationPendingForTests = () => {
  snapshot = SERVER_SNAPSHOT;
  lastSeenPath = readPath();
};
