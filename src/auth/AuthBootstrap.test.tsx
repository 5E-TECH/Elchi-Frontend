import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { mergeSettings, SETTINGS_KEY, useSettings } from "../entities/settings";
import { useUser } from "../entities/user/api/userApi";
import { setAppInitializing } from "../entities/user/model/slice";
import { api } from "../shared/api/api";
import { API_ENDPOINTS } from "../shared/api";
import { queryKeys } from "../shared/config/queryKeys";
import { removeRole } from "../shared/model/roleSlice";
import AuthBootstrap from "./AuthBootstrap";
import { authClient, bindProfileCache } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * z87E6tdQ — `GET /auth/my-profile` bitta: auth bootstrap, `useSettings` (['app-settings']) va `useGetMyProfile`
 * yagona profil keshidan o'qiydi. Avval har biri o'zi so'rardi (sahifa yuklanishida 2–3 marta).
 */
const PROFILE = {
  id: "56",
  role: "manager",
  name: "Menejer",
  settings: { appearance: { language: "ru" }, interface: { sidebarOpen: false } },
};

const profileCalls: string[] = [];
const respond = (source: string) => async (url: string) => {
  if (url === API_ENDPOINTS.AUTH.MY_PROFILE) profileCalls.push(source);
  // Bootstrap va sahifa so'rovlari bir vaqtda ketishi uchun javob biroz kechikadi.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { data: { statusCode: 200, message: "ok", data: PROFILE } } as AxiosResponse;
};

const SettingsProbe = () => {
  const { data } = useSettings();
  return <p data-testid="settings">{data ? data.appearance.language : "—"}</p>;
};

const ProfileProbe = () => {
  const { data } = useUser().useGetMyProfile();
  return <p data-testid="profile">{data?.data?.name ?? "—"}</p>;
};

const renderApp = (client: QueryClient, children: ReactNode) =>
  render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <AuthBootstrap>{children}</AuthBootstrap>
      </QueryClientProvider>
    </Provider>,
  );

describe("AuthBootstrap — yagona profil keshi (z87E6tdQ)", () => {
  let client: QueryClient;

  beforeEach(() => {
    window.sessionStorage.clear();
    tokenStorage.setAccessToken("token-123");
    profileCalls.length = 0;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(authClient, "get").mockImplementation(respond("bootstrap") as typeof authClient.get);
    vi.spyOn(api, "get").mockImplementation(respond("hook") as typeof api.get);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    bindProfileCache(null);
    tokenStorage.clear();
    store.dispatch(removeRole());
    store.dispatch(setAppInitializing(false));
  });

  it("bootstrap bilan bir vaqtda ochilgan useSettings — bitta so'rov, ['app-settings'] keshi profildan to'ladi", async () => {
    renderApp(client, <SettingsProbe />);

    await waitFor(() => expect(screen.getByTestId("settings")).toHaveTextContent("ru"));
    await waitFor(() => expect(store.getState().user.user?.id).toBe("56"));

    expect(profileCalls).toHaveLength(1);
    expect(client.getQueryData(SETTINGS_KEY)).toEqual(mergeSettings(PROFILE.settings));
    expect(client.getQueryData(queryKeys.myProfile)).toMatchObject({ data: { id: "56", name: "Menejer" } });
  });

  it("bootstrap profilni olgach ochilgan useSettings va useGetMyProfile qayta so'ramaydi", async () => {
    const { rerender } = renderApp(client, null);
    await waitFor(() => expect(store.getState().user.user?.id).toBe("56"));
    expect(profileCalls).toEqual(["bootstrap"]);

    rerender(
      <Provider store={store}>
        <QueryClientProvider client={client}>
          <AuthBootstrap>
            <SettingsProbe />
            <ProfileProbe />
          </AuthBootstrap>
        </QueryClientProvider>
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("settings")).toHaveTextContent("ru"));
    expect(screen.getByTestId("profile")).toHaveTextContent("Menejer");
    expect(profileCalls).toEqual(["bootstrap"]);
    expect(client.getQueryData(SETTINGS_KEY)).toEqual(mergeSettings(PROFILE.settings));
  });
});
