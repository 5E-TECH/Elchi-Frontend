import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { User, UserRole } from "../../../entities/user/types/user";
import { UserDetailWidget } from "./UserDetailWidget";

/**
 * fix3b CODE-02 (docs: admin tokenni marketga beradi) — market sahifasida
 * faqat SUPERADMIN/ADMIN uchun "Telegram token" kartasi: sukut bo'yicha
 * yashirin, ko'rsatish va nusxalash tugmalari bilan. Boshqa rollarga umuman
 * chizilmaydi.
 */

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: () => null,
}));

vi.mock("../../../features/user/update-user/ui/UpdateUserModal", () => ({
  UpdateUserModal: () => null,
}));

const TOKEN = "group_token-0123456789abcdef0123456789abcdef";

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

describe("UserDetailWidget — market Telegram tokeni (fix3b CODE-02)", () => {
  const writeText = vi.fn();
  const originalClipboard = navigator.clipboard;

  // `userEvent.setup()` o'z bufer stubini o'rnatadi — mock undan KEYIN qo'yiladi.
  const installClipboard = () =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
  });

  it.each(["superadmin", "admin"])("%s tokenni yashirin ko'radi, ochadi va nusxalaydi", async (viewerRole) => {
    const user = userEvent.setup();
    installClipboard();
    renderWidget(makeUser("market", { market_tg_token: TOKEN }), viewerRole);

    const value = screen.getByTestId("telegram-token-value");
    expect(value).not.toHaveTextContent(TOKEN);
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
    expect(screen.getByText("Market Telegram guruhiga botni qo'shib, shu tokenni yuborsin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ko'rsatish" }));
    expect(value).toHaveTextContent(TOKEN);
    expect(screen.getByRole("button", { name: "Yashirish" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));
    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByText("Token nusxalandi")).toBeInTheDocument();
  });

  it("yashirin holatda ham nusxalash haqiqiy tokenni oladi", async () => {
    const user = userEvent.setup();
    installClipboard();
    renderWidget(makeUser("market", { market_tg_token: TOKEN }), "superadmin");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));

    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it("brauzer nusxalashni rad etsa — 'nusxalandi' deyilmaydi", async () => {
    const user = userEvent.setup();
    installClipboard();
    writeText.mockRejectedValue(new Error("denied"));
    renderWidget(makeUser("market", { market_tg_token: TOKEN }), "admin");

    await user.click(screen.getByRole("button", { name: "Nusxalash" }));

    expect(await screen.findByText("Tokenni nusxalab bo'lmadi")).toBeInTheDocument();
  });

  it.each(["manager", "registrator", "courier", "market"])("%s uchun karta umuman chizilmaydi", (viewerRole) => {
    renderWidget(makeUser("market", { market_tg_token: TOKEN }), viewerRole);

    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("telegram-token-value")).not.toBeInTheDocument();
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it("market bo'lmagan foydalanuvchida superadmin ham kartani ko'rmaydi", () => {
    renderWidget(makeUser("courier", { market_tg_token: TOKEN }), "superadmin");

    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
  });

  it("o'z profilida karta yo'q", () => {
    renderWidget(makeUser("market", { market_tg_token: TOKEN }), "superadmin", true);

    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
  });

  it("token yo'q bo'lsa — sababi, tugmalarsiz", () => {
    renderWidget(makeUser("market", { market_tg_token: null }), "superadmin");

    expect(screen.getByRole("region", { name: "Telegram token" })).toBeInTheDocument();
    expect(screen.getByText("Bu marketda Telegram token hali yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nusxalash" })).not.toBeInTheDocument();
  });
});
