import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { installPushEnv, uninstallPushEnv } from "../test/pushEnv";
import { PUSH_DENIED_STORAGE_KEY } from "../model/usePushSubscription";
import PushPermissionButton from "./PushPermissionButton";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

/**
 * davC9QOX — ruxsat so'rash oqimi:
 * sahifa yuklanishida oyna YO'Q → tugma → bizning tushuntirish → brauzer oynasi
 * → obuna → POST /notifications/push/subscribe → sozlama push=true.
 */
describe("PushPermissionButton", () => {
  beforeEach(() => {
    window.localStorage.removeItem(PUSH_DENIED_STORAGE_KEY);
    api.get.mockReset().mockResolvedValue({
      data: { statusCode: 200, data: { enabled: true, public_key: "BPUBLIC-key" } },
    });
    api.post.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "5" } } });
    api.patch.mockReset().mockResolvedValue({ data: {} });
    api.delete.mockReset().mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    uninstallPushEnv();
  });

  it("never asks for permission on page load", async () => {
    const env = installPushEnv();
    renderWithProviders(<PushPermissionButton />);

    expect(await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" })).toBeInTheDocument();
    expect(env.notification.requestPermission).not.toHaveBeenCalled();
  });

  it("shows OUR explanation first and only then the browser prompt; then subscribes and saves", async () => {
    const env = installPushEnv({ answer: "granted" });
    const user = userEvent.setup();
    renderWithProviders(<PushPermissionButton />);

    await user.click(await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" }));
    expect(screen.getByText("Bildirishnomalarni yoqasizmi?")).toBeInTheDocument();
    expect(env.notification.requestPermission).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yoqish" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("notifications/push/subscribe", {
        endpoint: "https://fcm.googleapis.com/fcm/send/new-device",
        keys: { p256dh: "BNcR-p256dh", auth: "tBHI-auth" },
        user_agent: expect.any(String),
        platform: "desktop",
        is_standalone: false,
      }),
    );
    expect(env.notification.requestPermission).toHaveBeenCalledTimes(1);
    const [options] = env.pushManager.subscribe.mock.calls[0] as unknown as [PushSubscriptionOptionsInit];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(api.patch).toHaveBeenCalledWith(
      "auth/my-settings",
      expect.objectContaining({ settings: expect.objectContaining({ notifications: { push: true } }) }),
    );
  });

  it("closing our explanation with 'Hozir emas' asks nothing", async () => {
    const env = installPushEnv();
    const user = userEvent.setup();
    renderWithProviders(<PushPermissionButton />);

    await user.click(await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" }));
    await user.click(screen.getByRole("button", { name: "Hozir emas" }));

    expect(env.notification.requestPermission).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("after a 'denied' answer it goes passive and never asks again (survives a reload)", async () => {
    const env = installPushEnv({ answer: "denied" });
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<PushPermissionButton />);

    await user.click(await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" }));
    await user.click(screen.getByRole("button", { name: "Yoqish" }));

    expect(await screen.findByText(/brauzerda bloklangan/)).toBeInTheDocument();
    expect(window.localStorage.getItem(PUSH_DENIED_STORAGE_KEY)).toBe("1");
    expect(api.post).not.toHaveBeenCalled();

    // "Qayta yuklash": brauzer holati hamon default bo'lsa ham belgi tufayli passiv.
    unmount();
    env.notification.permission = "default";
    renderWithProviders(<PushPermissionButton />);
    expect(await screen.findByText(/brauzerda bloklangan/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bildirishnomalarni yoqish" })).not.toBeInTheDocument();
  });

  it("an already-denied browser shows the passive hint straight away", async () => {
    installPushEnv({ permission: "denied" });
    renderWithProviders(<PushPermissionButton />);
    expect(await screen.findByRole("status")).toHaveTextContent("brauzerda bloklangan");
  });

  it("renders nothing where Web Push is unsupported (e.g. an iOS Safari tab) or the SW is not registered", async () => {
    const { container } = renderWithProviders(<PushPermissionButton />);
    expect(container).toBeEmptyDOMElement();

    installPushEnv({ registered: false });
    const second = renderWithProviders(<PushPermissionButton />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(second.container).toBeEmptyDOMElement();
  });

  it("renders nothing when push is switched off on the server (no VAPID)", async () => {
    installPushEnv();
    api.get.mockResolvedValue({ data: { data: { enabled: false, public_key: null } } });
    const { container } = renderWithProviders(<PushPermissionButton />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
