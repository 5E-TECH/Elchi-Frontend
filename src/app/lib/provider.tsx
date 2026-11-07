import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, memo, Suspense, type ComponentType, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Provider, useSelector } from "react-redux";
import { I18nextProvider } from "react-i18next";
import store from "../config/store";
import type { RootState } from "../config/store";
import { ThemeProvider } from "../providers/theme/ThemeContext";
import { NotificationProvider } from "../providers/notification/NotificationProvider";
import { UiHost } from "../providers/UiHost";
import PageLoader from "../../shared/ui/PageLoader";
import i18n from "../../i18n";
import AuthBootstrap from "../../auth/AuthBootstrap";
import SessionRestoreScreen from "../../auth/SessionRestoreScreen";
import SessionExpiryCountdown from "../../auth/SessionExpiryCountdown";
import PasswordChangePrompt from "../providers/PasswordChangePrompt";
import SettingsSync from "../providers/SettingsSync";
import RealtimeSync from "../providers/RealtimeSync";
// Aniq fayldan (barrel emas): barrel sozlamalar sahifasidagi push tugmasi va oynasini boshlang'ich faylga tortardi.
import PushSync from "../../features/push-notifications/ui/PushSync";
// Aniq fayldan (barrel emas): ochiq ilovaga yangi versiya chiqsa — «Yangilash» banneri.
import AppUpdateBanner from "../../features/app-update/ui/AppUpdateBanner";
import { emitQueryError, emitQueryRecovered } from "../../shared/lib/queryErrorEvents";
import { shouldRetryQuery } from "../../shared/lib/queryRetry";
import { capInvalidateWait } from "../../shared/lib/invalidateWait";

/**
 * USB skan natijasi xabari — faqat skan bo'lganda kerak: alohida chunk (ovoz/tebranish moduli bilan), kirish sahifasining
 * boshlang'ich faylida emas. Chunk yuklanmasa (uzilish) — xabar chiqmaydi, ilova xato sahifasiga tushmaydi.
 */
const ScanFeedbackOverlay = lazy(
  (): Promise<{ default: ComponentType }> =>
    import("../../shared/components/ScanFeedbackOverlay").catch(() => ({ default: () => null })),
);

/** Ilovaning `QueryClient` i (test uchun eksport — `createAppQueryClient()` bilan bir xil sozlama). */
export const createAppQueryClient = () => {
  // 4xx/5xx ham foydalanuvchiga ko'rinsin — sahifa `isError` o'qimasa ham. G6F68ti6 (5-band): faqat ochiq sahifa
  // kuzatayotgan so'rov uchun; so'rov tiklansa yoki keshdan olinsa xabar o'zi yopiladi.
  const queryCache = new QueryCache({
    onError: (error, query) => emitQueryError(error, query.meta, query),
    onSuccess: (_data, query) => emitQueryRecovered(query.queryHash),
  });
  queryCache.subscribe((event) => {
    if (event.type === "removed") emitQueryRecovered(event.query.queryHash);
  });
  // Amaldan keyingi yangilash kutilishi ≤ 20 s (sekin internet, 2026-11-07): `shared/lib/invalidateWait.ts`.
  const client = new QueryClient({
    queryCache,
    defaultOptions: {
      // G6F68ti6 (2-band): oflaynda amal (sotish, to'lov …) pauzaga tushib tugma to'xtamay aylanmasin va aloqa
      // qaytgach o'zi jo'natilmasin — darhol tarmoq xatosi, global «Internet aloqasi yo'q», tugma to'xtaydi.
      // Pul amallari `Idempotency-Key` bilan — qayta bosish ikki marta yozmaydi.
      mutations: { networkMode: "always" },
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Vaqt chegarasi (GET ni adapter o'zi 1 marta qayta so'raydi — `shared/api/readRetry.ts`) va 4xx (408, 429 dan
        // tashqari) bu yerda qayta urinilmaydi; tarmoq xatosi va 5xx — 1 marta
        // (D-08: har 400/404 ikki marta so'ralardi). Qoida va testlari — `shared/lib/queryRetry.ts`.
        retry: shouldRetryQuery,
      },
    },
  });
  return capInvalidateWait(client);
};

const queryClient = createAppQueryClient();

/**
 * Ilova ochilayotganda — yuklanish ekrani; sessiyani tiklash sekin yoki vaqtincha yiqilgan bo'lsa — «Internet sekin —
 * qayta urinilmoqda» ekrani (`auth/SessionRestoreScreen`, sekin internet 2026-11-07). Test uchun eksport.
 */
export const GlobalLoader = ({ children }: { children: ReactNode }) => {
  const isAppInitializing = useSelector((state: RootState) => state.user.isAppInitializing);
  const sessionRestore = useSelector((state: RootState) => state.user.sessionRestore ?? null);

  return (
    <>
      {isAppInitializing &&
        (sessionRestore ? <SessionRestoreScreen state={sessionRestore} /> : <PageLoader />)}
      <div className={isAppInitializing ? "invisible opacity-0" : "visible opacity-100"}>
        {children}
      </div>
    </>
  );
};

const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <I18nextProvider i18n={i18n} defaultNS="common">
      {/*
        antd global provayderi YO'Q (rzzxMItN): ilovada antd'dan faqat `QRCode` qolgan va uning ranglari o'zida
        (`MarketQrDialog`). Global `ConfigProvider` har sahifaga, kirish sahifasiga ham ~30 KB gzip antd yuklardi.
      */}
      <ThemeProvider>
        <Provider store={store}>
          <BrowserRouter>
            <QueryClientProvider client={queryClient}>
              <NotificationProvider>
                <Suspense fallback={null}>
                  <ScanFeedbackOverlay />
                </Suspense>
                <UiHost />
                <AuthBootstrap>
                  <SettingsSync />
                  <PushSync />
                  <RealtimeSync />
                  <SessionExpiryCountdown />
                  <AppUpdateBanner />
                  <PasswordChangePrompt />
                  <GlobalLoader>
                    <Suspense fallback={<PageLoader />}>{children}</Suspense>
                  </GlobalLoader>
                </AuthBootstrap>
              </NotificationProvider>
            </QueryClientProvider>
          </BrowserRouter>
        </Provider>
      </ThemeProvider>
    </I18nextProvider>
  );
};

export default memo(AppProvider);
