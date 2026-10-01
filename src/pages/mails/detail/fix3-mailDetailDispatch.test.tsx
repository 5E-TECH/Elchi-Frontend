import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Branch } from "../../../entities/branch";
import MailDetailPage from "./index";
import { resolveDispatchRegionId } from "./lib/dispatchRegion";

const mocks = vi.hoisted(() => ({
  getDispatchDestinations: vi.fn(),
  useMailDetail: vi.fn(),
  tableProps: { last: null as null | { canDelete?: boolean } },
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: mocks.getDispatchDestinations,
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetRefusedMailsCourierByPostId: () => ({ data: undefined, isLoading: false, isError: false }),
  }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
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

vi.mock("./ui/OrdersTable", () => ({
  default: (props: { orders: Array<{ id: string }>; onToggleAll: () => void; canDelete?: boolean }) => {
    mocks.tableProps.last = props;
    return (
      <div>
        <span data-testid="orders-count">{props.orders.length}</span>
        <button type="button" onClick={props.onToggleAll}>
          test-select-all
        </button>
      </div>
    );
  },
}));

const POST_ID = "7";
const GEO_REGION = "12";
const POST_REGION = "20";

// Tuman (Guliston) geografik jihatdan 12-viloyatda, lekin admin uni 20-viloyatga
// biriktirgan — HQ qabuli uni 20-viloyat pochtasiga joylagan.
const order = (id: string) => ({
  id,
  status: "received",
  region_id: GEO_REGION,
  where_deliver: "address",
  total_price: 100000,
  district: {
    id: "5",
    name: "Guliston",
    region_id: GEO_REGION,
    assigned_region: POST_REGION,
    region: { name: "Sirdaryo" },
  },
});

const branch = (id: string, regionId: string, name: string): Branch => ({
  id,
  name,
  type: "REGIONAL",
  status: "active",
  has_manager: true,
  manager: { id: "300", name: "Menejer" },
  manager_id: "300",
  phone_number: "+998903009002",
  region: { id: regionId, name: regionId === POST_REGION ? "Jizzax" : "Sirdaryo" },
  district: { id: "", name: "—" },
  address: "—",
  employees_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
});

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

const renderPage = (
  preloadedState: never,
  route: string | { pathname: string; state?: unknown } = `/mails/${POST_ID}`,
) =>
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

describe("resolveDispatchRegionId (fix3 LC-09)", () => {
  it("pochtaning o'z viloyati birinchi o'rinda", () => {
    expect(resolveDispatchRegionId(POST_REGION, [order("1")] as never)).toBe(POST_REGION);
  });

  it("navigatsiya holati bo'lmasa — tumanning assigned_region i", () => {
    expect(resolveDispatchRegionId("", [order("1")] as never)).toBe(POST_REGION);
    expect(
      resolveDispatchRegionId(undefined, [
        { ...order("1"), district: { id: "5", name: "X", region_id: GEO_REGION, assignedToRegion: { id: "33" } } },
      ] as never),
    ).toBe("33");
  });

  it("assigned_region ham bo'lmasa — avvalgidek geografik viloyat", () => {
    expect(
      resolveDispatchRegionId("", [
        { ...order("1"), district: { id: "5", name: "X", region_id: GEO_REGION } },
      ] as never),
    ).toBe(GEO_REGION);
    expect(resolveDispatchRegionId("", [])).toBe("");
  });
});

describe("MailDetailPage — qayta biriktirilgan tuman pochtasi (fix3 LC-09)", () => {
  beforeEach(() => {
    mocks.tableProps.last = null;
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId ? { data: { allOrdersByPostId: [order("101"), order("102")] } } : undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: [] } } }),
    }));
    mocks.getDispatchDestinations.mockResolvedValue(
      destinations([branch("15", GEO_REGION, "Eski viloyat filiali"), branch("21", POST_REGION, "Yangi viloyat filiali")]),
    );
  });

  it("ro'yxatdan kelganda pochtaning viloyati bo'yicha filiallar chiqadi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("registrator", "HQ"), {
      pathname: `/mails/${POST_ID}`,
      state: { fromTab: "today", fallbackRegionId: POST_REGION, fallbackRegionName: "Yangi viloyat" },
    });

    await selectAllAndSend(user);

    await waitFor(() =>
      expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: POST_REGION }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Yangi viloyat filiali")).toBeInTheDocument();
    expect(within(dialog).queryByText("Eski viloyat filiali")).not.toBeInTheDocument();
  });

  it("to'g'ridan-to'g'ri havolada (holatsiz) tumanning assigned_region i ishlatiladi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("superadmin"));

    await selectAllAndSend(user);

    await waitFor(() =>
      expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: POST_REGION }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("MailDetailPage — SA 'pochtadan olib tashlash' yashirilgan (fix3 C5)", () => {
  beforeEach(() => {
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId ? { data: { allOrdersByPostId: [order("101")] } } : undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  });

  it("superadmin uchun ham canDelete=false (POST /post/cancel doim 403 berardi)", () => {
    renderPage(stateFor("superadmin"));

    expect(screen.getByTestId("orders-count")).toHaveTextContent("1");
    expect(mocks.tableProps.last?.canDelete).toBe(false);
  });
});
