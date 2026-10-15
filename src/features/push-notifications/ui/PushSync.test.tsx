import { act, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { DEFAULT_SETTINGS, type AppSettings } from "../../../entities/settings";
import { installPushEnv, uninstallPushEnv } from "../test/pushEnv";
import PushPermissionButton from "./PushPermissionButton";
import PushSync from "./PushSync";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const settingsState = vi.hoisted(() => ({ push: false }));
vi.mock("../../../entities/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/settings")>();
  return {
    ...actual,
    useSettings: () => ({
      data: { ...actual.DEFAULT_SETTINGS, notifications: { push: settingsState.push } } as AppSettings,
    }),
  };
});

const loggedIn = { role: { id: "42", role: "courier", region: null, name: "Kuryer" } } as never;

describe("PushSync — device subscription follows the user setting", () => {
  beforeEach(() => {
    settingsState.push = false;
    api.get.mockReset().mockResolvedValue({ data: { data: { enabled: true, public_key: "BPUBLIC-key" } } });
    api.post.mockReset().mockResolvedValue({ data: {} });
    api.patch.mockReset().mockResolvedValue({ data: {} });
    api.delete.mockReset().mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    uninstallPushEnv();
  });

  it("setting ON + permission granted: re-sends this device's subscription (idempotent, covers subscription change / user switch)", async () => {
    settingsState.push = true;
    const env = installPushEnv({ permission: "granted", subscribed: true });

    renderWithProviders(<PushSync />, { preloadedState: loggedIn });

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "notifications/push/subscribe",
        expect.objectContaining({ endpoint: env.subscription?.endpoint }),
      ),
    );
    expect(env.notification.requestPermission).not.toHaveBeenCalled();
  });

  it("setting OFF: removes the existing subscription from the server and the browser, creates none", async () => {
    const env = installPushEnv({ permission: "granted", subscribed: true });
    const subscription = env.subscription!;

    renderWithProviders(<PushSync />, { preloadedState: loggedIn });

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith("notifications/push/subscribe", {
        data: { endpoint: subscription.endpoint },
      }),
    );
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(env.pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("never prompts on load when permission was not granted yet", async () => {
    settingsState.push = true;
    const env = installPushEnv({ permission: "default" });

    renderWithProviders(<PushSync />, { preloadedState: loggedIn });

    await waitFor(() => expect(env.pushManager.getSubscription).toHaveBeenCalled());
    expect(env.notification.requestPermission).not.toHaveBeenCalled();
    expect(env.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("refreshes the inbox when the SW reports a push (open tab gets it in-app)", async () => {
    const env = installPushEnv();
    const { queryClient } = renderWithProviders(<PushSync />, { preloadedState: loggedIn });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    env.emitMessage({ type: "elchi:push", payload: { title: "Yangi buyurtma" } });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notifications-inbox"] });
  });

  it("button in the enabled state turns push off: DELETE + setting push=false", async () => {
    settingsState.push = true;
    const env = installPushEnv({ permission: "granted", subscribed: true });
    const subscription = env.subscription!;
    const user = userEvent.setup();

    renderWithProviders(<PushPermissionButton />, { preloadedState: loggedIn });
    await user.click(await screen.findByRole("button", { name: "Bildirishnomalarni o'chirish" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("auth/my-settings", {
        settings: expect.objectContaining({ notifications: expect.objectContaining({ push: false }) }),
      }),
    );
    expect(api.delete).toHaveBeenCalledWith("notifications/push/subscribe", {
      data: { endpoint: subscription.endpoint },
    });
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("settings keep notifications.push through mergeSettings (white-listed)", async () => {
    const { mergeSettings } = await vi.importActual<typeof import("../../../entities/settings")>(
      "../../../entities/settings",
    );
    expect(mergeSettings({ notifications: { push: true } }).notifications.push).toBe(true);
    expect(mergeSettings({}).notifications).toEqual(DEFAULT_SETTINGS.notifications);
  });

  /**
   * IKKI-XABAR TO'SIG'I: ko'rinib turgan tab bo'lsa SW tizim bildirishnomasini
   * KO'RSATMAYDI — hodisa ilova ichida toast bo'lib chiqishi shart, aks holda
   * foydalanuvchi uni umuman ko'rmaydi.
   */
  const LocationProbe = () => <span data-testid="path">{useLocation().pathname}</span>;

  it("⭐ ko'rinib turgan tabda push ilova ichida TOAST bo'lib chiqadi, \"Ochish\" havolaga olib boradi", async () => {
    const env = installPushEnv();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <PushSync />
        <LocationProbe />
      </>,
      { preloadedState: loggedIn, route: "/" },
    );

    act(() =>
      env.emitMessage({
        type: "elchi:push",
        payload: { id: "n1", title: "Yangi buyurtma #1001", body: "Chilonzor, 150 000 so'm", link: "/orders/1001" },
      }),
    );

    expect(await screen.findByText("Yangi buyurtma #1001")).toBeInTheDocument();
    expect(screen.getByText("Chilonzor, 150 000 so'm")).toBeInTheDocument();
    await user.click(screen.getByText("Ochish").closest("button")!);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/orders/1001"));
  });

  it("yashirin tab toast KO'RSATMAYDI (u holda SW tizim bildirishnomasini o'zi chiqargan)", async () => {
    const env = installPushEnv();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderWithProviders(<PushSync />, { preloadedState: loggedIn });

    act(() => env.emitMessage({ type: "elchi:push", payload: { id: "n2", title: "Yashirin xabar" } }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Yashirin xabar")).not.toBeInTheDocument();
    visibility.mockRestore();
  });

  it("tashqi havola toastdan ochilmaydi — o'rniga /inbox", async () => {
    const env = installPushEnv();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <PushSync />
        <LocationProbe />
      </>,
      { preloadedState: loggedIn, route: "/" },
    );

    act(() =>
      env.emitMessage({ type: "elchi:push", payload: { id: "n3", title: "Havola", link: "https://evil.example/x" } }),
    );
    await user.click((await screen.findByText("Ochish")).closest("button")!);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/inbox"));
  });
});
