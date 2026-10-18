import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import Mails from "./index";
import { renderWithProviders } from "../../test/test-utils";

// Tab tanalari — o'z testlarida. Bu yerda faqat qaysi tana va qaysi `layout` bilan chizilgani.
vi.mock("./components/todaysMails", () => ({
  default: ({ layout }: { layout: string }) => <div>today-content:{layout}</div>,
}));

vi.mock("./components/refusedMails", () => ({
  default: ({ layout }: { layout: string }) => <div>refused-content:{layout}</div>,
}));

vi.mock("./components/oldMails", () => ({
  default: ({ layout }: { layout: string }) => <div>old-content:{layout}</div>,
}));

vi.mock("./components/returnMails", () => ({
  default: ({ layout }: { layout: string }) => <div>return-content:{layout}</div>,
}));

// Tab sonlari — tanalar ishlatadigan o'sha hooklardan (so'rovsiz soxta qiymatlar).
const counts = vi.hoisted(() => ({ today: 8 as number | undefined, refused: 2 as number | undefined, ret: 9 as number | undefined }));
const returnCountCalls = vi.hoisted(() => ({ value: 0 }));
vi.mock("./model/mailsLists", () => ({
  useTodayMails: () => ({
    isCourier: false,
    isLoaded: counts.today !== undefined,
    mails: Array.from({ length: counts.today ?? 0 }, (_, index) => ({ id: String(index) })),
    query: {},
  }),
  useRefusedMails: () => ({
    isCourier: false,
    isLoaded: counts.refused !== undefined,
    mails: Array.from({ length: counts.refused ?? 0 }, (_, index) => ({ id: String(index) })),
    query: {},
  }),
  useReturnRequestsCount: () => {
    returnCountCalls.value += 1;
    return counts.ret;
  },
}));

const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } });
const courierState = roleState("courier");
const managerState = roleState("manager");

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderMails = (route: string, preloadedState?: ReturnType<typeof roleState>) =>
  renderWithProviders(
    <>
      <Mails />
      <LocationProbe />
    </>,
    { route, preloadedState: preloadedState as never },
  );

/** Telefon (< 768): tablar o'rnida bo'lim tanlagichi, kuryerda to'liq enli qisqa tablar. */
const mockPhone = () =>
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

const tabsNav = () => screen.getByRole("navigation", { name: "Pochta turlari" });

describe("Mails page", () => {
  beforeEach(() => {
    counts.today = 8;
    counts.refused = 2;
    counts.ret = 9;
    returnCountCalls.value = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders today tab by default inside the shell card", () => {
    renderMails("/mails/today");

    expect(screen.getByRole("heading", { level: 1, name: "Pochta" })).toBeInTheDocument();
    expect(screen.getByText("Viloyatlar bo'yicha pochtalarni jo'natish va qabul qilish")).toBeInTheDocument();
    expect(screen.getByText("today-content:card")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bugungi pochtalar" })).toContainElement(screen.getByText("today-content:card"));
  });

  it("shows tab links with counts and titles (Eski — sonsiz)", () => {
    renderMails("/mails/today");

    const nav = tabsNav();
    const today = within(nav).getByRole("link", { name: /^Bugungi/ });
    expect(today).toHaveAttribute("aria-current", "page");
    expect(today).toHaveAttribute("title", "Bugungi pochtalar");
    expect(today).toHaveTextContent("Bugungi 8");
    expect(within(nav).getByRole("link", { name: /^Qaytarish/ })).toHaveTextContent("Qaytarish 9");
    expect(within(nav).getByRole("link", { name: /^Qaytarish/ })).toHaveAttribute("title", "Qaytarish so'rovlari");
    expect(within(nav).getByRole("link", { name: /^Rad etilgan/ })).toHaveTextContent("Rad etilgan 2");
    expect(within(nav).getByRole("link", { name: "Eski" })).toHaveAttribute("title", "Eski pochtalar");
    expect(within(nav).getByRole("link", { name: "Eski" })).toHaveAttribute("href", "/mails/old");
  });

  it("does not draw a count until the list is loaded", () => {
    counts.today = undefined;
    renderMails("/mails/today");

    expect(within(tabsNav()).getByRole("link", { name: /^Bugungi/ })).toHaveTextContent(/^Bugungi$/);
  });

  it("switches to refused tab", async () => {
    const user = userEvent.setup();
    renderMails("/mails/today");

    await user.click(within(tabsNav()).getByRole("link", { name: /^Rad etilgan/ }));

    expect(screen.getByText("refused-content:card")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/mails/refused");
  });

  it("switches to old tab and drops the current tab's URL params", async () => {
    const user = userEvent.setup();
    renderMails("/mails/refused?region_id=5");

    await user.click(within(tabsNav()).getByRole("link", { name: "Eski" }));

    expect(screen.getByText("old-content:card")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/mails/old");
  });

  it("redirects legacy tab query to the path route", async () => {
    renderMails("/mails?tab=refused");

    await waitFor(() => {
      expect(screen.getByText("refused-content:card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("location").textContent).toBe("/mails/refused");
  });

  it("redirects /mails to /mails/today", async () => {
    renderMails("/mails");

    await waitFor(() => {
      expect(screen.getByText("today-content:card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("location").textContent).toBe("/mails/today");
  });

  it("hides returns tab for courier and renders the page layout", () => {
    renderMails("/mails/today", courierState);

    const nav = tabsNav();
    // Kuryer desktopda to'liq nomlar: «Bugungi pochtalar ⟨4⟩ · Rad etilgan pochtalar ⟨3⟩ · Eski pochtalar».
    expect(within(nav).getByRole("link", { name: /^Rad etilgan pochtalar/ })).toHaveTextContent("Rad etilgan pochtalar 2");
    expect(within(nav).getByRole("link", { name: /^Bugungi pochtalar/ })).toHaveTextContent("Bugungi pochtalar 8");
    expect(within(nav).getByRole("link", { name: "Eski pochtalar" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /Qaytarish/ })).not.toBeInTheDocument();
    expect(screen.getByText("Sizga biriktirilgan pochtalar: qabul qilish, rad etilganlar va tarix")).toBeInTheDocument();
    expect(screen.getByText("today-content:page")).toBeInTheDocument();
    // Tablar karta ichida emas (sahifa fonida) va kuryerda qaytarish so'rovlari so'ralmaydi.
    expect(screen.queryByRole("region", { name: "Bugungi pochtalar" })).not.toBeInTheDocument();
    expect(returnCountCalls.value).toBe(0);
  });

  it("shows the returns tab to a branch manager and opens it", async () => {
    const user = userEvent.setup();
    renderMails("/mails/today", managerState);

    expect(screen.getByText("Filialga kelgan pochtalarni ko'rish va qabul qilish")).toBeInTheDocument();
    await user.click(within(tabsNav()).getByRole("link", { name: /^Qaytarish/ }));

    expect(screen.getByText("return-content:card")).toBeInTheDocument();
  });

  it("renders the returns route for a manager", () => {
    renderMails("/mails/return", managerState);

    expect(screen.getByText("return-content:card")).toBeInTheDocument();
  });

  it("redirects courier away from returns route", async () => {
    renderMails("/mails/return", courierState);

    await waitFor(() => {
      expect(screen.getByText("today-content:page")).toBeInTheDocument();
    });
    expect(screen.queryByText(/return-content/)).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/mails/today");
  });

  it("redirects courier legacy ?tab=return to today", async () => {
    renderMails("/mails?tab=return", courierState);

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/mails/today");
    });
  });

  it("removes batch_mode from the URL for roles without the batch view", async () => {
    renderMails("/mails/old?batch_mode=all&region_id=7", managerState);

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/mails/old?region_id=7");
    });
  });

  it("keeps batch_mode for admin", async () => {
    renderMails("/mails/old?batch_mode=all", roleState("admin"));

    expect(screen.getByText("old-content:card")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/mails/old?batch_mode=all");
    });
  });

  it("phone: staff switch sections with a select instead of tabs", async () => {
    mockPhone();
    const user = userEvent.setup();
    renderMails("/mails/today");

    expect(screen.queryByRole("navigation", { name: "Pochta turlari" })).not.toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Pochta bo'limi: Bugungi pochtalar" });
    expect(select).toHaveTextContent("Bugungi pochtalar");
    expect(select.closest("[data-select]")).toHaveTextContent("Bugungi pochtalar8");

    await user.click(select);
    const option = await screen.findByRole("option", { name: /Rad etilgan pochtalar/ });
    expect(option).toHaveTextContent("Rad etilgan pochtalar2");
    expect(screen.getByRole("option", { name: /Qaytarish so'rovlari/ })).toBeInTheDocument();
    await user.click(option);

    expect(screen.getByText("refused-content:card")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/mails/refused");
  });

  it("phone: courier tabs are full width with short labels; no description", () => {
    mockPhone();
    renderMails("/mails/refused", courierState);

    const nav = tabsNav();
    const refused = within(nav).getByRole("link", { name: /^Rad etilgan/ });
    expect(refused).toHaveTextContent(/^Rad etilgan 2$/);
    expect(refused).toHaveAttribute("title", "Rad etilgan pochtalar");
    expect(within(nav).getByRole("link", { name: "Eski" })).toBeInTheDocument();
    expect(screen.queryByText("Sizga biriktirilgan pochtalar: qabul qilish, rad etilganlar va tarix")).not.toBeInTheDocument();
    expect(screen.getByText("refused-content:page")).toBeInTheDocument();
  });
});
