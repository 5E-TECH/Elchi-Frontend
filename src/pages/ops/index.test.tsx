import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import OpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../system-ops", () => ({
  default: () => {
    throw new Error("system-ops crashed");
  },
}));

vi.mock("../daily-schedule", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <p>Kun tartibi tabi{embedded ? " (hub ichida)" : ""}</p>
  ),
}));

vi.mock("../payments/shiftSettings", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <p>Kassa smenasi tabi{embedded ? " (hub ichida)" : ""}</p>
  ),
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

    renderWithProviders(<OpsPage />, { route: "/ops?tab=system" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu bo'limni ochishda xatolik yuz berdi");
    expect(screen.getByRole("heading", { level: 1, name: "Ops vositalari" })).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Kun tartibi" }));

    // Hub panelni sarlavhasiz (`embedded`) chizadi.
    expect(await screen.findByText("Kun tartibi tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe("Ops page — tablar (dizayn v2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("4 ta tab (LIuf0DcD: «Investorlar», «Yetkazish narxi», «Xodimlar», «Kirish diagnostikasi» yo'q; F2qp6FtE: «Moliya operatorlari» yo'q): «Xarajat kategoriyalari» va «Kassa smenasi» moliya guruhida; eski manzil maslahatda; `?tab=` tiklanadi", async () => {
    renderWithProviders(<OpsPage />, { route: "/ops?tab=daily-schedule" });

    const tablist = screen.getByRole("tablist", { name: "Ops bo'limlari" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Xarajat kategoriyalari",
      "Kassa smenasi",
      "Kun tartibi",
      "Tizim holati",
    ]);
    expect(within(tablist).getByRole("tab", { name: "Kun tartibi" })).toHaveAttribute("aria-selected", "true");
    expect(within(tablist).queryByRole("tab", { name: "Moliya operatorlari" })).toBeNull();
    expect(within(tablist).getByRole("tab", { name: "Tizim holati" })).toHaveAttribute("title", "Eski manzil: /system-ops");
    expect(await screen.findByText("Kun tartibi tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Kun tartibi" })).toBeInTheDocument();
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
      { route: "/ops?tab=system" },
    );

    await user.click(screen.getByRole("tab", { name: "Xarajat kategoriyalari" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=expense-categories");
    expect(await screen.findByText(/Xarajat kategoriyalari tabi/)).toBeInTheDocument();
  });

  it("«Kassa smenasi» (ega 2026-11-16) — `?tab=shift-settings` smena sozlamalarini hub ichida (`embedded`) ochadi, eski manzil maslahatisiz; tab bosilsa URL'da", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=shift-settings" },
    );
    const tab = screen.getByRole("tab", { name: "Kassa smenasi" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).not.toHaveAttribute("title");
    expect(await screen.findByText("Kassa smenasi tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Kassa smenasi" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Kun tartibi" }));
    await user.click(screen.getByRole("tab", { name: "Kassa smenasi" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=shift-settings");
  });

  it("«Kun tartibi» (2026-11-10) — `?tab=daily-schedule` sahifani hub ichida (`embedded`) ochadi, eski manzil maslahatisiz", async () => {
    renderWithProviders(<OpsPage />, { route: "/ops?tab=daily-schedule" });
    const tab = screen.getByRole("tab", { name: "Kun tartibi" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).not.toHaveAttribute("title");
    expect(await screen.findByText("Kun tartibi tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Kun tartibi" })).toBeInTheDocument();
  });

  it.each([
    // u5HTJtqK: qaytarish so'rovlari — «Pochta → Qaytarish» da (Ops nusxasi olib tashlandi).
    ["logistics", "/mails/return"],
    ["branches", "/batches"],
    // LIuf0DcD (ega 2026-11-16, 2026-11-18): olib tashlangan tablar — o'rnini bosuvchi sahifaga.
    ["auth", "/activity-logs"],
    ["identity", "/all-users"],
    ["investors", "/all-users?role=investor"],
    ["delivery-pricing", "/delivery-tariffs"],
    // F2qp6FtE: market o'z operatoriga o'zi to'laydi — eski «Moliya operatorlari» havolasi «Market operatorlari» ga.
    ["finance", "/all-users?role=market_operator"],
  ])("ko'chgan / olib tashlangan tab: `?tab=%s` → %s", async (tab, target) => {
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: `/ops?tab=${tab}` },
    );
    expect(await screen.findByTestId("location")).toHaveTextContent(new RegExp(`^${target.replace("?", "\\?")}$`));
  });

  it.each(["constructor", "toString", "__proto__"])(
    "`?tab=%s` (meros xossasi) — yo'naltirilmaydi, birinchi tab ochiladi",
    async (tab) => {
      renderWithProviders(
        <>
          <OpsPage />
          <LocationProbe />
        </>,
        { route: `/ops?tab=${tab}` },
      );
      expect(await screen.findByRole("tab", { name: "Xarajat kategoriyalari", selected: true })).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent(`/ops?tab=${tab}`);
    },
  );

  it("tab bosilsa URL `?tab=` almashadi (replace)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=daily-schedule" },
    );

    await user.click(screen.getByRole("tab", { name: "Xarajat kategoriyalari" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=expense-categories");
    expect(await screen.findByText("Xarajat kategoriyalari tabi (hub ichida)")).toBeInTheDocument();
  });

  it("telefonda tablar o'rniga `Select` («Ops bo'limi: <tab>»)", async () => {
    mockPhone(true);
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpsPage />
        <LocationProbe />
      </>,
      { route: "/ops?tab=daily-schedule" },
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    const select = screen.getByRole("combobox", { name: "Ops bo'limi: Kun tartibi" });
    await user.click(select);
    expect(await screen.findAllByRole("option")).toHaveLength(4);
    await user.click(await screen.findByRole("option", { name: "Kassa smenasi" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=shift-settings");
    expect(await screen.findByText("Kassa smenasi tabi (hub ichida)")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ops bo'limi: Kassa smenasi" })).toBeInTheDocument();
  });
});
