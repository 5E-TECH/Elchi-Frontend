import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Pochta tafsiloti — skan = darhol qabul (2026-11-07, ega: «skaner qilsa ptichka belgilanishi kerak emas — buyurtma
 * qabul bo'lib ro'yxatdan yo'qolsin», BeePost kabi). Haqiqiy `OrdersTable`; skaner — `useOrderQrScanner` imkoniyatlari
 * ushlanadi (`onMatch` / `onMissing` / kamera), tarmoq — mock'lar.
 *
 * Qabul qiluvchi (kuryer — o'z pochtasi, menejer — o'z filialiga kuryersiz o'tkazma) `sent` pochtada yoki eski
 * pochtadagi yo'ldagi qoldiqda skanerlasa: `PATCH post/receive/:id {order_ids: [id], scan: true}`, qator darhol
 * yashiriladi; xato — qaytadi. Jo'natish, rad etilgan va begona pochta — skan avvalgidek tanlaydi.
 */

type Row = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  where_deliver: string;
  total_price: number;
  qr_code_token: string;
  return_requested?: boolean;
  in_post_now?: boolean;
  customer: { id: string; name: string; phone_number: string };
  market: { id: string; name: string };
  district: { id: string; name: string; region_id: string; region: { name: string } };
};

type ScannerOptions = {
  orders: Array<{ id: string }>;
  enabled?: boolean;
  onMatch: (order: Row, raw: string, source: "keyboard" | "camera") => void;
  onMissing: (raw: string, source: "keyboard" | "camera") => void;
  camera?: { id: string; note?: { title: string }; progress?: { done: number; total?: number; label?: string } };
};

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefused: vi.fn(),
  receive: vi.fn(),
  requestReturn: vi.fn(),
  refetchDetail: vi.fn(),
  fetchScanDetail: vi.fn(),
  playScanFeedback: vi.fn(),
  scanner: null as null | ScannerOptions,
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefused }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: mocks.receive, isPending: false }),
  useRequestOrderReturn: () => ({ mutateAsync: mocks.requestReturn, isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReturnCanceledOrders: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner = options;
  },
}));

vi.mock("../../scan/lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scan/lib/scanResource")>()),
  fetchScanDetail: mocks.fetchScanDetail,
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
}));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";
const COURIER_ID = "500";
const OWN_BRANCH = "15";

const order = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  status: "on the road",
  createdAt: "2026-11-07T07:00:00.000Z",
  updatedAt: "2026-11-07T07:00:00.000Z",
  where_deliver: "address",
  total_price: 150000,
  qr_code_token: `token-${id}-aaaaaaaaaaaa`,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut", region_id: "8", region: { name: "Samarqand" } },
  ...over,
});

const COURIER_POST = { id: POST_ID, status: "sent", courier_id: COURIER_ID };
const TRANSFER_POST = { id: POST_ID, status: "sent", courier_id: "0", branch_id: OWN_BRANCH };

const stateFor = (role: string, { id = `${role}-1`, branchId = OWN_BRANCH, branchType = "REGIONAL" } = {}) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: { id, role, branch: { id: branchId, type: branchType } },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;
const courier = () => stateFor("courier", { id: COURIER_ID });
const manager = (branchId = OWN_BRANCH) => stateFor("manager", { id: "522", branchId });

/** `GET post/orders/:id` — qatorlar har renderda funksiyadan (so'rovdan keyingi holatni berish uchun). */
const setup = (rows: () => Row[], post: Record<string, unknown> | null = COURIER_POST) => {
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: rows(), ...(post ? { post } : {}) } } : undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mocks.refetchDetail,
  }));
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

const renderPage = (preloadedState: never, state: Record<string, unknown> = { fromTab: "today" }) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/mails/:id"
        element={
          <>
            <MailDetailPage />
            <LocationProbe />
          </>
        }
      />
      <Route path="/mails/today" element={<div data-testid="today-list" />} />
      <Route path="/mails/refused" element={<div data-testid="refused-list" />} />
      <Route path="/mails/old" element={<div data-testid="old-list" />} />
    </Routes>,
    { route: { pathname: `/mails/${POST_ID}`, state }, preloadedState },
  );

const checkbox = (id: string) => screen.queryByRole("checkbox", { name: `№${id} ni tanlash` });
const requestButton = (id: string) => screen.queryByRole("button", { name: `№${id} kelmagan — qaytarish so'rovi` });
const receiveButton = () => screen.getByRole("button", { name: /^Pochtani qabul qilish — / });
/** Skaner `onMatch` (USB yoki kamera aynan shu yo'l). */
const scanRow = (row: Row, source: "keyboard" | "camera" = "keyboard") =>
  act(() => {
    mocks.scanner?.onMatch(row, row.qr_code_token, source);
  });
const scanMissing = async (raw: string, source: "keyboard" | "camera" = "keyboard") => {
  await act(async () => {
    mocks.scanner?.onMissing(raw, source);
  });
};
const ok = (ids: string[], over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: [],
  received_order_ids: ids,
  already_received_order_ids: [],
  not_received_order_ids: [],
  post_status: "sent",
  ...over,
});
const deferred = () => {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  mocks.receive.mockReset().mockResolvedValue(ok([]));
  mocks.requestReturn.mockReset();
  mocks.refetchDetail.mockReset().mockResolvedValue({ data: undefined });
  mocks.fetchScanDetail.mockReset();
  mocks.playScanFeedback.mockReset();
  mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mocks.scanner = null;
});

describe("MailDetailPage — skan = darhol qabul (kuryer, o'z jo'natilgan pochtasi)", () => {
  it("aniq moslik: faqat shu buyurtma `scan: true` bilan qabulga, qator darhol yashiriladi, tanlanmaydi", async () => {
    const rows = [order("101"), order("102"), order("103")];
    setup(() => rows);
    mocks.receive.mockResolvedValue(ok(["102"]));
    renderPage(courier());
    expect(screen.getByText("Skanerlang — buyurtma darhol qabul qilinadi va ro'yxatdan chiqadi")).toBeInTheDocument();

    scanRow(rows[1]);

    expect(checkbox("102")).toBeNull();
    expect(checkbox("101")).not.toBeChecked();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "№102 qabul qilindi", "keyboard", {
      voice: "received",
      text: "2 ta qoldi",
    });
    expect(await screen.findByText("№102 qabul qilindi · 2 ta qoldi")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["102"], scan: true } }),
    );
    expect(mocks.receive).toHaveBeenCalledTimes(1);
    // Muvaffaqiyatdan keyin ham qaytmaydi (refetch kechiksa ham), «Qabul qilindi» kartasi.
    await waitFor(() => expect(receiveButton()).toHaveTextContent("Pochtani qabul qilish — 0 ta"));
    expect(checkbox("102")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Qabul qilingan buyurtmalar" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("skaner indeksi — pochtadagi hamma joriy qator (yo'ldagi, so'rovi bor, kutilmoqda), kamera matnlari qabul rejimida", () => {
    setup(() => [order("101"), order("102", { return_requested: true }), order("103", { status: "waiting" })]);
    renderPage(courier());

    expect(mocks.scanner?.orders.map((item) => item.id)).toEqual(["101", "102", "103"]);
    expect(mocks.scanner?.camera).toMatchObject({
      id: `mail:${POST_ID}:receive`,
      note: { title: "Skanerlangan buyurtma darhol qabul qilinadi va ro'yxatdan chiqadi" },
      progress: { done: 1, total: 2, label: "ta qabul qilindi" },
    });
  });

  it("fuzzy moslik yo'q: skan javobi boshqa buyurtma (o'sha mijoz + market) — «Bu pochtada yo'q», so'rovsiz", async () => {
    setup(() => [order("101"), order("102")]);
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: {
        data: {
          id: "999",
          customer: { id: "c101", name: "Mijoz 101", phone_number: "+998901234567" },
          market: { id: "7", name: "Baraka Shop" },
          district: { id: "5", name: "Urgut" },
        },
      },
    });
    renderPage(courier());

    await scanMissing("zzzzzzzzzzzzzzzzzzzz0999");

    await waitFor(() => expect(mocks.playScanFeedback).toHaveBeenCalledWith("missing", "Bu pochtada yo'q"));
    expect(mocks.receive).not.toHaveBeenCalled();
    expect(checkbox("101")).not.toBeChecked();
    expect(checkbox("101")).toBeInTheDocument();
  });

  it("indeksda yo'q kod, lekin skan javobidagi buyurtma id'si pochta qatori — qabul qilinadi", async () => {
    setup(() => [order("101"), order("102")]);
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: { id: "101" } } });
    mocks.receive.mockResolvedValue(ok(["101"]));
    renderPage(courier());

    await scanMissing("old-token-of-101-aaaaaaaa");

    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["101"], scan: true } }),
    );
    expect(checkbox("101")).toBeNull();
  });

  it("qayta skan: navbatdagi yoki qabul qilingan (kutilmoqda) buyurtma — «Allaqachon qabul qilingan», so'rovsiz", async () => {
    const rows = [order("101"), order("102"), order("103", { status: "waiting" })];
    setup(() => rows);
    const pending = deferred();
    mocks.receive.mockReturnValue(pending.promise);
    renderPage(courier());

    scanRow(rows[0]);
    scanRow(rows[0]);
    scanRow(rows[2]);

    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(1));
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("duplicate", "Allaqachon qabul qilingan №101", "keyboard");
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №103", "keyboard");

    await act(async () => {
      pending.resolve(ok(["101"]));
    });
    // Shu sessiyada qabul qilingan — yana «Allaqachon», so'rovsiz.
    scanRow(rows[0]);
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №101", "keyboard");
    expect(mocks.receive).toHaveBeenCalledTimes(1);
  });

  it("kuryer ro'yxatiga qabul qilinganlar kelmaydi — qayta skan (indeksda yo'q) «Allaqachon qabul qilingan», «QR topilmadi» emas", async () => {
    let current = [order("101"), order("102"), order("103")];
    setup(() => current);
    mocks.receive.mockResolvedValue(ok(["101"]));
    renderPage(courier());
    // Backend kuryerning jo'natilgan pochtasida faqat yo'ldagilarni beradi: qabuldan keyin 101 ro'yxatda yo'q.
    current = [order("102"), order("103")];
    scanRow(order("101"));
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.scanner?.orders.map((item) => item.id)).toEqual(["102", "103"]));

    // Shu ochilishda qabul qilingan.
    mocks.fetchScanDetail.mockResolvedValue({ type: "order", data: { data: { id: "101", status: "waiting" } } });
    await scanMissing("token-101-aaaaaaaaaaaa");
    await waitFor(() =>
      expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №101", "keyboard"),
    );

    // Avval (boshqa ochilishda) qabul qilingan: skan javobi — shu pochta, kutilmoqda.
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "150", post_id: POST_ID, status: "waiting" } },
    });
    await scanMissing("token-150-aaaaaaaaaaaa");
    await waitFor(() =>
      expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №150", "keyboard"),
    );

    // Boshqa pochtadagi kutilayotgan buyurtma — avvalgidek «Bu pochtada yo'q».
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "151", post_id: "999999", status: "waiting" } },
    });
    await scanMissing("token-151-aaaaaaaaaaaa");
    await waitFor(() => expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("missing", "Bu pochtada yo'q"));
    expect(mocks.receive).toHaveBeenCalledTimes(1);
  });

  it("xato (so'rov rad etildi) — qator qaytadi, xato ovozi, «qabul qilinmadi — qayta skanerlang» + backend sababi", async () => {
    const rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.receive.mockRejectedValue({
      response: { status: 400, data: { message: "Buyurtma yo'lda emas — qabul qilib bo'lmaydi" } },
    });
    renderPage(courier());

    scanRow(rows[0]);
    expect(checkbox("101")).toBeNull();

    expect(await screen.findByText("№101 qabul qilinmadi — qayta skanerlang")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma yo'lda emas — qabul qilib bo'lmaydi")).toBeInTheDocument();
    expect(checkbox("101")).toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("error", "№101 qabul qilinmadi — qayta skanerlang", undefined, {
      text: "Buyurtma yo'lda emas — qabul qilib bo'lmaydi",
    });

    // Qayta skan — yana yuboriladi (xato navbatdan chiqdi).
    mocks.receive.mockResolvedValue(ok(["101"]));
    scanRow(rows[0]);
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox("101")).toBeNull());
  });

  it("200, lekin buyurtma `not_received_order_ids` da — xato kabi: qator qaytadi, `failures` sababi", async () => {
    const rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.receive.mockResolvedValue({
      statusCode: 200,
      data: [],
      received_order_ids: [],
      not_received_order_ids: ["101"],
      failures: [{ order_id: "101", error: "Buyurtma holati o'zgardi" }],
      post_status: "sent",
    });
    renderPage(courier());

    scanRow(rows[0]);

    expect(await screen.findByText("№101 qabul qilinmadi — qayta skanerlang")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma holati o'zgardi")).toBeInTheDocument();
    expect(checkbox("101")).toBeInTheDocument();
  });

  it("`already_received` — muvaffaqiyat (xato emas): qator qaytmaydi", async () => {
    const rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.receive.mockResolvedValue(ok([], { already_received_order_ids: ["101"], not_received_order_ids: [] }));
    renderPage(courier());

    scanRow(rows[0]);

    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("№101 qabul qilinmadi — qayta skanerlang")).toBeNull();
    expect(mocks.playScanFeedback).not.toHaveBeenCalledWith("error", expect.anything(), undefined, expect.anything());
    expect(checkbox("101")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Qabul qilingan buyurtmalar" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("navbat ketayotganda «Pochtani qabul qilish» va «Kelmagan — qaytarish» o'chiq; navbat bo'shagach yoqiladi", async () => {
    const user = userEvent.setup();
    const rows = [order("101"), order("102"), order("103")];
    setup(() => rows);
    const pending = deferred();
    mocks.receive.mockReturnValue(pending.promise);
    renderPage(courier());

    await user.click(checkbox("101")!);
    expect(receiveButton()).toBeEnabled();
    scanRow(rows[2]);

    expect(receiveButton()).toBeDisabled();
    expect(requestButton("101")).toBeDisabled();
    expect(requestButton("102")).toBeDisabled();

    await act(async () => {
      pending.resolve(ok(["103"]));
    });
    await waitFor(() => expect(receiveButton()).toBeEnabled());
    expect(requestButton("101")).toBeEnabled();

    // Qo'lda qabul — eski semantika (`scan` yo'q).
    await user.click(receiveButton());
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenLastCalledWith({ postId: POST_ID, payload: { order_ids: ["101"] } }),
    );
  });

  it("hammasi qabul qilindi (`post_status: received`, navbat bo'sh) — «Pochta to'liq qabul qilindi», ~1.5 s dan keyin ro'yxatga", async () => {
    let rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.receive
      .mockImplementationOnce(async () => {
        rows = [order("101", { status: "waiting" }), order("102")];
        return ok(["101"]);
      })
      .mockImplementationOnce(async () => {
        rows = [order("101", { status: "waiting" }), order("102", { status: "waiting" })];
        return ok(["102"], { post_status: "received" });
      });
    renderPage(courier());

    scanRow(order("101"));
    scanRow(order("102"));

    expect(await screen.findByText("Pochta to'liq qabul qilindi")).toBeInTheDocument();
    expect(mocks.receive).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
    expect(await screen.findByTestId("today-list", undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it("javob `received`, lekin navbatda yana so'rov bor — orqaga qaytilmaydi", async () => {
    const rows = [order("101"), order("102")];
    setup(() => rows);
    const second = deferred();
    mocks.receive.mockResolvedValueOnce(ok(["101"], { post_status: "received" })).mockReturnValueOnce(second.promise);
    renderPage(courier());

    scanRow(rows[0]);
    scanRow(rows[1]);

    await waitFor(() => expect(mocks.receive).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.queryByText("Pochta to'liq qabul qilindi")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
    await act(async () => {
      second.resolve(ok(["102"], { post_status: "sent" }));
    });
  });

  it("so'rovi bor buyurtma skanerlansa — to'g'ridan qabul, `reclaimedOrderIds` ga tegilmaydi (ro'yxatga «qaytmaydi»)", async () => {
    const requested = order("103", { return_requested: true });
    setup(() => [order("101"), requested]);
    mocks.receive.mockResolvedValue(ok(["103"]));
    renderPage(courier());
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent("№103");

    scanRow(requested);

    expect(screen.queryByTestId("mail-requested-notice")).toBeNull();
    expect(checkbox("103")).toBeNull();
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["103"], scan: true } }),
    );
  });
});

describe("MailDetailPage — skan-qabul qayerda (gating)", () => {
  it("menejer, o'z filialiga kuryersiz o'tkazma — skan-qabul", async () => {
    const rows = [order("101"), order("102")];
    setup(() => rows, TRANSFER_POST);
    mocks.receive.mockResolvedValue(ok(["101"]));
    renderPage(manager());

    scanRow(rows[0]);
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["101"], scan: true } }),
    );
    expect(checkbox("101")).toBeNull();
  });

  it("menejer, boshqa filialning o'tkazmasi (havola orqali) — skan tanlaydi, so'rovsiz", () => {
    const rows = [order("101"), order("102")];
    setup(() => rows, TRANSFER_POST);
    renderPage(manager("16"));

    scanRow(rows[0]);
    expect(checkbox("101")).toBeChecked();
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("menejer, o'z kuryerining pochtasi — skan-qabul yo'q (tanlash)", () => {
    const rows = [order("101")];
    setup(() => rows, { ...TRANSFER_POST, courier_id: COURIER_ID });
    renderPage(manager());

    scanRow(rows[0]);
    expect(checkbox("101")).toBeChecked();
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("kuryer, boshqa kuryerning jo'natilgan pochtasi — skan tanlaydi", () => {
    const rows = [order("101")];
    setup(() => rows, { ...COURIER_POST, courier_id: "999" });
    renderPage(courier());

    scanRow(rows[0]);
    expect(checkbox("101")).toBeChecked();
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("jo'natish (superadmin, yangi pochta) — skan tanlaydi, `useReceivePost` chaqirilmaydi", () => {
    const rows = [order("101", { status: "received" }), order("102", { status: "received" })];
    setup(() => rows, { id: POST_ID, status: "new" });
    renderPage(stateFor("superadmin"));

    scanRow(rows[0]);
    expect(checkbox("101")).toBeChecked();
    expect(mocks.receive).not.toHaveBeenCalled();
    expect(mocks.scanner?.camera?.id).toBe(`mail:${POST_ID}:send`);
  });

  it("rad etilgan pochta (HQ menejeri) — skan tanlaydi", () => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    const refused = order("201", { status: "cancelled (sent)" });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [refused] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(stateFor("manager", { id: "522", branchType: "HQ" }), { fromTab: "refused", type: "refused" });

    scanRow(refused);
    expect(checkbox("201")).toBeChecked();
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("eski pochtadagi yo'ldagi qoldiq (`view=old`): skan-qabul; oxirgisi qabul qilingach ham qabul rejimi (qulf)", async () => {
    let rows = [order("101", { status: "waiting" }), order("102")];
    setup(() => rows, { id: POST_ID, status: "received", courier_id: COURIER_ID });
    const response = deferred();
    mocks.receive.mockImplementation(() => response.promise);
    renderPage(courier(), { fromTab: "old", view: "old" });
    expect(screen.getByText("1 ta buyurtma hali yo'lda")).toBeInTheDocument();

    scanRow(order("102"));
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["102"], scan: true } }),
    );
    // Serverda endi yo'ldagi qator yo'q (refetch) — sahifa tarixga o'tmaydi, kamera maqsadi qoladi.
    rows = [order("101", { status: "waiting" }), order("102", { status: "waiting" })];
    await act(async () => {
      response.resolve(ok(["102"], { post_status: "received" }));
    });

    expect(screen.queryByTestId("mail-read-only")).toBeNull();
    expect(screen.queryByText("Faqat o'qish")).toBeNull();
    expect(mocks.scanner?.camera?.id).toBe(`mail:${POST_ID}:receive`);
    expect(mocks.scanner?.enabled).toBe(true);
    // Qayta skan — «Allaqachon qabul qilingan» (tanlov emas).
    scanRow(rows[1]);
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon qabul qilingan №102", "keyboard");
    // Pochta to'liq qabul qilindi — eski pochtalar ro'yxatiga qaytiladi.
    expect(await screen.findByText("Pochta to'liq qabul qilindi")).toBeInTheDocument();
    expect(await screen.findByTestId("old-list", undefined, { timeout: 3000 })).toBeInTheDocument();
  });
});
