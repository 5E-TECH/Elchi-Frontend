import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";
import { extractNotReceivedOrderIds, hasOnTheRoadOrders } from "./lib/receiveResult";

/**
 * fix3b LC-11 — PATCH /post/receive/:id endi yuqori darajada
 * `not_received_order_ids` va `failures` qaytaradi:
 *  - qabul qilinmagan buyurtmalar "qabul qilindi" deb yashirilmaydi,
 *    ogohlantirishda sanab o'tiladi;
 *  - RECEIVED (eski) pochtada hamon yo'lda buyurtma bo'lsa, qabul qiluvchiga
 *    qabul qilish qayta ochiladi.
 */

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  receivePostMutateAsync: vi.fn(),
  receiveCanceledMutateAsync: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetRefusedMailsCourierByPostId: () => ({ data: undefined, isLoading: false, isError: false }),
  }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: mocks.receivePostMutateAsync, isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: mocks.receiveCanceledMutateAsync, isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../entities/batch", () => ({
  useBatchRemainingDetail: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendTransferBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({ SendToPost: { mutateAsync: vi.fn(), isPending: false } }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({ useOrderQrScanner: () => undefined }));

vi.mock("./ui/OrdersTable", () => ({
  default: ({
    orders,
    onToggleAll,
    readOnly,
  }: {
    orders: Array<{ id: string }>;
    onToggleAll: () => void;
    readOnly?: boolean;
  }) => (
    <div>
      <span data-testid="orders-count">{orders.length}</span>
      <span data-testid="orders-ids">{orders.map((order) => order.id).join(",")}</span>
      <span data-testid="orders-readonly">{String(Boolean(readOnly))}</span>
      <button type="button" onClick={onToggleAll}>
        test-select-all
      </button>
    </div>
  ),
}));

const POST_ID = "7";

const order = (id: string, status: string) => ({
  id,
  status,
  region_id: "12",
  where_deliver: "address",
  total_price: 100000,
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
});

const managerState = {
  role: { id: "300", role: "manager", region: null, name: "Menejer" },
  user: {
    user: { id: "300", role: "manager", branch: { id: "15", type: "REGIONAL" } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const superadminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Superadmin" },
} as never;

const withOrders = (rows: ReturnType<typeof order>[]) => {
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: rows } } : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: rows } } }),
  }));
};

const renderPage = (preloadedState: never, route = `/mails/${POST_ID}`) =>
  renderWithProviders(
    <Routes>
      <Route path="/mails/:id" element={<MailDetailPage />} />
    </Routes>,
    { route, preloadedState },
  );

describe("receiveResult helpers (fix3b LC-11)", () => {
  it("yuqori darajadagi not_received_order_ids o'qiladi; data massivi ta'sir qilmaydi", () => {
    expect(
      extractNotReceivedOrderIds({
        statusCode: 200,
        data: [{ id: "101" }],
        failures: [{ order_id: "102", error: "timeout" }, { order_id: "999", error: "branch" }],
        not_received_order_ids: ["102", 102, ""],
      }),
    ).toEqual(["102"]);
    expect(extractNotReceivedOrderIds({ statusCode: 200, data: [] })).toEqual([]);
    expect(extractNotReceivedOrderIds(undefined)).toEqual([]);
  });

  it("hasOnTheRoadOrders", () => {
    expect(hasOnTheRoadOrders([{ status: "waiting" }, { status: "on the road" }])).toBe(true);
    expect(hasOnTheRoadOrders([{ status: "waiting" }])).toBe(false);
  });
});

describe("MailDetailPage — qisman qabul (fix3b LC-11)", () => {
  beforeEach(() => {
    mocks.receivePostMutateAsync.mockReset();
    withOrders([order("101", "on the road"), order("102", "on the road"), order("103", "on the road")]);
  });

  it("qabul qilinmagan buyurtmalar ro'yxatda qoladi va ogohlantirishda sanaladi", async () => {
    const user = userEvent.setup();
    mocks.receivePostMutateAsync.mockResolvedValue({
      statusCode: 200,
      message: "Pochta qisman qabul qilindi: 1 ta buyurtmani qabul qilib bo'lmadi — qayta urinib ko'ring",
      data: [{ id: "101" }, { id: "103" }],
      failures: [{ order_id: "102", error: "timeout" }],
      not_received_order_ids: ["102"],
    });
    renderPage(managerState);

    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochta qabul qilish/ }));

    await waitFor(() =>
      expect(mocks.receivePostMutateAsync).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { order_ids: ["101", "102", "103"] },
      }),
    );
    expect(await screen.findByText("1 ta buyurtma qabul qilinmadi")).toBeInTheDocument();
    expect(screen.getByText(/Hamon yo'lda: #102/)).toBeInTheDocument();
    expect(screen.getByText("2 ta buyurtma qabul qilindi.")).toBeInTheDocument();
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102$/);
  });

  it("hammasi qabul qilinsa — oddiy muvaffaqiyat, ogohlantirish yo'q", async () => {
    const user = userEvent.setup();
    mocks.receivePostMutateAsync.mockResolvedValue({
      statusCode: 200,
      message: "Post received successfully",
      data: [{ id: "101" }, { id: "102" }, { id: "103" }],
      failures: [],
      not_received_order_ids: [],
    });
    renderPage(managerState);

    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochta qabul qilish/ }));

    expect(await screen.findByText("Pochta muvaffaqiyatli qabul qilindi.")).toBeInTheDocument();
    expect(screen.queryByText(/qabul qilinmadi/)).not.toBeInTheDocument();
    expect(screen.getByTestId("orders-count")).toHaveTextContent("0");
  });

  it("qabul rad etilsa — backend sababi, buyurtmalar joyida", async () => {
    const user = userEvent.setup();
    mocks.receivePostMutateAsync.mockRejectedValue({
      response: { status: 400, data: { message: "Cannot receive post with this status" } },
    });
    renderPage(managerState);

    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochta qabul qilish/ }));

    expect(await screen.findByText("Cannot receive post with this status")).toBeInTheDocument();
    expect(screen.getByTestId("orders-count")).toHaveTextContent("3");
  });
});

describe("MailDetailPage — RECEIVED pochtadagi yo'ldagi qoldiq (fix3b LC-11)", () => {
  beforeEach(() => {
    mocks.receivePostMutateAsync.mockReset();
  });

  it("menejer eski pochtada yo'ldagi buyurtmani qabul qila oladi", async () => {
    const user = userEvent.setup();
    withOrders([order("101", "waiting"), order("102", "on the road")]);
    mocks.receivePostMutateAsync.mockResolvedValue({ statusCode: 200, data: [{ id: "102" }], not_received_order_ids: [] });
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByRole("note")).toHaveTextContent(/1 ta buyurtma hali yo'lda/);
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102$/);
    expect(screen.getByTestId("orders-readonly")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochta qabul qilish/ }));

    await waitFor(() =>
      expect(mocks.receivePostMutateAsync).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["102"] } }),
    );
  });

  it("yo'ldagi buyurtmasi yo'q eski pochta avvalgidek faqat ko'rish uchun", async () => {
    withOrders([order("101", "waiting"), order("102", "sold")]);
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Pochta qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("qabul qiluvchi bo'lmagan superadmin uchun eski pochta o'zgarmaydi", async () => {
    withOrders([order("101", "waiting"), order("102", "on the road")]);
    renderPage(superadminState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Pochta qabul qilish/ })).not.toBeInTheDocument();
  });
});
