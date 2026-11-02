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
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

const order = (id: string, status: string, history?: { in_post_now: boolean; current_post_id?: string | null }) => ({
  id,
  status,
  region_id: "12",
  where_deliver: "address",
  total_price: 100000,
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
  ...history,
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

const COURIER_ID = "500";
const courierState = {
  role: { id: COURIER_ID, role: "courier", region: null, name: "Kuryer" },
  user: {
    user: { id: COURIER_ID, role: "courier", branch: { id: "15", type: "REGIONAL" } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

/** `data.post` — pochtaning o'z ma'lumoti (qabul qiluvchini aniqlash: `courier_id`). */
type PostMeta = { id: string; status: string; courier_id?: string | null; view?: string };

const withOrders = (rows: ReturnType<typeof order>[], post?: PostMeta) => {
  const { view, ...postMeta } = post ?? ({} as PostMeta);
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId
      ? { data: { allOrdersByPostId: rows, ...(post ? { post: postMeta } : {}), ...(view ? { view } : {}) } }
      : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: rows } } }),
  }));
};

const renderPage = (preloadedState: never, route: string | { pathname: string; state?: unknown } = `/mails/${POST_ID}`) =>
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

  it("hasOnTheRoadOrders — faqat hozir pochtadagi qator (#618: sobiq a'zo sanalmaydi)", () => {
    expect(hasOnTheRoadOrders([{ status: "on the road", in_post_now: false }])).toBe(false);
    expect(hasOnTheRoadOrders([{ status: "on the road", in_post_now: true }])).toBe(true);
    expect(hasOnTheRoadOrders([{ status: "on the road", in_post_now: null }])).toBe(true);
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
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));

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
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));

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
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));

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
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));

    await waitFor(() =>
      expect(mocks.receivePostMutateAsync).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["102"] } }),
    );
  });

  it("yo'ldagi buyurtmasi yo'q eski pochta avvalgidek faqat ko'rish uchun", async () => {
    withOrders([order("101", "waiting"), order("102", "sold")]);
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("qabul qiluvchi bo'lmagan superadmin uchun eski pochta o'zgarmaydi", async () => {
    withOrders([order("101", "waiting"), order("102", "on the road")]);
    renderPage(superadminState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
  });
});

describe("MailDetailPage — eski pochta va server sukuti view=all (vaICniE4, backend #618)", () => {
  beforeEach(() => {
    mocks.receivePostMutateAsync.mockReset();
    mocks.useMailDetail.mockClear();
  });

  it("eski pochta view'siz so'raladi (server sukuti), holatsiz havola — view=current", () => {
    withOrders([order("101", "waiting")], { id: POST_ID, status: "received", courier_id: "0" });
    const { unmount } = renderPage(managerState, `/mails/${POST_ID}?view=old`);
    expect(mocks.useMailDetail).toHaveBeenCalledWith(POST_ID, { view: undefined });
    expect(mocks.useMailDetail).not.toHaveBeenCalledWith(POST_ID, { view: "current" });
    unmount();

    mocks.useMailDetail.mockClear();
    renderPage(managerState);
    expect(mocks.useMailDetail).toHaveBeenCalledWith(POST_ID, { view: "current" });
  });

  it("sobiq a'zo (in_post_now: false) boshqa pochtada yo'lda bo'lsa ham qabul qayta ochilmaydi — «Faqat o'qish»", async () => {
    withOrders(
      [
        order("101", "waiting", { in_post_now: true }),
        order("102", "on the road", { in_post_now: false, current_post_id: "88" }),
      ],
      { id: POST_ID, status: "received", courier_id: "0", view: "all" },
    );
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("mail-read-only")).toHaveTextContent("Faqat o'qish");
    // Tarix — pochtaga kirgan hamma buyurtma (sobiq a'zo ham) ko'rinadi.
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^101,102$/);
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/hali yo'lda/)).not.toBeInTheDocument();
  });

  it("menejer o'z kuryerining qabul qilingan pochtasida (courier_id — kuryer) qolib ketgan qatorni qabul qilmaydi", async () => {
    withOrders(
      [order("101", "waiting", { in_post_now: true }), order("102", "on the road", { in_post_now: true })],
      { id: POST_ID, status: "received", courier_id: "119" },
    );
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("mail-read-only")).toHaveTextContent("Faqat o'qish");
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/hali yo'lda/)).not.toBeInTheDocument();
  });

  it("menejer filial o'tkazmasi pochtasida (courier_id '0') qolib ketgan qatorni qabul qiladi", async () => {
    withOrders(
      [order("101", "waiting", { in_post_now: true }), order("102", "on the road", { in_post_now: true })],
      { id: POST_ID, status: "received", courier_id: "0" },
    );
    renderPage(managerState, `/mails/${POST_ID}?view=old`);

    expect(await screen.findByText("1 ta buyurtma hali yo'lda")).toBeInTheDocument();
    expect(screen.getByTestId("orders-readonly")).toHaveTextContent("false");
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102$/);
  });

  it("kuryerning o'z pochtasi: hozir pochtadagi yo'ldagi qatorlar qabulni qayta ochadi, sobiq a'zo — yo'q (`courier-mails-detail-print-menu`)", async () => {
    const user = userEvent.setup();
    withOrders(
      [
        order("101", "waiting", { in_post_now: true }),
        order("102", "on the road", { in_post_now: true }),
        order("103", "on the road", { in_post_now: true }),
        order("104", "on the road", { in_post_now: false, current_post_id: "88" }),
      ],
      { id: POST_ID, status: "received", courier_id: COURIER_ID },
    );
    mocks.receivePostMutateAsync.mockResolvedValue({ statusCode: 200, data: [], not_received_order_ids: [] });
    renderPage(courierState, { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });

    expect(await screen.findByText("2 ta buyurtma hali yo'lda")).toBeInTheDocument();
    expect(
      screen.getByText("Pochta qabul qilingan deb belgilangan, lekin bu buyurtmalar qabul qilinmagan — ularni qabul qiling."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eski pochtalar/ })).toBeInTheDocument();
    expect(screen.getByTestId("orders-readonly")).toHaveTextContent("false");
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102,103$/);

    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));

    await waitFor(() =>
      expect(mocks.receivePostMutateAsync).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { order_ids: ["102", "103"] },
      }),
    );
  });

  it("kuryer filial o'tkazmasi (courier_id '0') yoki boshqa kuryer pochtasida qabulni qayta ochmaydi", async () => {
    withOrders([order("102", "on the road", { in_post_now: true })], { id: POST_ID, status: "received", courier_id: "0" });
    const { unmount } = renderPage(courierState, `/mails/${POST_ID}?view=old`);
    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
    unmount();

    withOrders([order("102", "on the road", { in_post_now: true })], { id: POST_ID, status: "received", courier_id: "501" });
    renderPage(courierState, `/mails/${POST_ID}?view=old`);
    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
  });

  it("amal rejimida (jo'natish) javobga sobiq a'zo tushib qolsa ham — ro'yxatda va sonda yo'q", async () => {
    withOrders(
      [order("101", "received", { in_post_now: true }), order("102", "received", { in_post_now: false, current_post_id: "88" })],
      { id: POST_ID, status: "new" },
    );
    renderPage(superadminState);

    expect(await screen.findByTestId("orders-ids")).toHaveTextContent(/^101$/);
    expect(screen.getByTestId("mail-detail-sub")).toHaveTextContent(/1 ta buyurtma/);
  });
});

describe("MailDetailPage — holatsiz havola qabul qilingan pochtaga: faqat qabul qiluvchi qabul qiladi (vaICniE4)", () => {
  beforeEach(() => {
    mocks.receivePostMutateAsync.mockReset();
    mocks.useMailDetail.mockClear();
  });

  it("menejer o'z kuryerining qabul qilingan pochtasini holatsiz ochsa (buyurtma / skan havolasi) — faqat o'qish, qabul yo'q", async () => {
    withOrders(
      [order("101", "waiting", { in_post_now: true }), order("102", "on the road", { in_post_now: true })],
      { id: POST_ID, status: "received", courier_id: "119" },
    );
    renderPage(managerState);

    expect(mocks.useMailDetail).toHaveBeenCalledWith(POST_ID, { view: "current" });
    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.getByTestId("mail-read-only")).toHaveTextContent("Faqat o'qish");
    // Yo'ldagi qatorgacha qisqartirilmaydi — pochtaning hamma joriy buyurtmasi ko'rinadi.
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^101,102$/);
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/hali yo'lda/)).not.toBeInTheDocument();
    expect(mocks.receivePostMutateAsync).not.toHaveBeenCalled();
  });

  it("kuryer boshqa kuryerning qabul qilingan pochtasini holatsiz ochsa — faqat o'qish", async () => {
    withOrders([order("102", "on the road", { in_post_now: true })], { id: POST_ID, status: "received", courier_id: "501" });
    renderPage(courierState);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("true");
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).not.toBeInTheDocument();
  });

  it("qabul qiluvchi holatsiz havolada avvalgidek qabul qiladi: kuryer — o'z pochtasi, menejer — filial o'tkazmasi", async () => {
    const user = userEvent.setup();
    withOrders(
      [order("101", "waiting", { in_post_now: true }), order("102", "on the road", { in_post_now: true })],
      { id: POST_ID, status: "received", courier_id: COURIER_ID },
    );
    mocks.receivePostMutateAsync.mockResolvedValue({ statusCode: 200, data: [{ id: "102" }], not_received_order_ids: [] });
    const { unmount } = renderPage(courierState);

    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("false");
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102$/);
    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(screen.getByRole("button", { name: /Pochtani qabul qilish/ }));
    await waitFor(() =>
      expect(mocks.receivePostMutateAsync).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["102"] } }),
    );
    unmount();

    withOrders(
      [order("101", "waiting", { in_post_now: true }), order("102", "on the road", { in_post_now: true })],
      { id: POST_ID, status: "received", courier_id: "0" },
    );
    renderPage(managerState);
    expect(await screen.findByTestId("orders-readonly")).toHaveTextContent("false");
    expect(screen.getByTestId("orders-ids")).toHaveTextContent(/^102$/);
    expect(screen.getByRole("button", { name: /Pochtani qabul qilish/ })).toBeInTheDocument();
  });
});
