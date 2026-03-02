import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { memo, Suspense, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "../config/store";
import { ThemeProvider } from "../providers/theme/ThemeContext";
import { NotificationProvider } from "../providers/notification/NotificationProvider";
import PageLoader from "../../shared/ui/PageLoader";

const queryClient = new QueryClient();

const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>
              <Suspense fallback={<PageLoader />}>
                {children}
              </Suspense>
            </NotificationProvider>
          </QueryClientProvider>
        </Provider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default memo(AppProvider);