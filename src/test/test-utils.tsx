import { useState, useSyncExternalStore, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import type { RootState } from "../app/config/store";
import sidebar from "../widgets/Sidebar/model/sidebarSlice";
import user from "../entities/user/model/slice";
import filter from "../shared/model/filterSlice";
import search from "../shared/model/searchSlice";
import role from "../shared/model/roleSlice";
import i18n from "../i18n";
import { NotificationProvider } from "../app/providers/notification/NotificationProvider";
import { toastStore } from "../shared/lib/notify";
import { ConfirmHost, Toaster } from "../shared/ui/primitives";

/**
 * Testdagi `<Toaster />`: birinchi xabar chiqqanda o'rnatiladi. Ilovada (`UiHost`) u doim turadi va doimiy
 * `role="status"` / `role="alert"` e'lon hududlarini chizadi — xabarsiz testlarda ular sahifaning o'z
 * `getByRole("alert")` so'rovlari bilan to'qnashmasin.
 */
const TestToaster = () => {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
  const [shown, setShown] = useState(false);
  if (!shown && toasts.length > 0) setShown(true);
  return shown || toasts.length > 0 ? <Toaster /> : null;
};

const rootReducer = combineReducers({
  sidebar,
  user,
  filter,
  search,
  role,
});

export const createTestStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

export const renderWithProviders = (
  ui: ReactNode,
  {
    route = "/",
    preloadedState,
    history = "memory",
  }: {
    /** Satr yoki router state'li yozuv (masalan `{ pathname, search, state }`). `history: "browser"` da e'tiborsiz. */
    route?: string | { pathname: string; search?: string; state?: unknown };
    preloadedState?: Partial<RootState>;
    /**
     * `browser` — ilovadagidek `BrowserRouter` (jsdom `window.history`): brauzer «Orqaga» (`history.back()` →
     * `popstate`) tekshiriladi. Manzil va tarix yozuvlarini test o'zi qo'yadi (`history.replaceState/pushState`).
     */
    history?: "memory" | "browser";
  } = {},
) => {
  const store = createTestStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const providers = (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>{ui}</NotificationProvider>
      {/* Ilovadagidek (`UiHost`): `useConfirm()` oynalari va `notify()` xabarlari shu yerda chiziladi. */}
      <ConfirmHost />
      <TestToaster />
    </QueryClientProvider>
  );

  return {
    store,
    queryClient,
    ...render(
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          {history === "browser" ? (
            <BrowserRouter>{providers}</BrowserRouter>
          ) : (
            <MemoryRouter initialEntries={[route]}>{providers}</MemoryRouter>
          )}
        </Provider>
      </I18nextProvider>,
    ),
  };
};
