import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import AiConfirmBar from "./AiConfirmBar";
import type { AiDraftOrder } from "./evalPreview";

/** Bugungi qabul yopiq (2026-11-08) — «AI bilan» yaratish ham to'siladi: «Tayyorlarini yaratish» o'chiq. */
const ready = [{ customer_name: "Vali" } as unknown as AiDraftOrder];

describe("AiConfirmBar — bugungi qabul yopiq", () => {
  it("`blocked` — tugma o'chiq, bosilsa ham yuborilmaydi; `blocked` siz — avvalgidek", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = renderWithProviders(
      <AiConfirmBar
        readyOrders={ready}
        notReadyCount={0}
        pending={false}
        blocked
        onConfirm={onConfirm}
        onJumpToUnready={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <AiConfirmBar
        readyOrders={ready}
        notReadyCount={0}
        pending={false}
        onConfirm={onConfirm}
        onJumpToUnready={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
