import { useEffect } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Skan-qabul navbati (2026-11-07) — HAQIQIY `useReceivePost({ scope })` bilan (faqat `api.patch` soxta):
 * so'rovlar ketma-ket (bitta `scope`), sahifadan chiqilsa ham yuboriladi; sahifa qayta ochilganda navbatdagilar
 * yashirin, navbat bo'sh bo'lmaguncha «Kelmagan — qaytarish» o'chiq (`useIsMutating`).
 */

type Row = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  where_deliver: string;
  total_price: number;
  qr_code_token: string;
  customer: { id: string; name: string; phone_number: string };
  market: { id: string; name: string };
  district: { id: string; name: string; region_id: string; region: { name: string } };
};

type ScannerOptions = {
  orders: Row[];
  onMatch: (order: Row, raw: string, source: "keyboard" | "camera") => void;
};

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  scanner: null as null | ScannerOptions,
  navigate: null as null | ((to: string) => void),
}));

vi.mock("../../../entities/mails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/mails")>()),
  useMails: () => ({
    useGetRefusedMailsCourierByPostId: () => ({ data: undefined, isLoading: false, isError: false }),
  }),
  useMailDetail: mocks.useMailDetail,
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

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";
const COURIER_ID = "500";

const order = (id: string, status = "on the road"): Row => ({
  id,
  status,
  createdAt: "2026-11-07T07:00:00.000Z",
  updatedAt: "2026-11-07T07:00:00.000Z",
  where_deliver: "address",
  total_price: 150000,
  qr_code_token: `token-${id}-aaaaaaaaaaaa`,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut", region_id: "8", region: { name: "Samarqand" } },
});

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

const NavProbe = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    mocks.navigate = navigate;
  }, [navigate]);
  return <output data-testid="location">{location.pathname}</output>;
};

const checkbox = (id: string) => screen.queryByRole("checkbox", { name: `№${id} ni tanlash` });
const requestButton = (id: string) => screen.queryByRole("button", { name: `№${id} kelmagan — qaytarish so'rovi` });

describe("MailDetailPage — skan-qabul navbati (haqiqiy `useReceivePost`, `scope`)", () => {
  /** «Server»: qabul qilingan buyurtma — `waiting`. */
  let serverRows: Row[];
  const replies: Array<(body: unknown) => void> = [];
  let patch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    serverRows = [order("101"), order("102"), order("103")];
    replies.length = 0;
    mocks.scanner = null;
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId
        ? { data: { allOrdersByPostId: serverRows, post: { id: POST_ID, status: "sent", courier_id: COURIER_ID } } }
        : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: undefined }),
    }));
    patch = vi.spyOn(api, "patch").mockImplementation(
      (_url: string, body?: unknown) =>
        new Promise((resolve) => {
          const ids = ((body as { order_ids?: string[] })?.order_ids ?? []).map(String);
          replies.push((data) => {
            serverRows = serverRows.map((row) => (ids.includes(row.id) ? { ...row, status: "waiting" } : row));
            resolve({ data });
          });
        }) as never,
    );
  });

  afterEach(() => {
    patch.mockRestore();
  });

  it("ketma-ket: ikkinchisi birinchisining javobidan keyin; sahifadan chiqilsa ham yuboriladi; qayta ochilganda navbatdagi yashirin", async () => {
    renderWithProviders(
      <>
        <Routes>
          <Route path="/mails/:id" element={<MailDetailPage />} />
          <Route path="/mails/today" element={<div data-testid="today-list" />} />
        </Routes>
        <NavProbe />
      </>,
      { route: { pathname: `/mails/${POST_ID}`, state: { fromTab: "today" } }, preloadedState: courierState },
    );

    act(() => {
      mocks.scanner?.onMatch(order("101"), "token-101-aaaaaaaaaaaa", "keyboard");
    });
    act(() => {
      mocks.scanner?.onMatch(order("102"), "token-102-aaaaaaaaaaaa", "keyboard");
    });

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenLastCalledWith("post/receive/7", { order_ids: ["101"], scan: true });
    expect(checkbox("101")).toBeNull();
    expect(checkbox("102")).toBeNull();
    expect(requestButton("103")).toBeDisabled();

    // Sahifadan chiqish — navbat to'xtamaydi.
    act(() => mocks.navigate?.("/mails/today"));
    expect(await screen.findByTestId("today-list")).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);

    await act(async () => {
      replies[0]({ statusCode: 200, data: [], received_order_ids: ["101"], post_status: "sent" });
    });
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch).toHaveBeenLastCalledWith("post/receive/7", { order_ids: ["102"], scan: true });

    // Qayta ochish: №102 hali navbatda — yashirin, «Kelmagan» o'chiq; №101 serverda qabul qilingan.
    act(() => mocks.navigate?.(`/mails/${POST_ID}`));
    await waitFor(() => expect(checkbox("103")).toBeInTheDocument());
    expect(checkbox("101")).toBeNull();
    expect(checkbox("102")).toBeNull();
    expect(requestButton("103")).toBeDisabled();

    await act(async () => {
      replies[1]({ statusCode: 200, data: [], received_order_ids: ["102"], post_status: "sent" });
    });
    await waitFor(() => expect(requestButton("103")).toBeEnabled());
    expect(checkbox("102")).toBeNull();
    expect(patch).toHaveBeenCalledTimes(2);
  });
});
