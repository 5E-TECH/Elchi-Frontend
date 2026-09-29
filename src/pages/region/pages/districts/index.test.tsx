import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionDistrictsPage from "./index";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({ api }));

const REGIONS = [
  { id: "1", name: "Toshkent shahri", districts: [{ id: "2", name: "Chilonzor" }, { id: "3", name: "Mirobod" }] },
  { id: "6", name: "Samarqand viloyati", districts: [{ id: "179", name: "Samarqand shahri" }] },
];

const Where = () => <span data-testid="path">{useLocation().pathname}</span>;
const open = (role = "superadmin") =>
  renderWithProviders(
    <Routes>
      <Route path="/regions/districts" element={<RegionDistrictsPage />} />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    { route: "/regions/districts", preloadedState: { role: { id: "1", role, region: null, name: role } } as never },
  );

/** jsdom'da DataTransfer yo'q — oddiy xarita bilan. */
const dataTransfer = () => {
  const store: Record<string, string> = {};
  return { setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? "" };
};
const drag = (districtId: string, toRegionId: string) => {
  const dt = dataTransfer();
  fireEvent.dragStart(screen.getByTestId(`district-${districtId}`), { dataTransfer: dt });
  fireEvent.dragOver(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
  fireEvent.drop(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
};

describe("RegionDistrictsPage (7exC7QKt)", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { statusCode: 200, data: REGIONS } });
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    api.patch.mockResolvedValue({ data: { statusCode: 200 } });
    api.delete.mockResolvedValue({ data: { statusCode: 200 } });
  });
  afterEach(() => vi.clearAllMocks());

  it("lists every region with its districts (not a placeholder any more)", async () => {
    open();

    const tashkent = await screen.findByRole("region", { name: "Toshkent shahri" });
    expect(within(tashkent).getByText("Chilonzor")).toBeInTheDocument();
    expect(within(tashkent).getByText("Mirobod")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Samarqand shahri")).toBeInTheDocument();
    expect(screen.getByTestId("regions-count")).toHaveTextContent("2");
    expect(screen.getByTestId("districts-count")).toHaveTextContent("3");
  });

  it("adds a district with POST /district and refetches the list", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Chilonzor");

    await user.type(screen.getByLabelText("Yangi tuman nomi"), "Yangi tuman");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Viloyatni tanlang" }));
    fireEvent.click(await screen.findByTitle("Samarqand viloyati"));
    await user.click(screen.getByRole("button", { name: /Qo'shish/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("district", { name: "Yangi tuman", region_id: "6" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("renames a district with PATCH /district/name/:id", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Mirobod");

    await user.click(screen.getByRole("button", { name: "Mirobod nomini tahrirlash" }));
    const input = screen.getByLabelText("Tuman nomi");
    await user.clear(input);
    await user.type(input, "Mirobod tumani{Enter}");

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/name/3", { name: "Mirobod tumani" }));
  });

  it("moves a dragged district to another region with PATCH /district/:id {assigned_region}", async () => {
    let resolvePatch: (value: unknown) => void = () => undefined;
    api.patch.mockReturnValue(new Promise((resolve) => { resolvePatch = resolve; }));
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    // Optimistik: server javobidan oldin yangi viloyatda turadi.
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Chilonzor")).toBeInTheDocument());
    expect(api.patch).toHaveBeenCalledWith("district/2", { assigned_region: "6" });
    await act(async () => resolvePatch({ data: { statusCode: 200 } }));
  });

  it("puts the district back where it was when the move fails", async () => {
    api.patch.mockRejectedValue(Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }));
    // Xatodan keyingi qayta so'rov ham eski holatni qaytaradi.
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    await waitFor(() => expect(within(screen.getByRole("region", { name: "Toshkent shahri" })).getByText("Chilonzor")).toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Samarqand viloyati" })).queryByText("Chilonzor")).not.toBeInTheDocument();
  });

  it("redirects an admin (not superadmin) to /regions", async () => {
    open("admin");

    expect(await screen.findByTestId("path")).toHaveTextContent("/regions");
    expect(api.get).not.toHaveBeenCalled();
  });
});
