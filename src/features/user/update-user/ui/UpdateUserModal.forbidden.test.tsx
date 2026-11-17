import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";

/**
 * KQINMdeQ: menejer huquqi backend'da har so'rovda (hozirgi filial bo'yicha) tekshiriladi. Oyna ochiq turganda xodim
 * boshqa filialga o'tkazilsa — `PATCH /users/:id` 403: xabar (backend matni) chiqadi, oyna yopiladi, shu
 * foydalanuvchi tafsiloti keshi tozalanib qayta so'raladi (sahifa yangi holatni ko'rsatadi), ro'yxat eskiradi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  user: "user",
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({ useGetDistricts: () => ({ data: [], isLoading: false, isError: false }) }),
}));

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const registrator = (overrides: Partial<User> = {}): User => ({
  id: "300",
  name: "Kamola Rustamova",
  phone_number: "+998938061952",
  username: "kamola",
  role: "registrator",
  status: "active",
  salary: 4_200_000,
  payment_day: "25",
  createdAt: "2026-09-09T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
  is_deleted: false,
  tariff_home: null,
  tariff_center: null,
  default_tariff: "home",
  can_manage: true,
  ...overrides,
});

const renderModal = (target: User, onClose = vi.fn()) =>
  renderWithProviders(<UpdateUserModal userId={target.id} initialUser={target} onClose={onClose} />, {
    preloadedState: {
      role: { id: "25", role: "manager", region: null, name: "Menejer" },
      user: {
        user: { id: "25", role: "manager" },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never,
  });

const DETAIL_KEY = ["user", "detail", "300", undefined] as const;
const OTHER_DETAIL_KEY = ["user", "detail", "301", undefined] as const;
const LIST_KEY = ["user", { page: 1 }] as const;

beforeEach(() => {
  mocks.updateUser.mockReset();
});

describe("UpdateUserModal — saqlashda 403 (KQINMdeQ)", () => {
  it("⭐ xabar chiqadi, oyna yopiladi, tafsilot keshi tozalanadi, ro'yxat eskiradi", async () => {
    mocks.updateUser.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { statusCode: 403, message: "Siz bu foydalanuvchini boshqara olmaysiz" } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { queryClient } = renderModal(registrator(), onClose);
    queryClient.setQueryData(DETAIL_KEY, { data: registrator() });
    queryClient.setQueryData(OTHER_DETAIL_KEY, { data: registrator({ id: "301" }) });
    queryClient.setQueryData(LIST_KEY, { items: [] });

    const name = screen.getByRole("textbox", { name: /Ism/ });
    await user.clear(name);
    await user.type(name, "Kamola Rustamova Yangi");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Siz bu foydalanuvchini boshqara olmaysiz")).toBeInTheDocument();
    // Shu foydalanuvchi tafsiloti — eski ma'lumotsiz (sahifa xato / yangi holatni ko'rsatadi).
    await waitFor(() => expect(queryClient.getQueryData(DETAIL_KEY)).toBeUndefined());
    // Boshqa foydalanuvchi tafsiloti tegilmaydi (faqat eskiradi), ro'yxat eskiradi.
    expect(queryClient.getQueryData(OTHER_DETAIL_KEY)).toBeDefined();
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  });

  it("400 (boshqa xato) — oyna ochiq qoladi, kesh tegilmaydi", async () => {
    mocks.updateUser.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, message: "Noto'g'ri qiymat" } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { queryClient } = renderModal(registrator(), onClose);
    queryClient.setQueryData(DETAIL_KEY, { data: registrator() });

    const name = screen.getByRole("textbox", { name: /Ism/ });
    await user.clear(name);
    await user.type(name, "Kamola Yangi");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("Noto'g'ri qiymat")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(DETAIL_KEY)).toBeDefined();
  });
});
