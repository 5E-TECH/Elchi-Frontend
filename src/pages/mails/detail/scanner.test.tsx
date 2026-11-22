import { act, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../../shared/lib/scanner/scanTargets";
import { mailArrivalState, mailScanTargetId } from "../../scan/model/scanPickers";
import MailDetailPage from "./index";

/**
 * Pochta tafsiloti — kamera (Trello v1eLN2tV 2-bosqich): markaziy «Skaner» tugmasi sahifaning skan maqsadini
 * ochadi. Haqiqiy `useOrderQrScanner` — kamera skani USB bilan bir yo'l (faqat tanlaydi). Tarmoq — mock'lar.
 */

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefusedByPostId: vi.fn(),
  fetchScanDetail: vi.fn(),
  playScanFeedback: vi.fn(),
  receive: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefusedByPostId }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: mocks.receive, isPending: false }),
  useRequestOrderReturn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReturnCanceledOrders: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
  useDispatchPostToCourier: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
  getPostCourierDestinations: vi.fn().mockResolvedValue({
    post_id: "",
    region_id: "",
    is_hq_region: false,
    couriers: [],
    carrier_lookup_failed: false,
  }),
}));

vi.mock("../../../entities/batch", () => ({
  useBatchRemainingDetail: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendTransferBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({ SendToPost: { mutateAsync: vi.fn(), isPending: false } }),
}));

vi.mock("../../scan/lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scan/lib/scanResource")>()),
  fetchScanDetail: mocks.fetchScanDetail,
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
}));

// Jadval o'rniga yengil stub: tanlangan buyurtmalar soni.
vi.mock("./ui/OrdersTable", () => ({
  default: ({ selectedIds }: { selectedIds: Set<string> }) => <span data-testid="selected">{[...selectedIds].join(",")}</span>,
}));

const POST_ID = "2483";

const order = (id: string, token: string, name: string, status = "received") => ({
  id,
  status,
  qr_code_token: token,
  region_id: "12",
  where_deliver: "address",
  total_price: 205000,
  customer: { id: `c-${id}`, name },
  district: { id: "5", name: "Yakkabog' tumani", region_id: "12", region: { name: "Qashqadaryo" } },
});

const detail = (orders: unknown[]) => ({
  data: { data: { allOrdersByPostId: orders, post: { id: POST_ID, status: "new", region: { name: "Qashqadaryo" } } } },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

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
    </Routes>,
    { route, preloadedState },
  );

const target = () => getActiveScanTarget()!;
const notFound = () => Object.assign(new Error("Not found"), { response: { status: 404 } });

beforeEach(() => {
  const response = detail([
    order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova"),
    order("10199", "aaaaaaaaaaaaaaaaaaaaaa99", "Sanjar Qurbonov"),
  ]);
  mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
  mocks.useRefusedByPostId.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

afterEach(() => {
  act(() => resetScanTargets());
  vi.clearAllMocks();
});

describe("MailDetailPage — kamera maqsadi", () => {
  it("jo'natish (superadmin): «Pochtani jo'natish · Pochta №2483 · Qashqadaryo»; kamera skani tanlaydi, «Bekor qilish» chiqaradi", async () => {
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    expect(target()).toMatchObject({
      id: `mail:${POST_ID}:send`,
      title: "Pochtani jo'natish",
      context: "Pochta №2483 · Qashqadaryo",
      progress: { done: 0, total: 2, label: "ta tanlandi" },
      listTitle: "Oxirgi skanerlar",
      finish: { label: "Tugatish" },
    });

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaa99", "camera");
    });
    expect(screen.getByTestId("selected")).toHaveTextContent("10199");
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Buyurtma tanlandi №10199", undefined, {
      voice: "selected",
    });
    expect(target().progress).toMatchObject({ done: 1, total: 2 });
    expect(target().list?.[0]).toMatchObject({ key: "order:10199", title: "№10199 · Sanjar Qurbonov", tone: "success" });

    act(() => target().list![0].onUndo!());
    expect(screen.getByTestId("selected")).toHaveTextContent("");
    expect(target().list).toEqual([]);
  });

  it("pochtada yo'q kod — «Bu pochtada yo'q · rad etildi» ro'yxatda, tanlov o'zgarmaydi", async () => {
    mocks.fetchScanDetail.mockRejectedValue(notFound());
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaa95", "camera");
    });
    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbb0388", "camera");
    });

    await waitFor(() => expect(target().list).toHaveLength(2));
    expect(target().list?.[0]).toMatchObject({
      key: "missing:bbbbbbbbbbbbbbbbbbbb0388",
      title: "bbbbbbbbbbbbbbbbbbbb0388 · Bu pochtada yo'q",
      subtitle: "Boshqa pochtaga tegishli · rad etildi",
      tone: "danger",
    });
    expect(target().list?.[0].onUndo).toBeUndefined();
    expect(target().progress).toMatchObject({ done: 1, total: 2 });
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("missing", "Bu pochtada yo'q");
  });

  it("qabul (kuryer, o'z pochtasi): «Pochtani qabul qilish» — kamera skani darhol qabul qiladi, «ta qabul qilindi»", async () => {
    const rows = [
      order("10247", "aaaaaaaaaaaaaaaaaaaaaa47", "Dilshod Ergashev", "on the road"),
      order("10248", "aaaaaaaaaaaaaaaaaaaaaa48", "Feruza Rasulova", "on the road"),
      order("10249", "aaaaaaaaaaaaaaaaaaaaaa49", "Aziz Karimov", "waiting"),
    ];
    const response = {
      ...detail(rows),
      data: { data: { allOrdersByPostId: rows, post: { id: POST_ID, status: "sent", courier_id: "courier-1" } } },
    };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    mocks.receive.mockResolvedValue({ statusCode: 200, data: [], received_order_ids: ["10247"], post_status: "sent" });
    renderPage(stateFor("courier"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    expect(target()).toMatchObject({
      id: `mail:${POST_ID}:receive`,
      title: "Pochtani qabul qilish",
      note: { title: "Skanerlangan buyurtma darhol qabul qilinadi va ro'yxatdan chiqadi" },
      progress: { done: 1, total: 3, label: "ta qabul qilindi" },
    });

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaa47", "camera");
    });
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["10247"], scan: true } }),
    );
    // Tanlanmaydi — ro'yxatdan chiqadi; ovoz «Qabul qilindi», izohda qolgani.
    expect(screen.getByTestId("selected")).toHaveTextContent("");
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "№10247 qabul qilindi", "camera", {
      voice: "received",
      text: "1 ta qoldi",
    });
    expect(target().progress).toMatchObject({ done: 2, total: 3 });
    await waitFor(() =>
      expect(target().list?.[0]).toMatchObject({ key: "order:10247", title: "№10247 · Dilshod Ergashev", tone: "success" }),
    );
    expect(target().list?.[0].onUndo).toBeUndefined();

    // Kutilmoqdadagi buyurtma qayta skanerlansa — «Allaqachon qabul qilingan», so'rovsiz.
    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaa49", "camera");
    });
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №10249", "camera");
    expect(mocks.receive).toHaveBeenCalledTimes(1);
  });

  it("qabul (kuryer), pochta boshqa kuryerniki — kamera skani avvalgidek tanlaydi", async () => {
    const response = detail([
      order("10247", "aaaaaaaaaaaaaaaaaaaaaa47", "Dilshod Ergashev", "on the road"),
      order("10248", "aaaaaaaaaaaaaaaaaaaaaa48", "Feruza Rasulova", "received"),
    ]);
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("courier"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    expect(target()).toMatchObject({
      id: `mail:${POST_ID}:receive`,
      title: "Pochtani qabul qilish",
      progress: { done: 0, total: 1, label: "ta tanlandi" },
    });
    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaa47", "camera");
    });
    expect(screen.getByTestId("selected")).toHaveTextContent("10247");
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("eski pochta (faqat o'qish) — kamera maqsadi yo'q (markaziy tugma universal skanerni ochadi)", async () => {
    renderPage(stateFor("superadmin"), `/mails/${POST_ID}?view=old`);
    await screen.findByTestId("selected");

    expect(getActiveScanTarget()).toBeNull();
  });
});

describe("MailDetailPage — universal skanerdan kelish (vNcGDnNh): maqsad id'si skaner kutgani bilan aynan", () => {
  it("«Pochtani jo'natish» (superadmin) — `mail:<id>:send`", async () => {
    renderPage(stateFor("superadmin"), {
      pathname: `/mails/${POST_ID}`,
      state: mailArrivalState({ id: POST_ID, regionId: "12", orders: 2 }, "send"),
    });
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());
    expect(target().id).toBe(mailScanTargetId(POST_ID, "send"));
    expect(target().title).toBe("Pochtani jo'natish");
  });

  it("«Rad etilgan pochta» (HQ menejeri, `type: refused`) — `mail:<id>:refused`", async () => {
    mocks.useRefusedByPostId.mockImplementation((postId: string) =>
      postId
        ? { data: { data: [order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova", "cancelled")] }, isLoading: false, isError: false }
        : { data: undefined, isLoading: false, isError: false },
    );
    renderPage(stateFor("manager", "HQ"), {
      pathname: `/mails/${POST_ID}`,
      state: mailArrivalState({ id: POST_ID }, "refused"),
    });
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());
    expect(target().id).toBe(mailScanTargetId(POST_ID, "refused"));
    expect(target().title).toBe("Rad etilgan pochtani qabul qilish");
  });
});

/**
 * Skan auditi 2026-11-23: jo'natish rejimida «o'xshash mijoz» bo'yicha BOSHQA buyurtma tanlanmaydi (#46); pochtaga
 * keyin qo'shilgan buyurtma bitta qayta so'rov bilan topiladi (#47); qidiruv xatosi «QR topilmadi» emas (#48); fon
 * yangilanishi yiqilsa sahifa xato holatiga almashmaydi (#44).
 */
describe("MailDetailPage — skan: faqat aniq buyurtma, kechikkan qo'shilish va xatolar", () => {
  /** `10199` bilan bir mijoz (id, ism), market va tuman — lekin BOSHQA buyurtma. */
  const sameCustomerOther = (over: Record<string, unknown> = {}) => ({
    id: "10500",
    status: "received",
    customer: { id: "c-10199", name: "Sanjar Qurbonov" },
    market: { id: "201", name: "Baraka Shop" },
    district: { id: "5", name: "Yakkabog' tumani" },
    ...over,
  });

  it("bir xil mijoz + tuman, boshqa pochtadagi buyurtma — tanlanmaydi, «Bu pochtada yo'q» (#46)", async () => {
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: sameCustomerOther({ post_id: "7777" }) } });
    const refetch = vi.fn();
    const response = {
      ...detail([{ ...order("10199", "aaaaaaaaaaaaaaaaaaaaaa99", "Sanjar Qurbonov"), market: { id: "201", name: "Baraka Shop" } }]),
      refetch,
    };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbb0500", "camera");
    });

    expect(screen.getByTestId("selected")).toHaveTextContent("");
    await waitFor(() => expect(target().list?.[0]).toMatchObject({ key: "missing:bbbbbbbbbbbbbbbbbbbb0500", tone: "danger" }));
    // Boshqa pochtaniki — pochta qayta so'ralmaydi.
    expect(refetch).not.toHaveBeenCalled();
  });

  it("pochtaga sahifa ochilgandan keyin qo'shilgan buyurtma — bitta qayta so'rov, so'ng tanlanadi (#47)", async () => {
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: { id: "10600", post_id: POST_ID, status: "received" } } });
    const initialRows = [order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova")];
    const freshRows = [...initialRows, order("10600", "aaaaaaaaaaaaaaaaaaaaa600", "Kechikkan Buyurtma")];
    let current: ReturnType<typeof detail> & { dataUpdatedAt: number } = { ...detail(initialRows), dataUpdatedAt: Date.now() };
    const refetch = vi.fn(async () => {
      current = { ...detail(freshRows), refetch, dataUpdatedAt: Date.now() + 1 };
      return { data: current.data, dataUpdatedAt: current.dataUpdatedAt };
    });
    current = { ...current, refetch };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? current : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaa600", "camera");
    });

    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("10600"));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Buyurtma tanlandi №10600", undefined, { voice: "selected" });
  });

  it("shu pochtaniki, lekin qayta so'rov yiqildi (429) — «Bu pochtada yo'q» emas, «Tekshirib bo'lmadi» (#47/#48)", async () => {
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: { id: "10600", post_id: POST_ID } } });
    const base = detail([order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova")]);
    const refetch = vi.fn(async () => ({
      data: base.data,
      isError: true,
      error: Object.assign(new Error("Too Many Requests"), { response: { status: 429, data: {} } }),
    }));
    const response = { ...base, refetch, dataUpdatedAt: Date.now() };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaa600", "camera");
    });

    expect(await screen.findByText("So'rovlar juda ko'p — bir necha soniya kutib, qayta skanerlang")).toBeInTheDocument();
    expect(target().list).toEqual([]);
    expect(screen.getByTestId("selected")).toHaveTextContent("");
  });

  it("pochta id'si noma'lum, sahifadagi pochta yangi — qayta so'ralmaydi, «Bu pochtada yo'q» (#47, ortiqcha so'rovsiz)", async () => {
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: { id: "10700", status: "received" } } });
    const refetch = vi.fn();
    const response = { ...detail([order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova")]), refetch, dataUpdatedAt: Date.now() };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbb0700", "camera");
    });

    await waitFor(() => expect(target().list?.[0]).toMatchObject({ key: "missing:bbbbbbbbbbbbbbbbbbbb0700" }));
    expect(refetch).not.toHaveBeenCalled();
  });

  it("qidiruv xatosi (502 / tarmoq) — «Tekshirib bo'lmadi — qayta skanerlang», «QR topilmadi» emas (#48)", async () => {
    mocks.fetchScanDetail.mockRejectedValue(
      Object.assign(new Error("Bad Gateway"), { response: { status: 502, data: { message: "UPSTREAM_UNAVAILABLE" } } }),
    );
    renderPage(stateFor("superadmin"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbb0388", "camera");
    });

    expect(await screen.findByText("Server xatosi (502). Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.getAllByText("Tekshirib bo'lmadi — qayta skanerlang").length).toBeGreaterThan(0);
    expect(screen.queryByText("QR topilmadi")).not.toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("error", "Tekshirib bo'lmadi — qayta skanerlang");
    // «Bu pochtada yo'q» ro'yxatiga tushmaydi.
    expect(target().list).toEqual([]);
  });

  it("fon yangilanishi yiqildi, ma'lumot bor — jadval qoladi, ustida «Pochta yangilanmadi» (#44)", async () => {
    const refetch = vi.fn();
    const response = {
      ...detail([order("10195", "aaaaaaaaaaaaaaaaaaaaaa95", "Nigora Xoliqova")]),
      isError: true,
      error: Object.assign(new Error("Too Many Requests"), { response: { status: 429 } }),
      refetch,
    };
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("superadmin"));

    expect(await screen.findByTestId("selected")).toBeInTheDocument();
    expect(screen.getByText("Pochta yangilanmadi")).toBeInTheDocument();
    expect(screen.queryByText("Ma'lumotlarni yuklab bo'lmadi")).not.toBeInTheDocument();
    await act(async () => {
      screen.getByRole("button", { name: "Qayta urinish" }).click();
    });
    expect(refetch).toHaveBeenCalled();
  });
});
