import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { memo, Suspense, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Provider, useSelector } from "react-redux";
import { I18nextProvider } from "react-i18next";
import store from "../config/store";
import type { RootState } from "../config/store";
import { ThemeProvider } from "../providers/theme/ThemeContext";
import { NotificationProvider } from "../providers/notification/NotificationProvider";
import PageLoader from "../../shared/ui/PageLoader";
import i18n from "../../i18n";
import AuthBootstrap from "../../auth/AuthBootstrap";
import SettingsSync from "../providers/SettingsSync";
import ScanFeedbackOverlay from "../../shared/components/ScanFeedbackOverlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
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
      <ThemeProvider>
        <Provider store={store}>
          <BrowserRouter>
            <QueryClientProvider client={queryClient}>
              <NotificationProvider>
                <ScanFeedbackOverlay />
                <AuthBootstrap>
                  <SettingsSync />
                  <GlobalLoader>
                    <Suspense fallback={<PageLoader />}>
                      {children}
                    </Suspense>
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
