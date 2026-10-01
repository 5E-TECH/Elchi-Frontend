import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Branch } from "../../../entities/branch";
import MailDetailPage from "./index";

const mocks = vi.hoisted(() => ({
  getDispatchDestinations: vi.fn(),
  getBranches: vi.fn(),
  getActiveManagerBranchIds: vi.fn(),
  useMailDetail: vi.fn(),
  useRefusedByPostId: vi.fn(),
  dispatchMutateAsync: vi.fn(),
  receivePostMutateAsync: vi.fn(),
  receiveCanceledMutateAsync: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: mocks.getDispatchDestinations,
  getBranches: mocks.getBranches,
  getActiveManagerBranchIds: mocks.getActiveManagerBranchIds,
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefusedByPostId }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: mocks.receivePostMutateAsync, isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: mocks.receiveCanceledMutateAsync, isPending: false }),
  useDispatchPostToBranch: () => ({
    mutateAsync: mocks.dispatchMutateAsync,
    isPending: false,
    reset: vi.fn(),
  }),
}));

vi.mock("../../../entities/batch", () => ({
  useBatchRemainingDetail: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendTransferBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({ SendToPost: { mutateAsync: vi.fn(), isPending: false } }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

// Jadval o'rniga yengil stub: sahifa mantig'i (tanlash → tugma → modal) tekshiriladi.
vi.mock("./ui/OrdersTable", () => ({
  default: ({ orders, onToggleAll }: { orders: Array<{ id: string }>; onToggleAll: () => void }) => (
    <div>
      <span data-testid="orders-count">{orders.length}</span>
      <button type="button" onClick={onToggleAll}>
        test-select-all
      </button>
    </div>
  ),
}));

const POST_ID = "7";
const REGION_ID = "12";

const order = (id: string, status = "received") => ({
  id,
  status,
  region_id: REGION_ID,
  where_deliver: "address",
  total_price: 100000,
  district: { id: "5", name: "Guliston", region_id: REGION_ID, region: { name: "Sirdaryo" } },
});

const branch15: Branch = {
  id: "15",
  name: "E2E Filial Sirdaryo",
  type: "REGIONAL",
  status: "active",
  has_manager: true,
  manager: { id: "300", name: "Sirdaryo menejeri" },
  manager_id: "300",
  phone_number: "+998903009002",
  region: { id: REGION_ID, name: "Sirdaryo" },
  district: { id: "", name: "—" },
  address: "—",
  employees_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
};

const destinations = (items: Branch[]) => ({ data: items, total: items.length, page: 1, limit: 10 });

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

const renderPage = (preloadedState: never, route = `/mails/${POST_ID}`) =>
  renderWithProviders(
    <Routes>
      <Route path="/mails/:id" element={<MailDetailPage />} />
      <Route path="*" element={<div data-testid="navigated-away" />} />
    </Routes>,
    { route, preloadedState },
  );

const selectAllAndSend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "test-select-all" }));
  await user.click(screen.getByRole("button", { name: /Pochtani jo'natish/ }));
};

describe("MailDetailPage — pochtani filialga jo'natish", () => {
  beforeEach(() => {
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId ? { data: { allOrdersByPostId: [order("101"), order("102")] } } : undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: [] } } }),
    }));
    mocks.useRefusedByPostId.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.getDispatchDestinations.mockResolvedValue(destinations([branch15]));
    mocks.dispatchMutateAsync.mockResolvedValue({ statusCode: 200 });
  });

  it("HQ registratori: faqat getDispatchDestinations chaqiriladi, modal filialni ko'rsatadi, submit dispatch qiladi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("registrator", "HQ"));

    await selectAllAndSend(user);

    await waitFor(() => expect(mocks.getDispatchDestinations).toHaveBeenCalledTimes(1));
    expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: REGION_ID });
    expect(mocks.getBranches).not.toHaveBeenCalled();
    expect(mocks.getActiveManagerBranchIds).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Filialni tanlang")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /E2E Filial Sirdaryo/ }));
    await user.click(within(dialog).getByRole("button", { name: /^Jo'natish/ }));

    await waitFor(() =>
      expect(mocks.dispatchMutateAsync).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { destinationBranchId: "15", orderIds: ["101", "102"] },
      }),
    );
  });

  it("superadmin uchun jo'natish yo'li ishlaydi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("superadmin"));

    await selectAllAndSend(user);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("E2E Filial Sirdaryo")).toBeInTheDocument();
    expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: REGION_ID });
  });

  it.each(["REGIONAL", "HYBRID", "PICKUP"])(
    "%s registratorida jo'natish tugmasi va modal yo'q (server doim 403 berardi)",
    (branchType) => {
      renderPage(stateFor("registrator", branchType));

      expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
      expect(screen.queryByRole("button", { name: /Pochtani jo'natish/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Pochta qabul qilish/ })).not.toBeInTheDocument();
      expect(mocks.getDispatchDestinations).not.toHaveBeenCalled();
    },
  );

  it("backend rad etsa — backend xabari ko'rinadi", async () => {
    const user = userEvent.setup();
    mocks.getDispatchDestinations.mockRejectedValue({
      response: { status: 403, data: { message: "Pochta jo'natish uchun ruxsat yo'q" } },
    });
    renderPage(stateFor("registrator", "HQ"));

    await selectAllAndSend(user);

    expect(await screen.findByText("Pochta jo'natish uchun ruxsat yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("xabarsiz xatoda — 'Filiallarni yuklab bo'lmadi'", async () => {
    const user = userEvent.setup();
    mocks.getDispatchDestinations.mockRejectedValue({});
    renderPage(stateFor("registrator", "HQ"));

    await selectAllAndSend(user);

    expect(await screen.findByText("Filiallarni yuklab bo'lmadi.")).toBeInTheDocument();
  });

  it("viloyatda mos filial bo'lmasa — 'aktiv filial yo'q' xabari, modal ochilmaydi", async () => {
    const user = userEvent.setup();
    mocks.getDispatchDestinations.mockResolvedValue(
      destinations([{ ...branch15, id: "16", region: { id: "99", name: "Boshqa" } }]),
    );
    renderPage(stateFor("registrator", "HQ"));

    await selectAllAndSend(user);

    expect(await screen.findByText("Bu viloyatda aktiv filial mavjud emas.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("MailDetailPage — bekor qilingan pochta (o'zgarmagan)", () => {
  beforeEach(() => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefusedByPostId.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("201", "cancelled"), order("202", "cancelled")] } : undefined,
      isLoading: false,
      isError: false,
    }));
    mocks.receiveCanceledMutateAsync.mockResolvedValue({ statusCode: 200 });
  });

  it("HQ registratori bekor qilingan pochtani qabul qiladi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("registrator", "HQ"), `/mails/${POST_ID}?type=refused`);

    await user.click(await screen.findByRole("button", { name: "test-select-all" }));
    const receiveButton = screen.getByRole("button", { name: /Pochta qabul qilish/ });
    expect(receiveButton).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Pochtani jo'natish/ })).not.toBeInTheDocument();

    await user.click(receiveButton);

    await waitFor(() =>
      expect(mocks.receiveCanceledMutateAsync).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { order_ids: ["201", "202"] },
      }),
    );
    expect(mocks.getDispatchDestinations).not.toHaveBeenCalled();
  });

  it("REGIONAL registratorida qabul tugmasi avvalgidek ko'rinadi, lekin o'chiq", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("registrator", "REGIONAL"), `/mails/${POST_ID}?type=refused`);

    await user.click(await screen.findByRole("button", { name: "test-select-all" }));

    expect(screen.getByRole("button", { name: /Pochta qabul qilish/ })).toBeDisabled();
  });
});
