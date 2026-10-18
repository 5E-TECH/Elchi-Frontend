import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { api } from "../../../shared/api/api";
import type { User, UserRole } from "../../../entities/user/types/user";
import { UserDetailWidget } from "./UserDetailWidget";

/**
 * Market sahifasidagi «Telegram token» kartasi (fix3b CODE-02 → GvL6ZFAd, maket `superadmin-users-detail`).
 * Token umumiy javoblarda (`/users/:id`) endi YO'Q — faqat `GET /markets/:id/tg-token` (FAQAT SUPERADMIN)
 * dan, «Ko'rsatish» yoki «Nusxalash» bosilganda. Boshqa rollarga karta chizilmaydi va so'rov ketmaydi.
 */

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: () => null,
}));

vi.mock("../../../features/user/update-user/ui/UpdateUserModal", () => ({
  UpdateUserModal: () => null,
}));

const TOKEN = "group_token-0123456789abcdef0123456789abcdef";
const TOKEN_URL = "markets/201/tg-token";

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "201",
  name: "Yandex",
  phone_number: "+998900000001",
  username: "yandex",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 30000,
  tariff_center: 20000,
  default_tariff: "center",
  ...overrides,
});

const renderWidget = (user: User, viewerRole: string, isOwnProfile = false) =>
  renderWithProviders(
    <UserDetailWidget user={user} isLoading={false} isError={false} isOwnProfile={isOwnProfile} />,
    { preloadedState: { role: { id: `${viewerRole}-1`, role: viewerRole, region: null, name: viewerRole } } as never },
  );

describe("UserDetailWidget — market Telegram tokeni (GvL6ZFAd)", () => {
  const writeText = vi.fn();
  const originalClipboard = navigator.clipboard;
  let getSpy: MockInstance;

  // `userEvent.setup()` o'z bufer stubini o'rnatadi — mock undan KEYIN qo'yiladi.
  const installClipboard = () =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const tokenCalls = () => getSpy.mock.calls.filter(([url]) => url === TOKEN_URL);

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    getSpy = vi.spyOn(api, "get").mockImplementation((url: string) =>
      url === TOKEN_URL
        ? Promise.resolve({ data: { statusCode: 200, data: { id: "201", market_tg_token: TOKEN } } })
        : Promise.resolve({ data: { data: [] } }),
    );
  });

  afterEach(() => {
    getSpy.mockRestore();
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
  });

  it("⭐ superadmin: karta yashirin, so'rov ketmaydi; «Ko'rsatish» — `GET /markets/:id/tg-token`, «Nusxalash» — o'sha token", async () => {
    const user = userEvent.setup();
    installClipboard();
    renderWidget(makeUser("market"), "superadmin");

    const value = screen.getByTestId("telegram-token-value");
    expect(value).toHaveTextContent("••••••••••••••••");
    expect(value).toHaveTextContent("Token yashirilgan");
    expect(tokenCalls()).toHaveLength(0);
    // Dizayn v2 kartasi (maket `superadmin-users-detail`): izoh maketdagi to'liq matn.
    expect(
      screen.getByText(
        "Market Telegram guruhiga botni qo'shib, shu tokenni yuborsin. Token — maxfiy kalit, uni faqat shu marketga bering.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ko'rsatish" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));
    await waitFor(() => expect(screen.getByTestId("telegram-token-value")).toHaveTextContent(TOKEN));
    // Maketdagidek `aria-pressed` — ochiq holat.
    expect(screen.getByRole("button", { name: "Yashirish" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));
    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByText("Token nusxalandi")).toBeInTheDocument();
    // Bir marta olinadi (karta ichida), har bosishda qayta so'ralmaydi.
    expect(tokenCalls()).toHaveLength(1);
  });

  it("yashirin holatda «Nusxalash» — tokenni so'rab nusxalaydi, ekranda ochmaydi", async () => {
    const user = userEvent.setup();
    installClipboard();
    renderWidget(makeUser("market"), "superadmin");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TOKEN));
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it("brauzer nusxalashni rad etsa — 'nusxalandi' deyilmaydi", async () => {
    const user = userEvent.setup();
    installClipboard();
    writeText.mockRejectedValue(new Error("denied"));
    renderWidget(makeUser("market"), "superadmin");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));

    expect(await screen.findByText("Tokenni nusxalab bo'lmadi")).toBeInTheDocument();
  });

  it("server rad etsa (403/404) — «Tokenni olib bo'lmadi» va backend sababi; token ochilmaydi", async () => {
    const user = userEvent.setup();
    getSpy.mockImplementation(() =>
      Promise.reject(
        new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 404,
          data: { statusCode: 404, message: "Market topilmadi" },
        } as AxiosResponse),
      ),
    );
    renderWidget(makeUser("market"), "superadmin");

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));

    expect(await screen.findByText("Tokenni olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Market topilmadi")).toBeInTheDocument();
    expect(screen.getByTestId("telegram-token-value")).toHaveTextContent("••••••••••••••••");
  });

  it("marketda token yo'q — sababi, tugmalarsiz", async () => {
    const user = userEvent.setup();
    getSpy.mockImplementation(() => Promise.resolve({ data: { data: { id: "201", market_tg_token: null } } }));
    renderWidget(makeUser("market"), "superadmin");

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));

    expect(await screen.findByText("Bu marketda Telegram token hali yo'q")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Telegram token" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nusxalash" })).not.toBeInTheDocument();
  });

  it.each(["admin", "manager", "registrator", "courier", "market"])(
    "%s uchun karta umuman chizilmaydi va token so'ralmaydi (endpoint faqat SUPERADMIN)",
    (viewerRole) => {
      renderWidget(makeUser("market"), viewerRole);

      expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("telegram-token-value")).not.toBeInTheDocument();
      expect(tokenCalls()).toHaveLength(0);
    },
  );

  it("⭐ boshqa marketga o'tilsa (sahifa qayta o'rnatilmaydi) — oldingi marketning tokeni ko'rinmaydi, yangisi so'raladi", async () => {
    const user = userEvent.setup();
    getSpy.mockImplementation((url: string) =>
      Promise.resolve({ data: { data: { id: url.split("/")[1], market_tg_token: `group_token-${url.split("/")[1]}` } } }),
    );
    // Sahifa qayta o'rnatilmaydi — faqat `user` almashadi (`/all-users/:id` keshdan).
    const Harness = () => {
      const [current, setCurrent] = useState(() => makeUser("market"));
      return (
        <>
          <button type="button" onClick={() => setCurrent(makeUser("market", { id: "305", name: "Nur" }))}>
            boshqa market
          </button>
          <UserDetailWidget user={current} isLoading={false} isError={false} />
        </>
      );
    };
    renderWithProviders(<Harness />, {
      preloadedState: { role: { id: "superadmin-1", role: "superadmin", region: null, name: "superadmin" } } as never,
    });

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));
    await waitFor(() => expect(screen.getByTestId("telegram-token-value")).toHaveTextContent("group_token-201"));

    await user.click(screen.getByRole("button", { name: "boshqa market" }));
    expect(screen.getByTestId("telegram-token-value")).toHaveTextContent("••••••••••••••••");
    expect(screen.queryByText("group_token-201")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));
    await waitFor(() => expect(screen.getByTestId("telegram-token-value")).toHaveTextContent("group_token-305"));
    expect(getSpy.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(["markets/201/tg-token", "markets/305/tg-token"]));
  });

  it("market bo'lmagan foydalanuvchida superadmin ham kartani ko'rmaydi", () => {
    renderWidget(makeUser("courier"), "superadmin");

    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
  });

  it("o'z profilida karta yo'q", () => {
    renderWidget(makeUser("market"), "superadmin", true);

    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
  });
});
