import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import sidebar from "../widgets/Sidebar/model/sidebarSlice";
import user from "../entities/user/model/slice";
import filter from "../features/Select/model/FilterSlice";
import search from "../features/search/model/searchSlice";
import role from "../features/auth/model/loginSlice";
import pagination from "../features/pagination/model/paginationSlice";
import i18n from "../i18n";

export const createTestStore = (preloadedState?: Record<string, unknown>) =>
  configureStore({
    reducer: {
      sidebar,
      user,
      filter,
      search,
      role,
      pagination,
    },
    preloadedState: preloadedState as never,
  });

export const renderWithProviders = (
  ui: ReactNode,
  {
    route = "/",
    preloadedState,
  }: {
    route?: string;
    preloadedState?: Record<string, unknown>;
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

  return {
    store,
    queryClient,
    ...render(
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <MemoryRouter initialEntries={[route]}>
            <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
          </MemoryRouter>
        </Provider>
      </I18nextProvider>,
    ),
  };
};
