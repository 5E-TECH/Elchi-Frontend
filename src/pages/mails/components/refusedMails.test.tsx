import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import RefusedMails from "./refusedMails";
import { renderWithProviders } from "../../../test/test-utils";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";

const getRefusedMailsMock = vi.fn();
const getRefusedMailsCourierMock = vi.fn();

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetRefusedMails: getRefusedMailsMock,
    useGetRefusedMailsCourier: getRefusedMailsCourierMock,
  }),
}));

const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } });

/** Menejer filial turi bilan (HQ — jadval, qolganlari — kartalar; `model/mailsCardView.ts`). */
const managerState = (branchType: string) => ({
  ...roleState("manager"),
  user: {
    user: { id: "m-1", role: "manager", branch: { id: "1", type: branchType } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
});

const dateOf = (iso: string) => formatDateTimeLocalized(iso, { language: "uz" });

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
};

const renderRefused = (layout: "card" | "page", role: string, state: unknown = roleState(role)) =>
  renderWithProviders(
    <>
      <RefusedMails layout={layout} />
      <LocationProbe />
    </>,
    { route: "/mails/refused", preloadedState: state as never },
  );

const REFUSED_STATE_2459 = {
  fromTab: "refused",
  type: "refused",
  fallbackRegionId: "3",
  fallbackRegionName: "Andijon",
  expectedOrderCount: 4,
};

const MAILS = [
  {
    id: "2471",
    createdAt: "2026-10-07T11:02:00.000Z",
    updatedAt: "2026-10-07T11:02:00.000Z",
    courier_id: "5",
    post_total_price: 1_860_000,
    order_quantity: 9,
    qr_code_token: "qr-2471",
    region_id: "21",
    region: { id: "21", name: "Surxondaryo", sato_code: "" },
    status: "canceled",
    courier: { id: "5", name: "Sherzod Komilov" },
  },
  {
    id: "2459",
    createdAt: "2026-10-05T14:05:00.000Z",
    updatedAt: "2026-10-05T14:05:00.000Z",
    courier_id: "7",
    post_total_price: 813_000,
    order_quantity: 4,
    qr_code_token: "qr-2459",
    region_id: "3",
    region: { id: "3", name: "Andijon", sato_code: "" },
    status: "canceled",
    courier: { id: "7", name: "Jasur Tursunov" },
  },
];

const loaded = (data: unknown[]) => ({ data: { data }, isLoading: false, isError: false, error: null, refetch: vi.fn() });
const idle = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };

describe("RefusedMails", () => {
  beforeEach(() => {
    getRefusedMailsMock.mockReturnValue(idle);
    getRefusedMailsCourierMock.mockReturnValue(idle);
  });

  it("staff: hint, summary, courier column and the «Rad etilgan» badge", () => {
    getRefusedMailsMock.mockReturnValue(loaded(MAILS));

    renderRefused("card", "superadmin");

    expect(getRefusedMailsMock).toHaveBeenCalledWith({ enabled: true });
    expect(getRefusedMailsCourierMock).toHaveBeenCalledWith({ enabled: false });
    expect(
      screen.getByText("Kuryer qaytargan pochtalar. Pochtani oching va buyurtmalarni skanerlab qabul qiling."),
    ).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "2 ta viloyat · 13 ta buyurtma · jami 2 673 000 so'm")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Rad etilgan pochtalar" });
    expect(within(table).getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    expect(within(table).getAllByText("Sherzod Komilov").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Rad etilgan")).toHaveLength(2);
    expect(within(table).getByRole("link", { name: "№2471 rad etilgan pochtani ochish" })).toBeInTheDocument();
    // Filtr yo'q.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("HQ manager keeps the table and opens the refused mail with type=refused state", async () => {
    const user = userEvent.setup();
    getRefusedMailsMock.mockReturnValue(loaded(MAILS));

    renderRefused("card", "manager", managerState("HQ"));
    expect(screen.queryByRole("list", { name: "Rad etilgan pochtalar" })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("table", { name: "Rad etilgan pochtalar" })).getByRole("link", { name: "№2459" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/mails/2459");
    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual(REFUSED_STATE_2459);
  });

  it("branch manager: date cards (newest first) with the courier and «Rad etilgan» badge, same router state", async () => {
    const user = userEvent.setup();
    getRefusedMailsMock.mockReturnValue(loaded([MAILS[1], MAILS[0]]));

    renderRefused("card", "manager", managerState("REGIONAL"));

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText("Kuryer qaytargan pochtalar. Pochtani oching va buyurtmalarni skanerlab qabul qiling."),
    ).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "2 ta viloyat · 13 ta buyurtma · jami 2 673 000 so'm")).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Rad etilgan pochtalar" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mails/2471", "/mails/2459"]);
    expect(links[1]).toHaveAccessibleName(
      `Pochta №2459, ${dateOf(MAILS[1].createdAt)}, Rad etilgan, Andijon, 4 ta buyurtma, 813 000 so'm — ochish`,
    );
    expect(within(links[1]).getByText("Kuryer: Jasur Tursunov")).toBeInTheDocument();
    expect(within(links[1]).getByText("Rad etilgan")).toBeInTheDocument();

    await user.click(links[1]);
    expect(screen.getByTestId("location")).toHaveTextContent("/mails/2459");
    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual(REFUSED_STATE_2459);
  });

  it("renders empty state", () => {
    getRefusedMailsMock.mockReturnValue(loaded([]));

    renderRefused("card", "admin");

    expect(screen.getByText("Rad etilgan pochta yo'q")).toBeInTheDocument();
  });

  it("renders the error state with retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    getRefusedMailsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("x"), refetch });

    renderRefused("card", "registrator");

    expect(screen.getByText("Ma'lumotlarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("courier: read-only note, stat cards and date cards without the courier name", async () => {
    const user = userEvent.setup();
    getRefusedMailsCourierMock.mockReturnValue(loaded(MAILS));

    renderRefused("page", "courier");

    expect(getRefusedMailsCourierMock).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByRole("note")).toHaveTextContent(
      "Bekor qilingan buyurtmalaringiz pochtalari. Ularni filial qabul qiladi — siz faqat ko'rishingiz mumkin.",
    );
    expect(screen.getByRole("heading", { name: "Rad etilgan pochtalar" })).toBeInTheDocument();
    expect(screen.getByText("Faqat ko'rish uchun — qabulni filial bajaradi")).toBeInTheDocument();
    expect(screen.getByText("Jami summa")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Rad etilgan pochtalar" });
    const card = within(list).getByRole("link", {
      name: `Rad etilgan pochta №2471, Surxondaryo, ${dateOf(MAILS[0].createdAt)}, 9 ta buyurtma, 1 860 000 so'm — ochish`,
    });
    expect(within(card).getByText(dateOf(MAILS[0].createdAt))).toBeInTheDocument();
    expect(within(card).getByText("Pochta №2471")).toBeInTheDocument();
    expect(within(list).queryByText(/Kuryer:/)).not.toBeInTheDocument();

    await user.click(card);
    expect(screen.getByTestId("location")).toHaveTextContent("/mails/2471");
    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toMatchObject({
      fromTab: "refused",
      type: "refused",
      expectedOrderCount: 9,
    });
  });

  it("courier phone: date cards named «Rad etilgan pochta №X, …» (maket `courier-mails-refused`)", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(max-width: 767px)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    getRefusedMailsCourierMock.mockReturnValue(loaded(MAILS));

    renderRefused("page", "courier");

    expect(screen.queryByRole("heading", { name: "Rad etilgan pochtalar" })).not.toBeInTheDocument();
    const card = screen.getByRole("link", {
      name: /^Rad etilgan pochta №2471, Surxondaryo, .+, 9 ta buyurtma, 1 860 000 so'm — ochish$/,
    });
    expect(card).toHaveTextContent(dateOf(MAILS[0].createdAt));
    expect(card).toHaveTextContent("Pochta №2471");
    expect(card).toHaveTextContent("Surxondaryo");
    expect(card).toHaveTextContent("9 ta buyurtma");
    expect(card).toHaveTextContent("Rad etilgan");
    vi.restoreAllMocks();
  });
});
