import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Mails from "./index";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("./components/todaysMails", () => ({
  default: () => <div>today-content</div>,
}));

vi.mock("./components/refusedMails", () => ({
  default: () => <div>refused-content</div>,
}));

vi.mock("./components/oldMails", () => ({
  default: () => <div>old-content</div>,
}));

vi.mock("./components/returnMails", () => ({
  default: () => <div>return-content</div>,
}));

const courierState = {
  role: {
    id: "1",
    role: "courier",
    region: null,
    name: "Courier",
  },
};

const managerState = {
  role: {
    id: "198",
    role: "manager",
    region: null,
    name: "Manager",
  },
};

describe("Mails page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
  });

  it("renders today tab by default", () => {
    renderWithProviders(<Mails />, { route: "/mails/today" });

    expect(screen.getByText("today-content")).toBeInTheDocument();
  });

  it("switches to refused tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Mails />, { route: "/mails/today" });

    await user.click(screen.getByRole("button", { name: /Rad etilgan pochtalar/i }));

    expect(screen.getByText("refused-content")).toBeInTheDocument();
  });

  it("switches to old tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Mails />, { route: "/mails/today" });

    await user.click(screen.getByRole("button", { name: /Eski pochtalar/i }));

    expect(screen.getByText("old-content")).toBeInTheDocument();
  });

  it("redirects legacy tab query to the path route", async () => {
    renderWithProviders(<Mails />, { route: "/mails?tab=refused" });

    await waitFor(() => {
      expect(screen.getByText("refused-content")).toBeInTheDocument();
    });
  });

  it("hides returns tab for courier", () => {
    renderWithProviders(<Mails />, {
      route: "/mails/today",
      preloadedState: courierState,
    });

    // Tab yorlig'i uz tilida aynan "Qaytarish" (mails.json returnTab). Ilgari
    // mavjud bo'lmagan "Qaytarilgan pochtalar" qidirilardi — test hech narsani
    // tekshirmasdi. Qolgan tablar chizilgani — musbat nazorat.
    expect(screen.getByRole("button", { name: /^Rad etilgan pochtalar$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Qaytarish$/ })).not.toBeInTheDocument();
  });

  it("shows the returns tab to a branch manager and opens it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Mails />, {
      route: "/mails/today",
      preloadedState: managerState,
    });

    await user.click(screen.getByRole("button", { name: /^Qaytarish$/ }));

    expect(screen.getByText("return-content")).toBeInTheDocument();
  });

  it("renders the returns route for a manager", () => {
    renderWithProviders(<Mails />, {
      route: "/mails/return",
      preloadedState: managerState,
    });

    expect(screen.getByText("return-content")).toBeInTheDocument();
  });

  it("redirects courier away from returns route", async () => {
    renderWithProviders(<Mails />, {
      route: "/mails/return",
      preloadedState: courierState,
    });

    await waitFor(() => {
      expect(screen.getByText("today-content")).toBeInTheDocument();
    });
    expect(screen.queryByText("return-content")).not.toBeInTheDocument();
  });
});
