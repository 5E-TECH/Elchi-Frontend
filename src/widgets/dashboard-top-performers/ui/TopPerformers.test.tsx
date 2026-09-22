import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import TopPerformers from "./TopPerformers";

const markets = [
  { market_id: "market-1", market_name: "Birinchi", total_orders: 50, successful_orders: 45, success_rate: 90 },
  { market_id: "market-2", market_name: "Ikkinchi", total_orders: 40, successful_orders: 32, success_rate: 80 },
  { market_id: "market-3", market_name: "Uchinchi", total_orders: 35, successful_orders: 25, success_rate: 71.43 },
  { market_id: "market-4", market_name: "To‘rtinchi", total_orders: 32, successful_orders: 20, success_rate: 62.5 },
];

describe("TopPerformers", () => {
  it("puts rank one in the middle and highlights the current market", () => {
    renderWithProviders(<TopPerformers markets={markets} currentUserId="market-2" />);

    const podium = screen.getByRole("list", { name: "Top marketlar" });
    const names = within(podium).getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));
    expect(names).toEqual(["2. Ikkinchi", "1. Birinchi", "3. Uchinchi"]);
    const ownCard = screen.getByRole("listitem", { name: "2. Ikkinchi" });
    expect(ownCard).toHaveClass("bg-main/10");
    expect(within(ownCard).getByText("Siz")).toBeInTheDocument();
  });

  it("highlights the current user's row below the podium", () => {
    renderWithProviders(<TopPerformers markets={markets} currentUserId="market-4" />);

    const ownRow = screen.getByText("To‘rtinchi").closest("li");
    expect(ownRow).toHaveClass("bg-main/10");
    expect(within(ownRow!).getByText("Siz")).toBeInTheDocument();
  });

  it("renders safely when the user is absent and keeps low-volume rows", () => {
    renderWithProviders(
      <TopPerformers
        markets={[{ ...markets[0], total_orders: 12 }]}
        currentUserId="missing-user"
      />,
    );

    expect(screen.getByText("Birinchi")).toBeInTheDocument();
    expect(screen.getByText("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin.")).toBeInTheDocument();
    expect(screen.queryByText("Siz")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Top marketlar" })).toHaveClass("grid-cols-3");
  });

  it("supports courier rows when the backend provides them", () => {
    renderWithProviders(
      <TopPerformers
        couriers={[{ courier_id: "courier-1", courier_name: "Kuryer Ali", total_orders: 42, successful_orders: 30, success_rate: 71.43 }]}
        currentUserId="courier-1"
      />,
    );

    expect(screen.getByText("Top kuryerlar")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "1. Kuryer Ali" })).toHaveTextContent("Siz");
  });

  it("renders without crashing when the ranking list is completely empty for a signed-in user", () => {
    renderWithProviders(<TopPerformers markets={[]} currentUserId="user-1" />);

    expect(screen.getByText("Top marketlar")).toBeInTheDocument();
    expect(
      screen.getByText("Ma'lumot hali kam (reyting uchun kamida 30 buyurtma kerak)."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Siz")).not.toBeInTheDocument();
  });

  it("stays wrap-safe at a 390px viewport — three-column podium, no fixed widths, names truncate", () => {
    renderWithProviders(<TopPerformers markets={markets} currentUserId="market-2" />);

    const podium = screen.getByRole("list", { name: "Top marketlar" });
    expect(podium).toHaveClass("grid-cols-3", "min-w-0", "max-w-full");

    const ownCard = screen.getByRole("listitem", { name: "2. Ikkinchi" });
    expect(ownCard).toHaveClass("min-w-0", "overflow-hidden");
    expect(screen.getByText("Ikkinchi")).toHaveClass("truncate");
  });
});
