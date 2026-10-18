import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { TELEGRAM_LINK_POLL_MS } from "../../../features/telegram-link/ui/TelegramLinkCard";
import type { User, UserRole } from "../../../entities/user/types/user";
import { UserDetailWidget } from "../../../widgets/user-detail/ui/UserDetailWidget";
import ProfilePage from "./ProfilePage";

/**
 * O'z profilida «Telegram» kartasi (BreQwksC): oyna ochiq turganda profil qayta o'qiladi va bot ulagach
 * (`telegram_linked: true`) oyna o'zi yopiladi. Karta faqat o'z profilida va faqat xodimlarga chiziladi.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: () => null,
}));

vi.mock("../../../features/user/update-user/ui/UpdateUserModal", () => ({
  UpdateUserModal: () => null,
}));

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "263",
  name: "E2E Kuryer",
  phone_number: "+998901112233",
  username: "e2e_kuryer",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: null,
  tariff_center: null,
  default_tariff: "home",
  ...overrides,
});

const profileResponse = (user: User) => ({ data: { statusCode: 200, message: "ok", data: user } });

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

describe("ProfilePage — Telegram'ni ulash", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("oyna ochiq turganda profil qayta o'qiladi; bot ulagach oyna yopiladi va karta «Ulangan»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let linked = false;
    apiGet.mockImplementation((url: string) =>
      url === "auth/my-profile"
        ? Promise.resolve(profileResponse(makeUser("courier", { telegram_linked: linked })))
        : Promise.resolve({ data: {} }),
    );
    apiPost.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Telegram link",
        data: {
          token: "Kod123",
          purpose: "user",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          deep_link: "https://t.me/elchi_test_bot?start=Kod123",
          command: "/start Kod123",
        },
      },
    });
    renderWithProviders(<ProfilePage />, { preloadedState: roleState("courier") });

    const card = await screen.findByRole("region", { name: "Telegram" });
    expect(within(card).getByText("Ulanmagan")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Telegram'ni ulash" }));
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    expect(
      await within(dialog).findByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" }),
    ).toBeInTheDocument();
    const profileCalls = () =>
      apiGet.mock.calls.filter(([url]) => url === "auth/my-profile").length;
    const before = profileCalls();

    // Hali ulanmagan — oyna ochiq qoladi, profil so'ralaveradi.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS);
    });
    expect(profileCalls()).toBeGreaterThan(before);
    expect(dialog).toBeInTheDocument();

    // Foydalanuvchi botda «Start» ni bosdi.
    linked = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS);
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Telegram'ni ulash" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Telegram ulandi")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Telegram" })).getByText("Ulangan"),
    ).toBeInTheDocument();

    // Oyna yopilgach so'rash to'xtaydi.
    const afterLinked = profileCalls();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS * 2);
    });
    expect(profileCalls()).toBe(afterLinked);
  });

  it("mijozning o'z profilida karta yo'q", async () => {
    apiGet.mockImplementation((url: string) =>
      url === "auth/my-profile"
        ? Promise.resolve(profileResponse(makeUser("customer", { name: "Mijoz" })))
        : Promise.resolve({ data: {} }),
    );
    renderWithProviders(<ProfilePage />, { preloadedState: roleState("customer") });

    expect(await screen.findAllByText("Mijoz")).not.toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Telegram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Telegram'ni ulash" })).not.toBeInTheDocument();
  });
});

describe("UserDetailWidget — Telegram kartasi faqat o'z profilida", () => {
  it.each(["courier", "market", "manager", "registrator", "admin", "superadmin"] as const)(
    "%s o'z profilida kartani ko'radi",
    (role) => {
      renderWithProviders(
        <UserDetailWidget user={makeUser(role)} isLoading={false} isError={false} isOwnProfile />,
        { preloadedState: roleState(role) },
      );

      expect(screen.getByRole("region", { name: "Telegram" })).toBeInTheDocument();
    },
  );

  it("boshqa foydalanuvchining sahifasida (admin kuryerni ko'rmoqda) karta yo'q", () => {
    renderWithProviders(
      <UserDetailWidget
        user={makeUser("courier", { telegram_linked: true })}
        isLoading={false}
        isError={false}
      />,
      { preloadedState: roleState("superadmin") },
    );

    expect(screen.queryByRole("region", { name: "Telegram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uzish" })).not.toBeInTheDocument();
  });
});
