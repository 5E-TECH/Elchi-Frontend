import { screen } from "@testing-library/react";
import TodaysMails from "./todaysMails";
import { renderWithProviders } from "../../../test/test-utils";

const getNewMailsMock = vi.fn();
const getNewMailsCourierMock = vi.fn();

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    getNewMails: getNewMailsMock,
    getNewMailsCourier: getNewMailsCourierMock,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("TodaysMails", () => {
  beforeEach(() => {
    getNewMailsCourierMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it("renders skeleton cards while loading", () => {
    getNewMailsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    renderWithProviders(<TodaysMails />);

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders empty state", () => {
    getNewMailsMock.mockReturnValue({
      data: { data: { data: [] } },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<TodaysMails />);

    expect(screen.getByText("Bugun yangi pochta yo'q")).toBeInTheDocument();
  });

  it("renders mail cards and stats", () => {
    getNewMailsMock.mockReturnValue({
      data: {
        data: {
          data: [
            {
              id: "m-1",
              createdAt: "2026-04-06T08:00:00.000Z",
              post_total_price: 120000,
              order_quantity: 3,
              region_id: "1",
              region: { name: "Toshkent" },
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<TodaysMails />);

    expect(screen.getByText("Toshkent")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("renders error state", () => {
    getNewMailsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderWithProviders(<TodaysMails />);

    expect(screen.getByText("Ma'lumotlarni yuklab bo'lmadi")).toBeInTheDocument();
  });
});
