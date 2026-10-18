import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import RefusedMails from "./refusedMails";
import { renderWithProviders } from "../../../test/test-utils";

const getRefusedMailsMock = vi.fn();
const getRefusedMailsCourierMock = vi.fn();

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetRefusedMails: getRefusedMailsMock,
    useGetRefusedMailsCourier: getRefusedMailsCourierMock,
  }),
}));

const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } });

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
};

const renderRefused = (layout: "card" | "page", role: string) =>
  renderWithProviders(
    <>
      <RefusedMails layout={layout} />
      <LocationProbe />
    </>,
    { route: "/mails/refused", preloadedState: roleState(role) as never },
  );

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

  it("opens the refused mail with type=refused state", async () => {
    const user = userEvent.setup();
    getRefusedMailsMock.mockReturnValue(loaded(MAILS));

    renderRefused("card", "manager");
    await user.click(screen.getByRole("link", { name: "№2459" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/mails/2459");
    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual({
      fromTab: "refused",
      type: "refused",
      fallbackRegionId: "3",
      fallbackRegionName: "Andijon",
      expectedOrderCount: 4,
    });
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

  it("courier: read-only note, stat cards and a sortable table without the courier column", () => {
    getRefusedMailsCourierMock.mockReturnValue(loaded(MAILS));

    renderRefused("page", "courier");

    expect(getRefusedMailsCourierMock).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByRole("note")).toHaveTextContent(
      "Bekor qilingan buyurtmalaringiz pochtalari. Ularni filial qabul qiladi — siz faqat ko'rishingiz mumkin.",
    );
    expect(screen.getByRole("heading", { name: "Rad etilgan pochtalar" })).toBeInTheDocument();
    expect(screen.getByText("Faqat ko'rish uchun — qabulni filial bajaradi")).toBeInTheDocument();
    expect(screen.getByText("Jami summa")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Rad etilgan pochtalar" });
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: /Pochta/ })).toHaveAttribute("title", "Sana bo'yicha saralash");
    expect(within(table).getByRole("link", { name: "Pochta №2471ni ochish" })).toBeInTheDocument();
  });

  it("courier phone: cards titled by date, named «Rad etilgan pochta №X, …» (maket `courier-mails-refused`)", () => {
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
    expect(card).toHaveTextContent("Pochta №2471 · Surxondaryo · 9 ta buyurtma");
    expect(card).toHaveTextContent("Rad etilgan");
    vi.restoreAllMocks();
  });
});
