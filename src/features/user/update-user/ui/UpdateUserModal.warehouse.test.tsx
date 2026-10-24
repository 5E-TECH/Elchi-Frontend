import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";

/**
 * yXC91RRx — market tahririda «Ombordan buyurtma yaratish» kaliti (maket `superadmin-users-edit-market-warehouse`):
 * faqat superadmin/admin; o'zgarsa `PATCH /markets/:id/warehouse-order { can_order_from_warehouse }`.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), patch: vi.fn(), onClose: vi.fn() }));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../../../shared/api/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../shared/api/api")>();
  return { ...actual, api: { ...actual.api, patch: mocks.patch } };
});

const market = (overrides: Partial<User> = {}): User => ({
  id: "121",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  ...overrides,
});

const renderAs = (viewerRole: string, user: User) =>
  renderWithProviders(<UpdateUserModal userId={user.id} initialUser={user} onClose={mocks.onClose} />, {
    preloadedState: {
      role: { id: "1", role: viewerRole, region: null, name: viewerRole },
      user: { user: { id: "1", role: viewerRole }, isAuthenticated: true, accessToken: null, loading: false, isAppInitializing: false, error: null },
    } as never,
  });

beforeEach(() => {
  mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
  mocks.patch.mockReset().mockResolvedValue({ data: { statusCode: 200, data: { can_order_from_warehouse: true } } });
  mocks.onClose.mockReset();
});

describe("UpdateUserModal — «Ombordan buyurtma yaratish» (yXC91RRx)", () => {
  it.each(["superadmin", "admin"])("%s: «Ombor» bo'limi va kalit (sukut o'chiq)", async (role) => {
    renderAs(role, market());
    const toggle = await screen.findByRole("switch", { name: "Ombordan buyurtma yaratish" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Sukut — o'chiq/)).toBeInTheDocument();
  });

  it("menejer: kalit yo'q (faqat superadmin/admin)", async () => {
    renderAs("manager", market());
    await screen.findByRole("textbox", { name: /Market nomi/ });
    expect(screen.queryByRole("switch", { name: "Ombordan buyurtma yaratish" })).not.toBeInTheDocument();
  });

  it("market bo'lmagan foydalanuvchida kalit yo'q", async () => {
    renderAs("superadmin", market({ role: "courier", id: "263", name: "Kuryer" }));
    await screen.findByRole("textbox", { name: /Ism/ });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("faqat kalit o'zgarsa — PATCH /users yo'q, PATCH markets/:id/warehouse-order va oyna yopiladi", async () => {
    const user = userEvent.setup();
    renderAs("superadmin", market());
    await user.click(await screen.findByRole("switch", { name: "Ombordan buyurtma yaratish" }));
    expect(screen.getByRole("switch", { name: "Ombordan buyurtma yaratish" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("markets/121/warehouse-order", { can_order_from_warehouse: true }),
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.onClose).toHaveBeenCalled());
    expect(await screen.findByText("«Ombordan buyurtma yaratish» yoqildi")).toBeInTheDocument();
  });

  it("yoqilgan kalitni o'chirish; boshqa maydon ham o'zgarsa — avval PATCH /users, so'ng kalit", async () => {
    const user = userEvent.setup();
    renderAs("admin", market({ can_order_from_warehouse: true }));
    const toggle = await screen.findByRole("switch", { name: "Ombordan buyurtma yaratish" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    const name = screen.getByRole("textbox", { name: /Market nomi/ });
    await user.clear(name);
    await user.type(name, "Baraka Market");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("markets/121/warehouse-order", { can_order_from_warehouse: false }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "121", data: expect.objectContaining({ name: "Baraka Market" }) });
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.patch.mock.invocationCallOrder[0]);
  });

  it("kalit saqlanmasa — xato xabari, oyna ochiq", async () => {
    mocks.patch.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { response: { status: 403, data: { message: "Forbidden" } } }));
    const user = userEvent.setup();
    renderAs("superadmin", market());
    await user.click(await screen.findByRole("switch", { name: "Ombordan buyurtma yaratish" }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await screen.findByText("Ombor kaliti saqlanmadi")).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });
});
