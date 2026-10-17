import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Pochta tafsiloti — dizayn v2 tuzilmasi (haqiqiy `OrdersTable` bilan): rejimga qarab sarlavha amallari,
 * ogohlantirishlar, ko'rsatkichlar, karta sarlavhasi va xato holati (maketlar `*-mails-detail*`).
 */

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefused: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefused }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({ useOrderQrScanner: () => undefined }));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";

const order = (id: string, status: string, price = 100000) => ({
  id,
  status,
  createdAt: "2026-10-05T09:14:00.000Z",
  updatedAt: "2026-10-05T09:14:00.000Z",
  where_deliver: "address",
  total_price: price,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
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

const regular = (rows: ReturnType<typeof order>[], post?: { status: string }) =>
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: rows, ...(post ? { post: { id: POST_ID, ...post } } : {}) } } : undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: rows } } }),
  }));

const renderPage = (preloadedState: never, route: string | { pathname: string; state?: unknown } = `/mails/${POST_ID}`) =>
  renderWithProviders(
    <Routes>
      <Route path="/mails/:id" element={<MailDetailPage />} />
    </Routes>,
    { route, preloadedState },
  );

describe("MailDetailPage v2 — rejimlar", () => {
  beforeEach(() => {
    mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it("superadmin jo'natish: tanlov sarlavha amallari va ko'rsatkichlarni yangilaydi (`superadmin-mails-detail`)", async () => {
    const user = userEvent.setup();
    regular([order("101", "received", 185000), order("102", "received", 240000)], { status: "new" });
    renderPage(stateFor("superadmin"));

    const send = screen.getByRole("button", { name: "Pochtani jo'natish — 0 ta" });
    expect(send).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Chop etish/ })).toBeDisabled();
    expect(screen.getByText("QR kodni skanerlasangiz, buyurtma ro'yxatda avtomatik tanlanadi")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "№101 ni tanlash" }));
    expect(screen.getByRole("button", { name: "Pochtani jo'natish — 1 ta" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Chop etish 1" })).toBeEnabled();
    expect(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).toHaveTextContent("1 ta buyurtma tanlandi / 2 ta");
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("1 ta tanlandi");
    // Savat — superadmin, NEW pochta.
    expect(screen.getByRole("button", { name: "№102 ni pochtadan o'chirish" })).toBeInTheDocument();
  });

  it("rad etilgan pochta (HQ registratori): info ogohlantirish maket matni bilan, skaner izohi yo'q (`registrator-mails-detail-refused`)", () => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("201", "cancelled (sent)"), order("202", "cancelled")] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(stateFor("registrator", "HQ"), `/mails/${POST_ID}?type=refused`);

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Kuryer qaytargan buyurtmalarning QR kodini skanerlang.");
    expect(note).toHaveTextContent(
      "Mos buyurtmalar ro'yxatda avtomatik tanlanadi, so'ng «Pochtani qabul qilish» tugmasini bosing.",
    );
    expect(screen.getByRole("region", { name: "Rad etilgan buyurtmalar" })).toBeInTheDocument();
    expect(screen.queryByText(/QR kodni skanerlasangiz/)).toBeNull();
    expect(screen.getByRole("button", { name: "Pochtani qabul qilish — 0 ta" })).toBeDisabled();
    expect(screen.getByText("Bekor — jo'natilgan")).toBeInTheDocument();
  });

  it("menejer qabul: sarlavha «Yo'ldagi» emas, «Buyurtmalar»; skaner izohi menejer matni (`manager-mails-detail-receive`)", () => {
    regular([order("301", "on the road"), order("302", "waiting")], { status: "new" });
    renderPage(stateFor("manager", "REGIONAL"));
    expect(screen.getByRole("heading", { level: 2, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("QR kodni skanerlang — buyurtma ro'yxatda tanlanadi")).toBeInTheDocument();
    // Qabul rejimida faqat yo'ldagi buyurtma.
    expect(screen.getByRole("checkbox", { name: "№301 ni tanlash" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "№302 ni tanlash" })).toBeNull();
    expect(
      within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent?.trim()),
    ).toEqual(["", "Buyurtma", "Mijoz", "Tuman / manzil", "Market", "Yetkazish", "Holat", "Summa", "Amallar"]);
  });

  it("kuryer qabul: «Yo'ldagi buyurtmalar», raqam havolasiz, «Tanlangan» kartasida jarayon chizig'i (`courier-mails-detail-receive`)", () => {
    regular([order("401", "on the road"), order("402", "on the road")], { status: "sent" });
    renderPage(stateFor("courier", "REGIONAL"));
    expect(screen.getByRole("heading", { level: 2, name: "Yo'ldagi buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("QR skanerlansa, buyurtma avtomatik tanlanadi")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByRole("link")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Tanlangan buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tanlangan 0 ta buyurtmani chop etish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "№401 yorlig'ini chop etish" })).toBeInTheDocument();
  });

  it("kuryerning rad etilgan pochtasi: «Barchasini chop etish», «Faqat o'qish», filial izohi, tanlov yo'q (`courier-mails-detail-refused`)", () => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("501", "cancelled (sent)", 145000), order("502", "cancelled (sent)", 210000)] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(stateFor("courier", "REGIONAL"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "refused", type: "refused" } });

    const printAll = screen.getByRole("button", { name: "Barcha 2 ta buyurtma yorlig'ini chop etish" });
    expect(printAll).toBeEnabled();
    expect(printAll).toHaveTextContent(/^Barchasini chop etish$/);
    expect(screen.getByText("Faqat o'qish")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Rad etilgan pochtani filial qabul qiladi.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("Rad etilgan");
  });

  it("xato — ErrorState «Qayta urinish» so'rovni qayta yuboradi", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("x"), refetch });
    renderPage(stateFor("superadmin"));
    expect(screen.getByText("Ma'lumotlarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
