import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import SmsPage from "./SmsPage";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};

describe("SmsPage — tablar URL'da", () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: { data: [] } });
  });

  it("sarlavha va 4 tab; noma'lum ?tab= — «Kampaniya»", async () => {
    renderWithProviders(<SmsPage />, { route: "/notifications/sms?tab=xyz" });

    expect(screen.getByRole("heading", { level: 1, name: "SMS" })).toBeInTheDocument();
    expect(
      screen.getByText("Kampaniyalar, shablonlar, xarajat va provayder sozlamalari"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Kampaniya",
      "Shablonlar",
      "Xarajat",
      "Sozlamalar",
    ]);
    expect(screen.getByRole("tab", { name: "Kampaniya" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Kampaniya" })).toBeInTheDocument();
    expect(await screen.findByText("Yangi kampaniya")).toBeInTheDocument();
  });

  it("?tab=templates tiklanadi; tab almashsa URL `replace` bilan yangilanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <SmsPage />
        <LocationProbe />
      </>,
      { route: "/notifications/sms?tab=templates" },
    );

    expect(screen.getByRole("tabpanel", { name: "Shablonlar" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Sozlamalar" }));
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=settings");
    expect(screen.getByRole("tabpanel", { name: "Sozlamalar" })).toBeInTheDocument();
  });
});
