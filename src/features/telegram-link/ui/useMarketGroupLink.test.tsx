import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { GroupLinkCodeRequest } from "../model/types";
import { useMarketGroupLink } from "./useMarketGroupLink";

/** `useMarketGroupLink` — havola so'rovi bitta bo'lishi (bir «tick» dagi ikki bosish). Tarmoqqa chiqilmaydi. */

const mocks = vi.hoisted(() => ({ requestGroupLinkCode: vi.fn() }));

vi.mock("../api/telegramLinkApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/telegramLinkApi")>()),
  requestGroupLinkCode: (payload: GroupLinkCodeRequest) => mocks.requestGroupLinkCode(payload),
}));

const Harness = () => {
  const link = useMarketGroupLink({ marketName: "Baraka Shop" });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Bir render yopilmasida ikki marta — `isPending` hali `false`.
          void link.start("create");
          void link.start("create");
        }}
      >
        ikki marta
      </button>
      {link.dialog}
    </>
  );
};

beforeEach(() => {
  mocks.requestGroupLinkCode.mockReset();
});

describe("useMarketGroupLink", () => {
  it("bir vaqtda ikki `start` — bitta havola so'rovi", async () => {
    mocks.requestGroupLinkCode.mockResolvedValue({
      token: "c0de",
      purpose: "market_group",
      group_type: "create",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      deep_link: "https://t.me/elchi_bot?startgroup=c0de",
      command: "/start c0de",
    });
    renderWithProviders(<Harness />, { preloadedState: { role: { id: "201", role: "market", region: null, name: "m" } } as never });

    fireEvent.click(screen.getByRole("button", { name: "ikki marta" }));

    expect(await screen.findByRole("dialog", { name: "Telegram guruhini ulash" })).toBeInTheDocument();
    expect(mocks.requestGroupLinkCode).toHaveBeenCalledTimes(1);
  });
});
