import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import OpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../identity-ops", () => ({
  default: () => {
    throw new Error("identity-ops crashed");
  },
}));

vi.mock("../branch-ops", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <p>Filiallar tabi ishlayapti{embedded ? " (hub ichida)" : ""}</p>
  ),
}));

vi.mock("../system-ops", () => ({
  default: () => <p>Tizim tabi</p>,
}));

vi.mock("../expense-categories", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <p>Xarajat kategoriyalari tabi{embedded ? " (hub ichida)" : ""}</p>
  ),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const mockPhone = (phone: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

describe("Ops page — per-tab error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the error only in place of the crashed tab and keeps the hub usable", async () => {
    const replaceSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace: replaceSpy });
    const user = userEvent.setup();

    renderWithProviders(<OpsPage />, { route: "/ops?tab=identity" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu bo'limni ochishda xatolik yuz berdi");
    expect(screen.getByRole("heading", { level: 1, name: "Ops vositalari" })).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Filiallar" }));

    // Hub panelni sarlavhasiz (`embedded`) chizadi.
    expect(await screen.findByText("Filiallar tabi ishlayapti (hub ichida)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe("Ops page — tablar (dizayn v2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("9 ta tab: maket tartibi + «Xarajat kategoriyalari» moliya guruhida; eski manzil maslahatda; `?tab=` tiklanadi", async () => {
    renderWithProviders(<OpsPage />, { route: "/ops?tab=system" });

    const tablist = screen.getByRole("tablist", { name: "Ops bo'limlari" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Moliya operatorlari",
      "Xarajat kategoriyalari",
      "Integratsiyalar",
      "Investorlar",
      "Logistika",
      "Filiallar",
      "Xodimlar",
      "Tizim",
      "Kirish diagnostikasi",
    ]);
    expect(within(tablist).getByRole("tab", { name: "Tizim" })).toHaveAttribute("aria-selected", "true");
    expect(within(tablist).getByRole("tab", { name: "Moliya operatorlari" })).toHaveAttribute(
      "title",
      "Eski manzil: /finance-operators",
    );
    expect(await screen.findByText("Tizim tabi")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Tizim" })).toBeInTheDocument();
    // Hub ichida tug'ilgan tab — eski manzili yo'q, maslahat ham yo'q.
    expect(within(tablist).getByRole("tab", { name: "Xarajat kategoriyalari" })).not.toHaveAttribute("title");
  });

  it("«Xarajat kategoriyalari» — to'g'ridan-to'g'ri havola `?tab=expense-categories` panelni hub ichida ochadi", async () => {
    renderWithProviders(<OpsPage />, { route: "/ops?tab=expense-categories" });

    const tab = screen.getByRole("tab", { name: "Xarajat kategoriyalari" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Xarajat kategoriyalari tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Xarajat kategoriyalari" })).toBeInTheDocument();
  });

  it("tab bosilsa «Xarajat kategoriyalari» manzili URL'da (`?tab=expense-categories`)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=finance" },
    );

    await user.click(screen.getByRole("tab", { name: "Xarajat kategoriyalari" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=expense-categories");
    expect(await screen.findByText(/Xarajat kategoriyalari tabi/)).toBeInTheDocument();
  });

  it("tab bosilsa URL `?tab=` almashadi (replace)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=system" },
    );

    await user.click(screen.getByRole("tab", { name: "Filiallar" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=branches");
    expect(await screen.findByText(/Filiallar tabi ishlayapti/)).toBeInTheDocument();
  });

  it("telefonda tablar o'rniga `Select` («Ops bo'limi: <tab>»)", async () => {
    mockPhone(true);
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=system" },
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    const select = screen.getByRole("combobox", { name: "Ops bo'limi: Tizim" });
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Filiallar" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=branches");
    expect(await screen.findByText(/Filiallar tabi ishlayapti/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ops bo'limi: Filiallar" })).toBeInTheDocument();
  });
});
