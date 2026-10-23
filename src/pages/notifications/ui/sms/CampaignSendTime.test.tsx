import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CampaignSendTime } from "./CampaignSendTime";

const QUIET = { start: 18 * 60, end: 9 * 60 };

describe("CampaignSendTime (KM-1, tungi taqiq izohi)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("⭐ kechqurun 19:10 (Toshkent) — «SMS ertaga, 09:00 da yuboriladi»", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T14:10:00Z"));
    renderWithProviders(<CampaignSendTime quietHours={QUIET} />);
    const notice = screen.getByTestId("campaign-quiet-notice");
    expect(notice).toHaveTextContent("Hozir 19:10 — SMS ertaga, 09:00 da yuboriladi");
    expect(notice).toHaveTextContent("Reklama 18:00–09:00 oralig'ida yuborilmaydi");
  });

  it("tunda 03:00 — «bugun, 09:00»", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T22:00:00Z"));
    renderWithProviders(<CampaignSendTime quietHours={QUIET} />);
    expect(screen.getByTestId("campaign-quiet-notice")).toHaveTextContent(
      "Hozir 03:00 — SMS bugun, 09:00 da yuboriladi",
    );
  });

  it("kunduzi va taqiq noma'lum bo'lsa — izoh yo'q", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z"));
    const { unmount } = renderWithProviders(<CampaignSendTime quietHours={QUIET} />);
    expect(screen.queryByTestId("campaign-quiet-notice")).toBeNull();
    unmount();
    vi.setSystemTime(new Date("2026-10-21T14:10:00Z"));
    renderWithProviders(<CampaignSendTime quietHours={undefined} />);
    expect(screen.queryByTestId("campaign-quiet-notice")).toBeNull();
    expect(screen.getByRole("radio", { name: /Darhol/ })).toBeChecked();
  });
});
