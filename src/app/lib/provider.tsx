import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { memo, Suspense, type ReactNode } from "react";
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
import SessionExpiryCountdown from "../../auth/SessionExpiryCountdown";
import SettingsSync from "../providers/SettingsSync";
import RealtimeSync from "../providers/RealtimeSync";
import { PushSync } from "../../features/push-notifications";
import ScanFeedbackOverlay from "../../shared/components/ScanFeedbackOverlay";
import { emitQueryError } from "../../shared/lib/queryErrorEvents";
import { shouldRetryQuery } from "../../shared/lib/queryRetry";

const queryClient = new QueryClient({
  // 4xx/5xx ham foydalanuvchiga ko'rinsin — sahifa `isError` o'qimasa ham.
  queryCache: new QueryCache({
    onError: (error, query) => emitQueryError(error, query.meta),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Vaqt chegarasi (20 s) va 4xx (408, 429 dan tashqari) qayta urinilmaydi; tarmoq xatosi va 5xx — 1 marta
      // (D-08: har 400/404 ikki marta so'ralardi). Qoida va testlari — `shared/lib/queryRetry.ts`.
      retry: shouldRetryQuery,
    },
  },
});

const GlobalLoader = ({ children }: { children: ReactNode }) => {
  const isAppInitializing = useSelector((state: RootState) => state.user.isAppInitializing);

  return (
    <>
      {isAppInitializing && <PageLoader />}
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
                <ScanFeedbackOverlay />
                <UiHost />
                <AuthBootstrap>
                  <SettingsSync />
                  <PushSync />
                  <RealtimeSync />
                  <SessionExpiryCountdown />
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
