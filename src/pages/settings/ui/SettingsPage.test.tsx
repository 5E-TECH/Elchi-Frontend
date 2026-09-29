import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import SettingsPage from "./SettingsPage";

vi.mock("../../../entities/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/settings")>();
  return {
    ...actual,
    useSettings: () => ({ data: actual.DEFAULT_SETTINGS }),
    useUpdateSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("SettingsPage tabs in dark mode", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("does not paint inactive tab titles with --color-maindark (it equals the dark card background)", () => {
    document.documentElement.classList.add("dark");
    renderWithProviders(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>,
    );

    for (const title of ["Dashboard", "Interfeys"]) {
      const node = screen.getAllByText(title).find((el) => el.tagName === "P")!;
      expect(node.style.color).not.toContain("--color-maindark");
      expect(node.style.color).toBe("var(--color-dashboard-text-muted)");
    }
  });
});
