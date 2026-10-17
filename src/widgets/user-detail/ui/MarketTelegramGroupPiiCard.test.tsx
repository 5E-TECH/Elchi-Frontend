import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { useUser } from "../../../entities/user/api/userApi";
import type { User, UserRole } from "../../../entities/user/types/user";
import { MarketTelegramGroupPiiCard } from "./MarketTelegramGroupPiiCard";
import { UserDetailWidget } from "./UserDetailWidget";

/**
 * ysBqD9Nx — «Guruhda mijoz ismi va telefoni» kaliti (`tg_group_show_customer_pii`).
 * Darhol saqlanadi (tasdiqsiz) → PATCH markets/:id/telegram-group-pii → foydalanuvchi so'rovi
 * qayta o'qiladi → «Saqlandi»; xato — kalit qaytadi, backend matni xabarda.
 */

const server = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  patchError: null as unknown,
}));

const http = vi.hoisted(() => ({
  get: vi.fn(async () => ({ data: { statusCode: 200, data: { ...server.user } } })),
  patch: vi.fn(async (_url: string, body: Record<string, unknown>) => {
    if (server.patchError) throw server.patchError;
    server.user = { ...server.user, ...body };
    return { data: { statusCode: 200, message: "Market yangilandi", data: { ...server.user } } };
  }),
}));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("../../../features/courier-transfer-branch", () => ({ TransferCourierButton: () => null }));
vi.mock("../../../features/user/update-user/ui/UpdateUserModal", () => ({ UpdateUserModal: () => null }));

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  ...overrides,
});

const viewer = (role: string, id = `${role}-1`) =>
  ({ role: { id, role, region: null, name: role } }) as never;

/** Tafsilot sahifasidagidek: foydalanuvchi `GET users/:id` dan o'qiladi, kalit undan holatni oladi. */
const DetailHarness = ({ isOwnProfile = false }: { isOwnProfile?: boolean }) => {
  const { useGetUserById } = useUser();
  const { data } = useGetUserById("201");
  const user = data?.data as User | undefined;
  return user ? <MarketTelegramGroupPiiCard user={user} isOwnProfile={isOwnProfile} /> : null;
};

const renderDetail = (viewerRole: string, { isOwnProfile = false, viewerId }: { isOwnProfile?: boolean; viewerId?: string } = {}) =>
  renderWithProviders(<DetailHarness isOwnProfile={isOwnProfile} />, {
    preloadedState: viewer(viewerRole, viewerId),
  });

const piiSwitch = () => screen.findByRole("switch", { name: "Guruhda mijoz ismi va telefoni" });

beforeEach(() => {
  server.user = makeUser("market", { tg_group_show_customer_pii: true }) as unknown as Record<string, unknown>;
  server.patchError = null;
  http.get.mockClear();
  http.patch.mockClear();
});

describe("MarketTelegramGroupPiiCard", () => {
  it("shows the switch with its label, hint and the instant-save note", async () => {
    renderDetail("superadmin");

    const control = await piiSwitch();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toHaveAccessibleDescription(
      "O'chirilsa, Telegram guruhidagi buyurtma kartalarida mijoz ismi va telefoni yashiriladi",
    );
    expect(screen.getByRole("heading", { name: "Telegram guruhi" })).toBeInTheDocument();
    expect(screen.getByText("O'zgarish darhol saqlanadi")).toBeInTheDocument();
  });

  it("treats a missing field as on (backend default true)", async () => {
    const { tg_group_show_customer_pii: _omit, ...withoutField } = server.user;
    void _omit;
    server.user = withoutField;
    renderDetail("admin");

    expect(await piiSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("toggles immediately without a confirm, PATCHes, refetches the user and shows «Saqlandi»", async () => {
    const user = userEvent.setup();
    renderDetail("superadmin");
    const control = await piiSwitch();
    const getsBefore = http.get.mock.calls.length;

    await user.click(control);

    // Tasdiq oynasi yo'q — kalit darhol o'zgaradi.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(control).toHaveAttribute("aria-checked", "false");
    await waitFor(() =>
      expect(http.patch).toHaveBeenCalledWith("markets/201/telegram-group-pii", {
        tg_group_show_customer_pii: false,
      }),
    );
    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
    expect(
      screen.getByText("Guruhdagi buyurtma kartalarida mijoz ismi va telefoni yashiriladi"),
    ).toBeInTheDocument();
    // Foydalanuvchi so'rovi qayta o'qildi va server qiymati ko'rinadi.
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(getsBefore));
    expect(control).toHaveAttribute("aria-checked", "false");

    // Qayta yoqish — teskari qiymat yuboriladi.
    await user.click(control);
    await waitFor(() =>
      expect(http.patch).toHaveBeenLastCalledWith("markets/201/telegram-group-pii", {
        tg_group_show_customer_pii: true,
      }),
    );
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "true"));
  });

  it("reverts the switch and shows the backend message when the PATCH fails", async () => {
    server.patchError = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 403,
      data: { message: "Market faqat o'z Telegram guruhi sozlamasini o'zgartira oladi" },
    } as AxiosResponse);
    const user = userEvent.setup();
    renderDetail("superadmin");
    const control = await piiSwitch();

    await user.click(control);

    expect(await screen.findByText("Saqlanmadi")).toBeInTheDocument();
    expect(
      screen.getByText("Market faqat o'z Telegram guruhi sozlamasini o'zgartira oladi"),
    ).toBeInTheDocument();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Saqlandi")).not.toBeInTheDocument();
  });

  it.each(["superadmin", "admin"])("%s can change it", async (role) => {
    renderDetail(role);
    expect(await piiSwitch()).toBeEnabled();
  });

  it("the market can change it on its own profile", async () => {
    renderDetail("market", { isOwnProfile: true, viewerId: "999" });
    expect(await piiSwitch()).toBeEnabled();
  });

  it("the market can change it when the page is its own user record", async () => {
    renderDetail("market", { viewerId: "201" });
    expect(await piiSwitch()).toBeEnabled();
  });

  it("another market cannot change it", async () => {
    renderDetail("market", { viewerId: "202" });
    expect(await piiSwitch()).toBeDisabled();
  });

  it.each(["manager", "registrator"])("%s sees the state read-only and cannot PATCH", async (role) => {
    const user = userEvent.setup();
    renderDetail(role);
    const control = await piiSwitch();

    expect(control).toBeDisabled();
    await user.click(control);
    expect(http.patch).not.toHaveBeenCalled();
    expect(control).toHaveAttribute("aria-checked", "true");
  });
});

describe("UserDetailWidget — Telegram group PII card", () => {
  const renderWidget = (user: User, viewerRole: string, isOwnProfile = false) =>
    renderWithProviders(
      <UserDetailWidget user={user} isLoading={false} isError={false} isOwnProfile={isOwnProfile} />,
      { preloadedState: viewer(viewerRole) },
    );

  it("is shown for a market user", () => {
    renderWidget(makeUser("market", { tg_group_show_customer_pii: false }), "admin");

    expect(screen.getByTestId("market-tg-group-pii-card")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("is shown on the market's own profile", () => {
    renderWidget(makeUser("market"), "market", true);

    expect(screen.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toBeEnabled();
  });

  it.each<UserRole>(["courier", "manager", "admin", "registrator"])("is not shown for a %s user", (role) => {
    renderWidget(makeUser(role), "superadmin");

    expect(screen.queryByTestId("market-tg-group-pii-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).not.toBeInTheDocument();
  });
});
