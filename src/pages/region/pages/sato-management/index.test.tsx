import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionSatoManagementPage from "./index";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({ api }));

const REGIONS = [
  {
    id: "1",
    name: "Toshkent shahri",
    districts: [
      { id: "2", name: "Chilonzor" },
      { id: "3", name: "Mirobod" },
    ],
  },
  { id: "6", name: "Samarqand viloyati", districts: [{ id: "179", name: "Samarqand shahri" }] },
  { id: "11", name: "Sirdaryo viloyati", districts: [] },
];

const Where = () => <span data-testid="path">{useLocation().pathname}</span>;
const open = (role = "superadmin") =>
  renderWithProviders(
    <Routes>
      <Route path="/regions/sato-management" element={<RegionSatoManagementPage />} />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    {
      route: "/regions/sato-management",
      preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
    },
  );

const dataTransfer = () => {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? "",
  };
};
const drag = (districtId: string, toRegionId: string) => {
  const dt = dataTransfer();
  fireEvent.dragStart(screen.getByTestId(`district-${districtId}`), { dataTransfer: dt });
  fireEvent.dragOver(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
  fireEvent.drop(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
};

/** Telefon kengligi (`useIsPhone` — `matchMedia("(max-width: 767px)")`). */
const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

describe("RegionSatoManagementPage (v2)", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { statusCode: 200, data: REGIONS } });
    api.patch.mockResolvedValue({ data: { statusCode: 200 } });
  });
  afterEach(() => vi.clearAllMocks());

  it("lists regions with district counts and the empty-region placeholder", async () => {
    open("admin");

    const tashkent = await screen.findByRole("region", { name: "Toshkent shahri" });
    expect(within(tashkent).getByText("Chilonzor")).toBeInTheDocument();
    expect(within(tashkent).getByText("2 ta")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Sirdaryo viloyati" })).getByText(
        "Tuman biriktirilmagan",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Tumanlarni o'tkazish" }),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("region");
  });

  it("moves a dragged district with PATCH /district/:id {assigned_region} and shows the success toast", async () => {
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("district/2", { assigned_region: "6" }),
    );
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Chilonzor"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Tuman boshqa viloyatga o'tkazildi")).toBeInTheDocument();
  });

  it("reloads the list and keeps the district in place when the move fails", async () => {
    api.patch.mockRejectedValue(new Error("fail"));
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    expect(await screen.findByText("O'tkazishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Ro'yxat qayta yuklandi, tuman joyida qoldi")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Toshkent shahri" })).getByText("Chilonzor"),
      ).toBeInTheDocument(),
    );
  });

  it("on a phone moves a district through the «⇆» region picker", async () => {
    const restore = asPhone();
    try {
      const user = userEvent.setup();
      open();
      await screen.findByRole("button", { name: /^Toshkent shahri/ });

      await user.click(
        screen.getByRole("button", { name: "Mirobod — boshqa viloyatga o'tkazish" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Boshqa viloyatga o'tkazish" });
      expect(
        within(dialog).queryByRole("radio", { name: "Toshkent shahri" }),
      ).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "O'tkazish" })).toBeDisabled();
      await user.click(within(dialog).getByRole("radio", { name: "Sirdaryo viloyati" }));
      await user.click(within(dialog).getByRole("button", { name: "O'tkazish" }));

      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith("district/3", { assigned_region: "11" }),
      );
    } finally {
      restore();
    }
  });

  it("load error is shown on the page (ErrorState) and is not toasted globally again", async () => {
    api.get.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    const { queryClient } = open();

    expect(await screen.findByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    const [query] = queryClient.getQueryCache().getAll();
    expect(query?.meta?.silentError).toBe(true);
  });

  it("redirects other roles to /regions without loading", async () => {
    open("manager");
    expect(await screen.findByTestId("path")).toHaveTextContent("/regions");
    expect(api.get).not.toHaveBeenCalled();
  });
});
