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
});
