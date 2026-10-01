import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NewOrderDetail from "./new_orderDetail";

const mocks = vi.hoisted(() => ({
  receiveMutate: vi.fn(),
  transferMutate: vi.fn(),
  orders: [
    {
      id: "o1",
      status: "new",
      where_deliver: "address",
      total_price: 50000,
      paid_amount: 0,
      to_be_paid: 50000,
      createdAt: "2026-10-01T08:00:00.000Z",
      comment: null,
      address: "Toshkent",
      items: [],
      customer: { id: "c1", name: "Ali", phone_number: "+998901112233" },
    },
    {
      id: "o2",
      status: "new",
      where_deliver: "center",
      total_price: 70000,
      paid_amount: 0,
      to_be_paid: 70000,
      createdAt: "2026-10-01T09:00:00.000Z",
      comment: null,
      address: "Toshkent",
      items: [],
      customer: { id: "c2", name: "Vali", phone_number: "+998901112244" },
    },
  ],
}));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetTodayOrdersByMarket: () => ({ data: { data: mocks.orders }, isLoading: false, refetch: vi.fn() }),
    deleteOrder: { mutate: vi.fn(), isPending: false },
    createReceiveOrder: { mutate: mocks.receiveMutate, isPending: false },
    createTransferBatch: { mutate: mocks.transferMutate, isPending: false },
  }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

const stateFor = (role: string, branchType?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const receiveAllOrders = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Qabul qilish — 2 ta buyurtma" }));
  await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));
};

describe("NewOrderDetail — 'Qabul qilish' endpointi", () => {
  beforeEach(() => {
    mocks.receiveMutate.mockReset();
    mocks.transferMutate.mockReset();
  });

  it("HQ registratori POST /orders/receive (createReceiveOrder) ishlatadi", async () => {
    renderWithProviders(<NewOrderDetail />, { preloadedState: stateFor("registrator", "HQ") });

    await receiveAllOrders();

    await waitFor(() =>
      expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o1", "o2"] }, expect.any(Object)),
    );
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });

  it("HQ menejeri ham POST /orders/receive ishlatadi", async () => {
    renderWithProviders(<NewOrderDetail />, { preloadedState: stateFor("manager", "HQ") });

    await receiveAllOrders();

    await waitFor(() => expect(mocks.receiveMutate).toHaveBeenCalledTimes(1));
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });

  it.each(["HYBRID", "PICKUP"])("%s registratori hozirgidek transfer-batches ishlatadi", async (branchType) => {
    renderWithProviders(<NewOrderDetail />, { preloadedState: stateFor("registrator", branchType) });

    await receiveAllOrders();

    await waitFor(() =>
      expect(mocks.transferMutate).toHaveBeenCalledWith({ orderIds: ["o1", "o2"] }, expect.any(Object)),
    );
    expect(mocks.receiveMutate).not.toHaveBeenCalled();
  });

  it("superadmin hozirgidek POST /orders/receive ishlatadi", async () => {
    renderWithProviders(<NewOrderDetail />, { preloadedState: stateFor("superadmin") });

    await receiveAllOrders();

    await waitFor(() => expect(mocks.receiveMutate).toHaveBeenCalledTimes(1));
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });
});
