import { screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionLogistAssignmentPage from "./index";

const Where = () => <span data-testid="path">{useLocation().pathname}</span>;
const open = (role: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/regions/logist-assignment" element={<RegionLogistAssignmentPage />} />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    {
      route: "/regions/logist-assignment",
      preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
    },
  );

describe("RegionLogistAssignmentPage (v2 bo'sh holat)", () => {
  it.each(["superadmin", "admin"])("%s sees the mockup empty state with a way back to /regions", (role) => {
    open(role);

    expect(screen.getByRole("heading", { level: 1, name: "Logist biriktirish" })).toBeInTheDocument();
    expect(screen.getByText("Logistlarni viloyatlarga biriktirish bo'limi")).toBeInTheDocument();
    expect(screen.getByText("Bo'lim hali ishga tushmagan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hududlarga qaytish" })).toHaveAttribute("href", "/regions");
  });

  it("redirects other roles to /regions", () => {
    open("courier");
    expect(screen.getByTestId("path")).toHaveTextContent("/regions");
  });
});
