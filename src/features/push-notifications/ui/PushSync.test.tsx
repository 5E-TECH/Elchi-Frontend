import { screen, waitFor } from "@testing-library/react";
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
        settings: expect.objectContaining({ notifications: { push: false } }),
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
});
