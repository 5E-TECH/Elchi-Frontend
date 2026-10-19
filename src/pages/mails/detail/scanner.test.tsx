import { act, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../../shared/lib/scanner/scanTargets";
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
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefusedByPostId }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

const renderPage = (preloadedState: never, route = `/mails/${POST_ID}`) =>
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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Buyurtma tanlandi №10199");
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

  it("qabul (kuryer): «Pochtani qabul qilish» — faqat yo'ldagi buyurtmalar", async () => {
    const response = detail([
      order("10247", "aaaaaaaaaaaaaaaaaaaaaa47", "Dilshod Ergashev", "on the road"),
      order("10248", "aaaaaaaaaaaaaaaaaaaaaa48", "Feruza Rasulova", "received"),
    ]);
    mocks.useMailDetail.mockImplementation((postId: string) => (postId ? response : { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    renderPage(stateFor("courier"));
    await waitFor(() => expect(getActiveScanTarget()).not.toBeNull());

    expect(target()).toMatchObject({ id: `mail:${POST_ID}:receive`, title: "Pochtani qabul qilish", progress: { done: 0, total: 1 } });
  });

  it("eski pochta (faqat o'qish) — kamera maqsadi yo'q (markaziy tugma universal skanerni ochadi)", async () => {
    renderPage(stateFor("superadmin"), `/mails/${POST_ID}?view=old`);
    await screen.findByTestId("selected");

    expect(getActiveScanTarget()).toBeNull();
  });
});
