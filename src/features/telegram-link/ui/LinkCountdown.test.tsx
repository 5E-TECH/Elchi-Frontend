import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { LinkCountdown } from "./LinkCountdown";

/** NG-B: `inline` ko'rinish — bitta qator, progresssiz (`*-notifications-create-link-dialog`). */
describe("LinkCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("inline: «m:ss qoldi» (role=timer) + iste'molchi matni, progress chizig'i yo'q, har soniyada kamayadi", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T10:00:00Z") });
    renderWithProviders(
      <LinkCountdown variant="inline" expiresAtMs={Date.now() + 9 * 60_000 + 41_000} untilLabel="14:37 gacha amal qiladi" />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("9:41 qoldi");
    expect(screen.getByText("· 14:37 gacha amal qiladi")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("9:39 qoldi");
  });

  it("sukut (bar): progress chizig'i bor — shaxsiy Telegram oynasi o'zgarmaydi", () => {
    renderWithProviders(<LinkCountdown expiresAtMs={Date.now() + 5 * 60_000} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });
});
