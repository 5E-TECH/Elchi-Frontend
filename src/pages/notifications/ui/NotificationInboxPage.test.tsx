import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../test/test-utils";
import { tokenStorage } from "../../../auth/tokenStorage";
import {
  installPushEnv,
  uninstallPushEnv,
} from "../../../features/push-notifications/test/pushEnv";
import { PUSH_DENIED_STORAGE_KEY } from "../../../features/push-notifications/model/usePushSubscription";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));
vi.mock("../../../shared/api/instance", () => ({ api }));
vi.mock("../../../widgets/notification-inbox", () => ({ NotificationInboxList: () => null }));

import NotificationInboxPage from "./NotificationInboxPage";

/**
 * `/inbox` sarlavhasi va push holat bloki (spec D4): sarlavha hamma rolda «Bildirishnomalar»; «SMS» va
 * «Xabar yuborish» faqat `canSendNotifications`; push — so'ralmagan → sarlavhada «Bildirishnomalarni yoqish»
 * (avval bizning oyna), bloklangan → ogohlantirish + «Qanday yoqiladi», yoqilgan → karta + o'chirish.
 */

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

let unread = 3;
let pushSettings: Record<string, unknown> = {};

const Probe = () => {
  const location = useLocation();
  return (
    <span data-testid="location">{`${location.pathname}|${JSON.stringify(location.state)}`}</span>
  );
};

const render = (role = "courier") =>
  renderWithProviders(
    <>
      <NotificationInboxPage />
      <Probe />
    </>,
    { route: "/inbox", preloadedState: roleState(role) },
  );

beforeEach(() => {
  unread = 3;
  pushSettings = {};
  window.localStorage.removeItem(PUSH_DENIED_STORAGE_KEY);
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "notifications/inbox/unread-count")
      return Promise.resolve({ data: { data: { unread } } });
    if (url === "notifications/push/public-key")
      return Promise.resolve({
        data: { statusCode: 200, data: { enabled: true, public_key: "BPUBLIC-key" } },
      });
    if (url === "auth/my-profile")
      return Promise.resolve({ data: { data: { settings: pushSettings } } });
    return Promise.resolve({ data: { data: {} } });
  });
  api.patch.mockReset().mockResolvedValue({ data: {} });
  api.post.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "5" } } });
  api.delete.mockReset().mockResolvedValue({ data: {} });
});

afterEach(() => {
  uninstallPushEnv();
  tokenStorage.setAccessToken(null);
});

describe("NotificationInboxPage — sarlavha amallari", () => {
  it.each(["superadmin", "admin"])("%s: «SMS» va «Xabar yuborish» havolalari bor", (role) => {
    render(role);
    expect(screen.getByRole("heading", { level: 1, name: "Bildirishnomalar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xabar yuborish" })).toHaveAttribute(
      "href",
      "/notifications/send",
    );
    expect(screen.getByRole("link", { name: "SMS" })).toHaveAttribute("href", "/notifications/sms");
  });

  it.each(["market", "courier", "registrator", "manager"])(
    "%s: yuborish havolalari yo'q",
    (role) => {
      render(role);
      expect(
        screen.getByRole("heading", { level: 1, name: "Bildirishnomalar" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Xabar yuborish" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "SMS" })).not.toBeInTheDocument();
    },
  );

  it("«Barchasini o'qilgan deb belgilash» → PATCH read-all va xabar", async () => {
    render();
    const button = screen.getByRole("button", { name: "Barchasini o'qilgan deb belgilash" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("notifications/inbox/read-all"));
    expect(
      await screen.findByText("Barcha bildirishnomalar o'qilgan deb belgilandi"),
    ).toBeInTheDocument();
  });

  it("o'qilmagan yo'q — tugma o'chiq", async () => {
    unread = 0;
    render();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Barchasini o'qilgan deb belgilash" }),
      ).toBeDisabled(),
    );
  });
});

describe("NotificationInboxPage — push holatlari", () => {
  it("push qo'llanmasa (iOS Safari tabi) — tugma ham, blok ham yo'q", () => {
    render();
    expect(
      screen.queryByRole("button", { name: "Bildirishnomalarni yoqish" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Bildirishnomalar brauzerda bloklangan")).not.toBeInTheDocument();
  });

  it("so'ralmagan — sarlavhada «Bildirishnomalarni yoqish», bosilsa AVVAL bizning oyna", async () => {
    const env = installPushEnv();
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" }));
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnomalarni yoqasizmi?" });
    expect(within(dialog).getByText(/Keyingi qadamda brauzer ruxsat so'raydi/)).toBeInTheDocument();
    expect(env.notification.requestPermission).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Hozir emas" }));
    expect(env.notification.requestPermission).not.toHaveBeenCalled();
  });

  it("bloklangan — ogohlantirish va «Qanday yoqiladi» → Sozlamalarning Bildirishnomalar bo'limi", async () => {
    installPushEnv({ permission: "denied" });
    render();
    expect(await screen.findByText("Bildirishnomalar brauzerda bloklangan")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bildirishnomalarni yoqish" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Qanday yoqiladi" }));
    expect(screen.getByTestId("location").textContent).toBe('/settings|{"tab":"notifications"}');
  });

  it("yoqilgan — karta «Bildirishnomalar yoqilgan», «O'chirib qo'yish» (nomi «Bildirishnomalarni o'chirish») o'chiradi", async () => {
    pushSettings = { notifications: { push: true } };
    // Sozlama (`notifications.push`) faqat kirgan foydalanuvchida o'qiladi (`useSettings` → token).
    tokenStorage.setAccessToken("test.token");
    installPushEnv({ permission: "granted", subscribed: true });
    render();
    expect(await screen.findByText("Bildirishnomalar yoqilgan")).toBeInTheDocument();
    const off = screen.getByRole("button", { name: "Bildirishnomalarni o'chirish" });
    expect(off).toHaveTextContent("O'chirib qo'yish");
    await userEvent.click(off);
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        "auth/my-settings",
        expect.objectContaining({
          settings: expect.objectContaining({
            notifications: expect.objectContaining({ push: false }),
          }),
        }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Bildirishnomalarni yoqish" }),
    ).toBeInTheDocument();
  });
});
