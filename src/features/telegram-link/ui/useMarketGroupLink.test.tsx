import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, CanceledError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notify } from "../../../shared/lib/notify";
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

const SingleStart = () => {
  const link = useMarketGroupLink({ marketName: "Baraka Shop" });
  return (
    <button type="button" onClick={() => void link.start("cancel")}>
      ulash
    </button>
  );
};

const marketState = { preloadedState: { role: { id: "201", role: "market", region: null, name: "m" } } as never };

beforeEach(() => {
  mocks.requestGroupLinkCode.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
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
    renderWithProviders(<Harness />, marketState);

    fireEvent.click(screen.getByRole("button", { name: "ikki marta" }));

    expect(await screen.findByRole("dialog", { name: "Telegram guruhini ulash" })).toBeInTheDocument();
    expect(mocks.requestGroupLinkCode).toHaveBeenCalledTimes(1);
  });

  // TOZ-1: xato tasnifi bildirishnoma qo'shish oynasi (`notification-create`) bilan bir xil.
  it.each([
    ["javobsiz (tarmoq) xato", () => new AxiosError("Network Error", "ERR_NETWORK")],
    ["vaqt tugadi (ECONNABORTED)", () => new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED")],
    ["ataylab bekor qilingan so'rov", () => new CanceledError()],
  ])("%s — o'z xato xabari chiqmaydi", async (_name, makeError) => {
    const errorSpy = vi.spyOn(notify, "error");
    mocks.requestGroupLinkCode.mockRejectedValueOnce(makeError());
    renderWithProviders(<SingleStart />, marketState);

    fireEvent.click(screen.getByRole("button", { name: "ulash" }));

    await waitFor(() => expect(mocks.requestGroupLinkCode).toHaveBeenCalledTimes(1));
    // Rad etilgan mutatsiya `catch` gacha yetib borsin.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("server xatosi — faqat i18n matn (backend matni chiqmaydi)", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    mocks.requestGroupLinkCode.mockRejectedValueOnce(
      new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 500,
        data: { statusCode: 500, message: "relation telegram_link_tokens does not exist" },
      } as AxiosResponse),
    );
    renderWithProviders(<SingleStart />, marketState);

    fireEvent.click(screen.getByRole("button", { name: "ulash" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    expect(errorSpy).toHaveBeenCalledWith("Havolani olib bo'lmadi", {
      description: "Birozdan keyin qayta urinib ko'ring.",
    });
  });
});
